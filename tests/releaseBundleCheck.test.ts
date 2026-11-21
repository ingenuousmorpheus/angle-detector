import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** scripts/check-release-bundle.mjs must reject bundles that would leak a key or ship dev hooks. */
const run = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'al-bundle-'));
  try {
    mkdirSync(join(dir, 'assets'));
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    return spawnSync(process.execPath, ['scripts/check-release-bundle.mjs', dir], { encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('release bundle check', () => {
  it('passes a clean bundle', () => {
    expect(run({ 'assets/index.js': 'console.log("ok")', 'index.html': '<html></html>' }).status).toBe(0);
  });

  it.each([
    ['an API key', `const k="AIza${'x'.repeat(35)}"`],
    ['the Gemini endpoint', 'fetch("https://generativelanguage.googleapis.com/v1")'],
    ['the Gemini client', 'new GoogleGenAI({})'],
    ['the ?photo= hook', 'const u=n.get("photo")'],
  ])('fails on %s', (_, body) => {
    const r = run({ 'assets/index.js': body });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('FAIL');
  });
});
