#!/usr/bin/env python3
"""Merge src/i18n/sweep/*.json (one new top-level section each) into src/i18n/ar.json.

Each sweep file is {"section": {...}}. A section must not already exist in ar.json (the
integrity test guards duplicates; this script refuses up front). Keys are appended before
the final closing brace, pretty-printed like the rest of the file; the sweep files are
deleted after a successful merge.
"""
import json, glob, os, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AR = os.path.join(ROOT, 'src/i18n/ar.json')

def no_dups(pairs):
    c = Counter(k for k, _ in pairs)
    d = [k for k, n in c.items() if n > 1]
    if d:
        raise SystemExit(f'duplicate keys in ar.json: {d}')
    return dict(pairs)

raw = open(AR, encoding='utf-8').read()
bom = raw.startswith('﻿')
ar = json.loads(raw.lstrip('﻿'), object_pairs_hook=no_dups)
files = sorted(glob.glob(os.path.join(ROOT, 'src/i18n/sweep/*.json')))
if not files:
    print('nothing to merge'); sys.exit(0)
added = {}
for f in files:
    part = json.load(open(f, encoding='utf-8'), object_pairs_hook=no_dups)
    for section, keys in part.items():
        if section in ar or section in added:
            raise SystemExit(f'{f}: section {section!r} already exists')
        if not isinstance(keys, dict) or not keys:
            raise SystemExit(f'{f}: section {section!r} is empty')
        for k, v in keys.items():
            if not isinstance(v, str) or not v.strip():
                raise SystemExit(f'{f}: {section}.{k} is not a non-empty string')
        added[section] = keys
# Append: strip the final "}" and add the sections with the file's 2-space style.
body = raw.lstrip('﻿').rstrip()
assert body.endswith('}')
body = body[:-1].rstrip()
if not body.endswith(','):
    body += ','
chunks = []
for section, keys in added.items():
    inner = json.dumps(keys, ensure_ascii=False, indent=2)
    inner = '\n'.join('  ' + line for line in inner.splitlines())
    chunks.append(f'  "{section}": {inner.strip()}')
new = body + '\n' + ',\n'.join(chunks) + '\n}\n'
json.loads(new, object_pairs_hook=no_dups)  # must stay valid and duplicate-free
open(AR, 'w', encoding='utf-8').write(('﻿' if bom else '') + new)
for f in files:
    os.remove(f)
print('merged sections:', ', '.join(f'{s} ({len(k)})' for s, k in added.items()))
