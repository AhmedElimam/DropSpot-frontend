#!/usr/bin/env bash
# Measure the app on a REAL Android phone over USB, so slowness and heat are diagnosed
# from numbers instead of guesses (three rounds of static fixes preceded this script).
#
#   1. On the phone: Settings → About → tap "MIUI/Build number" 7× → Developer options →
#      USB debugging ON. Plug it in, accept the fingerprint prompt.
#   2. Install the RELEASE build you are testing (a Play/APK build, never Expo Go/dev).
#   3. Run:  scripts/android-profile.sh [minutes]      (default 5)
#      then USE the app the way a student or parent does: open tabs, scroll, go back,
#      lock the phone for a minute, unlock, scroll again.
#   4. Send the printed report (or the file it names) back.
#
# Samples every 10 s: CPU % of our process, memory (PSS, Java heap, native heap, graphics),
# the battery temperature, and the frame stats since the previous sample (janky frames,
# 90th/99th percentile frame time). Ends with a wakelock / network summary.
set -euo pipefail

PKG="${PKG:-com.drosspot.app}"
MINUTES="${1:-5}"
STEP=10
ADB="${ADB:-$(command -v adb || echo /opt/homebrew/bin/adb)}"
OUT="${OUT:-/tmp/drosspot-profile-$(date +%Y%m%d-%H%M%S).txt}"

if ! "$ADB" get-state >/dev/null 2>&1; then
  echo "No device. Plug the phone in with USB debugging on, then: $ADB devices" >&2
  exit 1
fi

model=$("$ADB" shell getprop ro.product.model | tr -d '\r')
android=$("$ADB" shell getprop ro.build.version.release | tr -d '\r')
ram=$("$ADB" shell "grep MemTotal /proc/meminfo" | awk '{printf "%.1f GB", $2/1024/1024}')
ver=$("$ADB" shell dumpsys package "$PKG" | grep -m1 versionName | tr -d '\r' | sed 's/^ *//')
if ! "$ADB" shell pidof "$PKG" >/dev/null 2>&1; then
  echo "The app is not running on the phone. Open it, then run this again." >&2
  exit 1
fi
if "$ADB" shell dumpsys package "$PKG" | grep -q "DEBUGGABLE"; then
  echo "WARNING: this is a DEBUG build. Numbers from it mean nothing — install the release APK/AAB." | tee "$OUT"
fi

{
  echo "Dros Spot profile — $model, Android $android, RAM $ram, app $ver, $(date)"
  echo "sampling every ${STEP}s for ${MINUTES} min — use the app now"
  echo
  printf "%-8s %5s %7s %7s %7s %7s %6s %7s %7s %7s\n" time cpu% pssMB javaMB nativeMB gfxMB temp janky% p90ms p99ms
} | tee -a "$OUT"

"$ADB" shell dumpsys gfxinfo "$PKG" reset >/dev/null 2>&1 || true
end=$((SECONDS + MINUTES * 60))
while [ $SECONDS -lt $end ]; do
  pid=$("$ADB" shell pidof "$PKG" | tr -d '\r' | awk '{print $1}')
  [ -z "$pid" ] && { echo "$(date +%H:%M:%S)  app died / was killed by the OS" | tee -a "$OUT"; break; }

  cpu=$("$ADB" shell top -b -n 1 -p "$pid" 2>/dev/null | awk -v p="$pid" '$1==p {print $9}' | tr -d '\r')
  mem=$("$ADB" shell dumpsys meminfo "$pid" 2>/dev/null | tr -d '\r')
  pss=$(echo "$mem" | awk '/TOTAL PSS:/ {print $3; exit} /^ *TOTAL +[0-9]/ {print $2; exit}')
  java=$(echo "$mem" | awk '/Java Heap:/ {print $3; exit}')
  native=$(echo "$mem" | awk '/Native Heap:/ {print $3; exit}')
  gfx=$(echo "$mem" | awk '/Graphics:/ {print $2; exit}')
  temp=$("$ADB" shell dumpsys battery 2>/dev/null | awk '/temperature/ {printf "%.1f", $2/10}' | tr -d '\r')
  gfxinfo=$("$ADB" shell dumpsys gfxinfo "$PKG" 2>/dev/null | tr -d '\r')
  janky=$(echo "$gfxinfo" | awk '/Janky frames:/ {gsub(/[()%]/,"",$NF); print $NF; exit}')
  p90=$(echo "$gfxinfo" | awk '/90th percentile:/ {gsub(/ms/,"",$3); print $3; exit}')
  p99=$(echo "$gfxinfo" | awk '/99th percentile:/ {gsub(/ms/,"",$3); print $3; exit}')
  "$ADB" shell dumpsys gfxinfo "$PKG" reset >/dev/null 2>&1 || true

  kb() { awk -v v="${1:-0}" 'BEGIN { printf "%.0f", v/1024 }'; }
  printf "%-8s %5s %7s %7s %7s %7s %6s %7s %7s %7s\n" "$(date +%H:%M:%S)" "${cpu:-?}" "$(kb "$pss")" "$(kb "$java")" "$(kb "$native")" "$(kb "$gfx")" "${temp:-?}" "${janky:-?}" "${p90:-?}" "${p99:-?}" | tee -a "$OUT"
  sleep $STEP
done

{
  echo
  echo "== how to read it"
  echo "cpu%     above ~25 while you are NOT touching the phone = background work (the heat)"
  echo "pssMB    climbing steadily without coming back down = a leak; a sawtooth is normal GC"
  echo "janky%   over 20 while scrolling = render cost; p99 over 100 ms = long JS frames"
  echo "temp     battery °C; over 40 after a few minutes of ordinary use is the overheating"
  echo
  echo "== wakelocks and network held by the app since last charge"
  "$ADB" shell dumpsys batterystats --charged "$PKG" 2>/dev/null | grep -iE "wake lock|Wi-Fi|Mobile network|Cpu|foreground" | head -20
  echo
  echo "== native frame histogram (last window)"
  "$ADB" shell dumpsys gfxinfo "$PKG" 2>/dev/null | sed -n '/Total frames rendered/,/HISTOGRAM/p' | head -12
} | tee -a "$OUT"

echo
echo "Saved: $OUT  — send this file back."
