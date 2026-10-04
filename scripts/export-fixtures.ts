/** Writes the synthetic fixtures as PNGs (e.g. to show on a monitor and point the phone at). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderAngleFixture, STANDARD_FIXTURE_ANGLES } from '../src/fixtures/syntheticAngle';
import { encodePng } from './png';

mkdirSync('fixtures/synthetic', { recursive: true });
const manifest = [];
for (const angleDeg of STANDARD_FIXTURE_ANGLES) {
  const f = renderAngleFixture({ angleDeg, rotationDeg: 37, width: 1280, height: 720, thickness: 18 });
  const file = `fixtures/synthetic/angle_${String(angleDeg).padStart(3, '0')}.png`;
  writeFileSync(file, encodePng(f.image.width, f.image.height, f.image.data));
  manifest.push({ file, ...f.truth });
}
writeFileSync('fixtures/synthetic/manifest.json', JSON.stringify(manifest, null, 2));
console.log(`wrote ${manifest.length} fixtures`);
