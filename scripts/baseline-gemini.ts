/**
 * AD-00 — record the current Gemini mode's error and latency on fixtures with known angles.
 *
 *   GEMINI_API_KEY=... npm run baseline:gemini
 *
 * Writes baseline/gemini-baseline.json. Without a key it exits cleanly and says so;
 * it never fabricates numbers.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { standardFixtureSet } from '../src/fixtures/syntheticAngle';
import { encodePng } from './png';

const key = process.env.GEMINI_API_KEY ?? process.env.API_KEY;
if (!key) {
  console.log('GEMINI_API_KEY not set — Gemini baseline NOT run (status stays "pending" in docs/BASELINE.md).');
  process.exit(0);
}
process.env.API_KEY = key;
const { analyzeImageAngle } = await import('../services/geminiService');

interface Row {
  fixture: string;
  truthDeg: number;
  geminiDeg: number | null;
  absErrorDeg: number | null;
  /** Error allowing the supplement (convention confusion), for diagnosis only. */
  absErrorAnyConventionDeg: number | null;
  vertexErrorPx: number | null;
  latencyMs: number;
  found: boolean;
  description: string;
}

const cases: { name: string; base64: string; mime: string; width: number; height: number; truthDeg: number; vertex: { x: number; y: number } }[] = [];

for (const f of standardFixtureSet({ width: 1280, height: 720, thickness: 18 })) {
  cases.push({
    name: f.name,
    base64: encodePng(f.image.width, f.image.height, f.image.data).toString('base64'),
    mime: 'image/png',
    width: f.image.width,
    height: f.image.height,
    truthDeg: f.truth.angleDeg,
    vertex: f.truth.vertex,
  });
}
const mitu = JSON.parse(readFileSync('fixtures/mitutoyo-digital-protractor/truth.json', 'utf8'));
cases.push({
  name: 'mitutoyo-digital-protractor',
  base64: readFileSync('fixtures/mitutoyo-digital-protractor/mitutoyo_center.jpg').toString('base64'),
  mime: 'image/jpeg',
  width: mitu.width,
  height: mitu.height,
  truthDeg: mitu.includedAngleDeg,
  vertex: mitu.points[1],
});

const rows: Row[] = [];
for (const c of cases) {
  const t0 = performance.now();
  let row: Row;
  try {
    const r = await analyzeImageAngle(c.base64, c.mime);
    const g = r.isAngleFound ? r.angle : null;
    const v = r.points?.[1];
    row = {
      fixture: c.name,
      truthDeg: c.truthDeg,
      geminiDeg: g,
      absErrorDeg: g === null ? null : Math.abs(g - c.truthDeg),
      absErrorAnyConventionDeg: g === null ? null : Math.min(Math.abs(g - c.truthDeg), Math.abs(g - (180 - c.truthDeg))),
      vertexErrorPx: v ? Math.hypot(v.x * c.width - c.vertex.x, v.y * c.height - c.vertex.y) : null,
      latencyMs: Math.round(performance.now() - t0),
      found: r.isAngleFound,
      description: r.description,
    };
  } catch (e) {
    row = {
      fixture: c.name, truthDeg: c.truthDeg, geminiDeg: null, absErrorDeg: null, absErrorAnyConventionDeg: null,
      vertexErrorPx: null, latencyMs: Math.round(performance.now() - t0), found: false, description: `ERROR: ${(e as Error).message}`,
    };
  }
  rows.push(row);
  console.log(`${row.fixture.padEnd(36)} truth ${row.truthDeg.toFixed(1).padStart(6)}  gemini ${row.geminiDeg?.toFixed(2) ?? '  —  '}  err ${row.absErrorDeg?.toFixed(2) ?? '—'}  ${row.latencyMs}ms`);
}

const errs = rows.map(r => r.absErrorDeg).filter((e): e is number => e !== null).sort((a, b) => a - b);
const q = (p: number) => (errs.length ? errs[Math.min(errs.length - 1, Math.floor(p * errs.length))] : null);
const summary = {
  model: 'gemini (see services/geminiService.ts)',
  runAt: new Date().toISOString(),
  n: rows.length,
  found: rows.filter(r => r.found).length,
  medianAbsErrorDeg: q(0.5),
  p95AbsErrorDeg: q(0.95),
  medianLatencyMs: rows.map(r => r.latencyMs).sort((a, b) => a - b)[Math.floor(rows.length / 2)],
};
mkdirSync('baseline', { recursive: true });
writeFileSync('baseline/gemini-baseline.json', JSON.stringify({ summary, rows }, null, 2));
console.log(summary);
