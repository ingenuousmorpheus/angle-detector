import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Vec2 } from '../geometry/angle2d';
import { approachAngle, protractorPose, type ProtractorRig } from './protractorPose';
import rigJson from './mitutoyoRig.json';

/**
 * AR presentation layer: the scanned Mitutoyo digital protractor drawn over the
 * camera image, pivot on the vertex, arm and blade laid along the two edges, LCD
 * showing the reading. Presentation only — the number shown is the measurement's
 * displayDeg; nothing here computes or alters an angle.
 */
const rig = rigJson as ProtractorRig & {
  armLength: number;
  lcd: { x0: number; x1: number; y0: number; y1: number; z: number };
};
// Served from public/ (web dev server and the Android WebView both serve the app root).
const MODEL_URL = 'models/mitutoyo-protractor.glb';
let modelPromise: Promise<THREE.Group> | null = null;
const loadModel = () => (modelPromise ??= new GLTFLoader().loadAsync(MODEL_URL).then((g) => g.scene));

export interface MitutoyoOverlayProps {
  /** Container size in CSS px. */
  width: number;
  height: number;
  /** Container-px points. When null, a searching ghost is shown at `aim`. */
  vertex: Vec2 | null;
  edgeA: Vec2 | null;
  edgeB: Vec2 | null;
  /** Value for the LCD (already in the user's convention), or null for dashes. */
  displayDeg: number | null;
  locked?: boolean;
  /** Ghost position when there is no measurement (defaults to the centre). */
  aim?: Vec2;
}

const LCD_W = 512, LCD_H = 256;

function drawLcd(ctx: CanvasRenderingContext2D, deg: number | null, locked: boolean) {
  ctx.fillStyle = '#aab69a';
  ctx.fillRect(0, 0, LCD_W, LCD_H);
  const g = ctx.createLinearGradient(0, 0, 0, LCD_H);
  g.addColorStop(0, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LCD_W, LCD_H);
  ctx.fillStyle = '#1b2116';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.font = 'bold 150px "Courier New", ui-monospace, monospace';
  ctx.fillText(deg === null ? '---.-' : deg.toFixed(1), LCD_W - 70, LCD_H / 2 + 6);
  ctx.textAlign = 'left';
  ctx.font = 'bold 60px "Courier New", ui-monospace, monospace';
  ctx.fillText('°', LCD_W - 66, LCD_H / 2 - 40);
  if (locked) {
    ctx.font = 'bold 34px "Courier New", ui-monospace, monospace';
    ctx.fillText('HOLD', 22, 36);
  }
}

