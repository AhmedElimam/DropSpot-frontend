/**
 * ar.json integrity. Two silent failure modes this guards:
 *  1. A DUPLICATED key. JSON.parse keeps the last one, so a second top-level "home" block
 *     (2026-10-02, the teacher home redesign) silently wiped the parent home's strings and
 *     the screen showed raw key names. Nothing failed — until this test.
 *  2. A literal t('a.b') whose key the file never defines — the screen shows "a.b".
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../../..');
const raw = fs.readFileSync(path.join(__dirname, '../ar.json'), 'utf8').replace(/^﻿/, '');

/** Every key that appears twice in the same object, as dotted paths. */
function duplicateKeys(src: string): string[] {
  const dups: string[] = [];
  const stack: { keys: Set<string>; path: string[] }[] = [];
  let i = 0;
  let pendingKey: string | null = null;
  const readString = (): string => {
    let out = '';
    i++; // opening quote
    while (i < src.length && src[i] !== '"') {
      if (src[i] === '\\') { out += src[i] + src[i + 1]; i += 2; continue; }
      out += src[i++];
    }
    i++; // closing quote
    return out;
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '"') {
      const s = readString();
      let j = i;
      while (/\s/.test(src[j] ?? '')) j++;
      if (src[j] === ':' && stack.length) {
        const top = stack[stack.length - 1];
        if (top.keys.has(s)) dups.push([...top.path, s].join('.'));
        top.keys.add(s);
        pendingKey = s;
      }
      continue;
    }
    if (c === '{') {
      const parent = stack[stack.length - 1];
      stack.push({ keys: new Set(), path: parent ? [...parent.path, pendingKey ?? '?'] : [] });
      pendingKey = null;
    } else if (c === '}') {
      stack.pop();
    }
    i++;
  }
  return dups;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, out); }
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('ar.json', () => {
  it('has no duplicated keys at any level', () => {
    expect(duplicateKeys(raw)).toEqual([]);
  });

  it('defines every literal key the app asks for', () => {
    const dict = JSON.parse(raw);
    const has = (key: string) => key.split('.').reduce<any>((cur, part) => (cur && typeof cur === 'object' ? cur[part] : undefined), dict) !== undefined;
    const pat = /\bt\(\s*['"]([a-z_]+\.[a-zA-Z0-9_.]+)['"]/g;
    const missing = new Set<string>();
    for (const file of [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'src'))]) {
      for (const m of fs.readFileSync(file, 'utf8').matchAll(pat)) if (!has(m[1])) missing.add(`${m[1]} (${path.relative(ROOT, file)})`);
    }
    expect([...missing]).toEqual([]);
  });

  it('the duplicate detector itself catches a repeated key', () => {
    expect(duplicateKeys('{"a": {"x": 1}, "b": 2, "a": {"y": 1}}')).toEqual(['a']);
    expect(duplicateKeys('{"a": {"x": 1, "x": 2}}')).toEqual(['a.x']);
  });
});
