// Swap the base-colour texture inside public/models/mitutoyo-protractor.glb.
//   node scripts/replace-model-texture.mjs <texture.jpg>
// The texture is produced by scripts/model-texture/*.py (see README there).
import { NodeIO } from '@gltf-transform/core';
import fs from 'node:fs';
const [,, texPath] = process.argv;
if (!texPath) throw new Error('usage: node scripts/replace-model-texture.mjs <texture.jpg>');
const glb = 'public/models/mitutoyo-protractor.glb';
const io = new NodeIO();
const doc = await io.read(glb);
const tex = doc.getRoot().listTextures()[0];
tex.setImage(new Uint8Array(fs.readFileSync(texPath))).setMimeType('image/jpeg');
await io.write(glb, doc);
console.log('wrote', glb, fs.statSync(glb).size, 'bytes');
