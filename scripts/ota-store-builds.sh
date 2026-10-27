#!/usr/bin/env bash
#
# Publish the current main (JS only) as an OTA update to the store builds that are out.
#
# Why this exists: every CI store build carries its OWN runtime fingerprint (the stamped
# build number is part of it, and even two builds of one commit differ), so `eas update`
# from main — and .github/workflows/ota-update.yml — reach no shipped build. This reads the
# exact runtime baked into each recent build's artifact and publishes once per runtime.
# A runtime no phone carries is harmless; publishing to every recent build is the point.
#
# Run it after a new store build goes live, or after a JS fix you want on phones now:
#   scripts/ota-store-builds.sh --check          # what each build has; publishes nothing
#   scripts/ota-store-builds.sh                  # publish main to the last 8 builds per platform
#   scripts/ota-store-builds.sh --last 3 -m "…"  # fewer builds, your own message
#   scripts/ota-store-builds.sh 38396293453      # only these CI run ids
#
# Options:
#   --check         read runtimes and say which builds already have today's main; no publish
#   --last N        how many recent successful builds per platform (default 8)
#   -m, --message   update message (default: the last commit's subject)
#   --skip-tests    don't run tsc + jest first
#
# Needs: gh (logged in), eas-cli logged in (npx eas-cli whoami), unzip, curl, python3, plutil.
# A build whose native dependencies differ from main is SKIPPED, never published to.

set -euo pipefail
cd "$(dirname "$0")/.."

CHECK=0; LAST=8; MSG=""; SKIP_TESTS=0; RUNS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK=1 ;;
    --last) LAST="$2"; shift ;;
    -m|--message) MSG="$2"; shift ;;
    --skip-tests) SKIP_TESTS=1 ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) RUNS+=("$1") ;;
  esac
  shift
done

PROJECT_URL="https://u.expo.dev/$(node -p "require('./app.json').expo.extra.eas.projectId")"
CHANNEL=production
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
SEEN="$TMP/seen"; : > "$SEEN"

say() { printf '%s\n' "$*"; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

# ── Publish only what is on origin/main, committed ─────────────────────────────────────
git fetch -q origin main
HEAD_SHA="$(git rev-parse HEAD)"
if [ "$CHECK" = 0 ]; then
  git diff --quiet && git diff --cached --quiet || die "uncommitted changes — commit or discard them first"
  [ "$HEAD_SHA" = "$(git rev-parse origin/main)" ] || die "HEAD is not origin/main — pull/push first"
fi
HEAD_TIME="$(git log -1 --format=%ct HEAD)"
[ -n "$MSG" ] || MSG="$(git log -1 --format=%s HEAD)"

# The JS must run on the build's native code: same dependencies, same patches.
native_matches() {
  local sha="$1"
  node -e '
    const a = JSON.parse(process.argv[1]), b = require("./package.json");
    const pick = (p) => JSON.stringify([p.dependencies, p.devDependencies]);
    process.exit(pick(a) === pick(b) ? 0 : 1);
  ' "$(git show "$sha:package.json")" || return 1
  local d; for d in patches plugins; do
    [ -e "$d" ] || continue
    git diff --quiet "$sha" HEAD -- "$d" || return 1
  done
}

# createdAt (epoch) of the update EAS serves to this runtime, or 0.
served_at() {
  local rt="$1" platform="$2"
  curl -s -m 20 "$PROJECT_URL" \
    -H "expo-runtime-version: $rt" -H "expo-platform: $platform" -H "expo-channel-name: $CHANNEL" \
    -H "expo-protocol-version: 1" -H "accept: multipart/mixed" \
  | python3 -c '
import sys, json, datetime
s = sys.stdin.read(); i = s.find("{\"id\"")
if i < 0: print(0); sys.exit()
m, _ = json.JSONDecoder().raw_decode(s[i:])
print(int(datetime.datetime.fromisoformat(m["createdAt"].replace("Z", "+00:00")).timestamp()))'
}

# ── Collect the builds ──────────────────────────────────────────────────────────────────
CLEARED=()
LIST="$TMP/builds"; : > "$LIST"
add_runs() { # workflow platform artifact
  local wf="$1" platform="$2" art="$3" ids
  if [ ${#RUNS[@]} -gt 0 ]; then ids="${RUNS[*]}"
  else ids="$(gh run list --workflow "$wf" --status success --limit "$LAST" --json databaseId --jq '.[].databaseId' | tr '\n' ' ')"; fi
  local id; for id in $ids; do
    local w; w="$(gh run view "$id" --json workflowName,headSha --jq '.workflowName + " " + .headSha')"
    case "$w" in
      "Build iOS IPA "*) [ "$platform" = ios ] || continue ;;
      "Build Android AAB"*) [ "$platform" = android ] || continue ;;
      *) continue ;;
    esac
    echo "$id $platform $art ${w##* }" >> "$LIST"
  done
}
add_runs ios-ipa.yml ios drosspot-ios-ipa
add_runs android-aab.yml android drosspot-android-aab
[ -s "$LIST" ] || die "no successful store builds found"

