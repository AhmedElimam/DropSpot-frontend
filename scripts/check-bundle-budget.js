#!/usr/bin/env node
/**
 * Fails when the exported Android bundle outgrows perf-budget.json (docs/PERFORMANCE.md).
 *   npx expo export --platform android --output-dir dist-perf && node scripts/check-bundle-budget.js dist-perf
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || 'dist-perf';
const budget = require(path.join(__dirname, '..', 'perf-budget.json')).android;

const files = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : [path.join(d, e.name)]));
const size = (f) => fs.statSync(f).size;

const jsDir = path.join(dir, '_expo', 'static', 'js', 'android');
const bytecode = files(jsDir).filter((f) => /\.(hbc|js)$/.test(f)).reduce((s, f) => s + size(f), 0);
const assets = fs.existsSync(path.join(dir, 'assets')) ? files(path.join(dir, 'assets')) : [];
const assetsTotal = assets.reduce((s, f) => s + size(f), 0);
const tooBig = assets.filter((f) => size(f) > budget.singleAssetMaxBytes);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const rows = [
  ['JS bytecode', bytecode, budget.bytecodeMaxBytes],
  [`assets (${assets.length} files)`, assetsTotal, budget.assetsMaxBytes],
];
let failed = false;
for (const [name, value, max] of rows) {
  const ok = value <= max;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'OVER'} ${name.padEnd(22)} ${kb(value).padStart(9)} / ${kb(max)}`);
}
for (const f of tooBig) {
  failed = true;
  console.log(`OVER single asset ${path.relative(dir, f)} ${kb(size(f))} / ${kb(budget.singleAssetMaxBytes)}`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Android bundle\n| | size | budget |\n|---|---|---|\n${rows.map(([n, v, m]) => `| ${n} | ${kb(v)} | ${kb(m)} |`).join('\n')}\n`);
}
if (failed) {
  console.error('\nThe Android bundle is over budget (perf-budget.json). Find what grew — a new dependency, a barrel import, an uncompressed asset — before raising any number.');
  process.exit(1);
}