const MitutoyoOverlay: React.FC<MitutoyoOverlayProps> = ({ width, height, vertex, edgeA, edgeB, displayDeg, locked = false, aim }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ width, height, vertex, edgeA, edgeB, locked, aim });
  propsRef.current = { width, height, vertex, edgeA, edgeB, locked, aim };
  const lcdRef = useRef<{ ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture } | null>(null);

  // LCD text follows the reading.
  useEffect(() => {
    const lcd = lcdRef.current;
    if (!lcd) return;
    drawLcd(lcd.ctx, displayDeg, locked);
    lcd.tex.needsUpdate = true;
  }, [displayDeg, locked]);
  const lcdStateRef = useRef({ displayDeg, locked });
  lcdStateRef.current = { displayDeg, locked };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -5000, 5000);

    const root = new THREE.Group(); // at the vertex, rotated + scaled
    const bladePivot = new THREE.Group(); // at the pivot, swings the blade
    root.add(bladePivot);
    root.visible = false;
    scene.add(root);

    const materials: THREE.MeshBasicMaterial[] = [];
    let disposed = false;
    let raf = 0;

    // LCD read-out: a small textured plane on the LCD window of the scan.
    const lcdCanvas = document.createElement('canvas');
    lcdCanvas.width = LCD_W;
    lcdCanvas.height = LCD_H;
    const lcdCtx = lcdCanvas.getContext('2d')!;
    const lcdTex = new THREE.CanvasTexture(lcdCanvas);
    lcdTex.colorSpace = THREE.SRGBColorSpace;
    lcdTex.anisotropy = 4;
    lcdRef.current = { ctx: lcdCtx, tex: lcdTex };
    drawLcd(lcdCtx, lcdStateRef.current.displayDeg, lcdStateRef.current.locked);
    const lcdMat = new THREE.MeshBasicMaterial({ map: lcdTex, transparent: true });
    materials.push(lcdMat);
    const inset = 0.012;
    const lcdW = rig.lcd.x1 - rig.lcd.x0 - 2 * inset, lcdH = rig.lcd.y1 - rig.lcd.y0 - 2 * inset;
    const lcdMesh = new THREE.Mesh(new THREE.PlaneGeometry(lcdW, lcdH), lcdMat);
    lcdMesh.position.set((rig.lcd.x0 + rig.lcd.x1) / 2 - rig.pivot.x, (rig.lcd.y0 + rig.lcd.y1) / 2 - rig.pivot.y, rig.lcd.z + 0.004);
    lcdMesh.renderOrder = 2;
    root.add(lcdMesh);

    loadModel().then((src) => {
      if (disposed) return;
      const model = src.clone(true);
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const old = mesh.material as THREE.MeshStandardMaterial;
        // Unlit: the scan's lighting is baked into its texture.
        const m = new THREE.MeshBasicMaterial({ map: old.map, transparent: true });
        materials.push(m);
        mesh.material = m;
      });
      const body = model.getObjectByName('body');
      const blade = model.getObjectByName('blade');
      if (body) { body.position.set(-rig.pivot.x, -rig.pivot.y, 0); root.add(body); }
      if (blade) { blade.position.set(-rig.pivot.x, -rig.pivot.y, 0); bladePivot.add(blade); }
    }).catch((e) => console.error('Mitutoyo model failed to load', e));

    const cur = { x: 0, y: 0, body: 0, blade: 0, scale: 0, ready: false };
    let mirrored = false;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const p = propsRef.current;
      if (!p.width || !p.height) return;
      if (renderer.domElement.width !== Math.round(p.width * renderer.getPixelRatio())
          || renderer.domElement.height !== Math.round(p.height * renderer.getPixelRatio())) {
        renderer.setSize(p.width, p.height, false);
      }
      camera.left = 0; camera.right = p.width; camera.top = 0; camera.bottom = -p.height;
      camera.updateProjectionMatrix();

      const measuring = !!(p.vertex && p.edgeA && p.edgeB);
      let tx: number, ty: number, tBody: number, tBlade: number;
      // Model is ~1 unit wide; keep it a comfortable size on any screen.
      let tScale = 0.62 * Math.min(p.width, p.height);
      if (measuring) {
        const pose = protractorPose(p.vertex!, p.edgeA!, p.edgeB!, rig);
        tx = p.vertex!.x; ty = p.vertex!.y;
        tBody = pose.bodyRotationDeg; tBlade = pose.bladeRotationDeg;
        if (pose.mirrored !== mirrored) {
          // handedness flip: jump rather than spin through a mirrored in-between
          mirrored = pose.mirrored;
          cur.body = tBody;
          cur.blade = tBlade;
        }
        // never let the arm overshoot the shorter measured edge by much
        const shorter = Math.min(Math.hypot(p.edgeA!.x - tx, p.edgeA!.y - ty), Math.hypot(p.edgeB!.x - tx, p.edgeB!.y - ty));
        tScale = Math.max(0.35 * Math.min(p.width, p.height), Math.min(tScale, (1.25 * shorter) / rig.armLength));
      } else {
        const a = p.aim ?? { x: p.width / 2, y: p.height / 2 };
        tx = a.x; ty = a.y;
        // searching ghost: blade breathes open and closed around the hinge
        tBody = 0; tBlade = -25 + 25 * Math.sin(t / 900);
        tScale *= 0.8;
      }
      const k = cur.ready ? 0.18 : 1;
      cur.x += (tx - cur.x) * k; cur.y += (ty - cur.y) * k;
      cur.scale += (tScale - cur.scale) * k;
      cur.body = approachAngle(cur.body, tBody, k);
      cur.blade = approachAngle(cur.blade, tBlade, measuring ? k : 1);
      cur.ready = true;

      root.position.set(cur.x, -cur.y, 0);
      root.rotation.z = THREE.MathUtils.degToRad(cur.body);
      root.scale.set(mirrored ? -cur.scale : cur.scale, cur.scale, cur.scale);
      // LCD text stays readable: un-mirror it, and turn it over when the dial is upside down.
      lcdMesh.scale.x = mirrored ? -1 : 1;
      lcdMesh.rotation.z = Math.abs(cur.body) > 95 ? Math.PI : 0;
      bladePivot.rotation.z = THREE.MathUtils.degToRad(cur.blade);
      root.visible = true;

      // Hologram while searching / aligning, solid once locked.
      const pulse = 0.5 + 0.5 * Math.sin(t / 450);
      const opacity = !measuring ? 0.18 + 0.12 * pulse : p.locked ? 0.96 : 0.72;
      const tint = !measuring || !p.locked ? 0x9ff3ff : 0xffffff;
      for (const m of materials) {
        m.opacity = opacity;
        if (m !== lcdMat) m.color.setHex(tint);
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      lcdRef.current = null;
      lcdTex.dispose();
      materials.forEach((m) => m.dispose());
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ width, height }} />;
};

export default MitutoyoOverlay;