if [ "$CHECK" = 0 ] && [ "$SKIP_TESTS" = 0 ]; then
  say "▸ type-check and tests"
  npx tsc --noEmit -p . && npx jest --ci --silent >/dev/null || die "tests failed — nothing published"
fi

PUBLISHED=0; SKIPPED=0; DONE=()
while read -r id platform art sha; do
  short="${sha:0:7}"
  dir="$TMP/$id"; mkdir -p "$dir"
  gh run download "$id" -n "$art" -D "$dir" >/dev/null 2>&1 || { say "· run $id ($platform $short): artifact gone — skipped"; continue; }
  f="$(find "$dir" -type f \( -name '*.ipa' -o -name '*.aab' \) | head -1)"
  if [ "$platform" = ios ]; then
    rt="$(unzip -p "$f" 'Payload/*.app/EXUpdates.bundle/fingerprint' 2>/dev/null || true)"
    bid="$(unzip -p "$f" 'Payload/*.app/Info.plist' | plutil -extract CFBundleIdentifier raw - 2>/dev/null || true)"
    build="$(unzip -p "$f" 'Payload/*.app/Info.plist' | plutil -extract CFBundleVersion raw - 2>/dev/null || true)"
    [ "$bid" = com.drosspot.app ] || { say "· run $id: $bid is not the store app — skipped"; rm -rf "$dir"; continue; }
  else
    rt="$(unzip -p "$f" base/assets/fingerprint 2>/dev/null || true)"
    build="$(basename "$f" .aab)"; build="${build##*-}"
  fi
  rm -rf "$dir"
  label="$platform build $build (run $id, $short)"
  [ -n "$rt" ] || { say "· $label: no runtime inside — skipped"; continue; }
  if grep -qx "$platform $rt" "$SEEN"; then continue; fi
  echo "$platform $rt" >> "$SEEN"

  if ! native_matches "$sha"; then
    say "⚠ $label: native dependencies differ from main — skipped (needs a store build)"
    SKIPPED=$((SKIPPED + 1)); continue
  fi

  at="$(served_at "$rt" "$platform")"
  if [ "$at" -ge "$HEAD_TIME" ] 2>/dev/null; then status="has main"; else status="behind main"; fi
  if [ "$CHECK" = 1 ]; then say "• $label  runtime ${rt:0:8}  → $status"; continue; fi

  say "▸ $label  runtime ${rt:0:8}  → publishing"
  # Metro caches each file's transform with the EXPO_PUBLIC_* values inlined, and the cache
  # key does not include them: without a clear, a bundle kept the commit (and API URL, app
  # env) of whichever export last compiled that file — every OTA since a98d246 reported
  # a98d246 to the tracker (2026-10-24). The first publish per platform in a run starts from
  # a clean cache; the rest reuse it, already built with this run's values.
  clear=""
  case " ${CLEARED[*]:-} " in *" $platform "*) ;; *) clear="--clear-cache"; CLEARED+=("$platform") ;; esac
  env -u EXPO_PUBLIC_STAGING_KEY EXPO_PUBLIC_APP_ENV=production EXPO_PUBLIC_API_URL=https://drosspot.app/api/v1 \
    EXPO_PUBLIC_BUNDLE_COMMIT="$HEAD_SHA" \
    OTA_RUNTIME_VERSION="$rt" npx eas-cli update --branch "$CHANNEL" --platform "$platform" $clear \
    --message "$MSG ($platform b$build)" --non-interactive >"$TMP/eas.log" 2>&1 \
    || { tail -20 "$TMP/eas.log"; die "publish failed for $label"; }
  [ "$(served_at "$rt" "$platform")" -ge "$HEAD_TIME" ] || die "published, but EAS does not serve it to $label"
  say "  ✓ served"
  PUBLISHED=$((PUBLISHED + 1))
  DONE+=("$platform b$build")
done < "$LIST"

[ "$CHECK" = 1 ] && exit 0
say "Done: $PUBLISHED runtime(s) published, $SKIPPED skipped. Phones take it on the next full restart."

# The record the DevOps page's OTA tracker reads (/admin/delivery): an annotated tag per publish,
# `ota/<UTC time>` on the published commit, with the message and the builds it reached. A tag,
# because the server's read-only GitHub token reads tags (Contents) but not Deployments.
if [ "$PUBLISHED" -gt 0 ]; then
  TAG="ota/$(date -u +%Y%m%d-%H%M%S)"
  if printf '%s\n\nbuilds: %s\nskipped: %s\n' "$MSG" "${DONE[*]}" "$SKIPPED" | git tag -a "$TAG" -F - "$HEAD_SHA" \
    && git push -q origin "refs/tags/$TAG"; then
    say "Recorded as $TAG (the DevOps page's OTA tracker)."
  else
    say "⚠ could not record $TAG — the DevOps page will not list this publish"
  fi
fi
