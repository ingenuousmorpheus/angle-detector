import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Undo2, RotateCcw, Magnet, Lock, Unlock, Download, Camera, Repeat } from 'lucide-react';
import { signedAngle, sub, type AngleConvention, type Vec2 } from '../geometry/angle2d';
import { measureFromPoints } from '../measurement/measureFromPoints';
import type { AngleMeasurement } from '../measurement/measurementTypes';
import { snapToEdge } from '../vision/snapToEdge';
import type { GrayImage } from '../vision/grayImage';
import { exportAnnotated } from './exportAnnotated';
import { conventionLabel, formatAngle, NEXT_CONVENTION } from './format';
import { containRect, toContainerPx, toImageNorm, type Rect } from './containRect';

/** Points in placement order: vertex, edge A, edge B. Normalized display-frame coordinates. */
type Placed = [Vec2 | null, Vec2 | null, Vec2 | null];
const EMPTY: Placed = [null, null, null];
const PROMPTS = ['Tap the vertex (the bend / pivot)', 'Tap a point on the first edge', 'Tap a point on the second edge'];
const HANDLE_HIT_PX = 32;
const LOUPE_PX = 132;
const LOUPE_ZOOM = 4;

interface ManualProtractorProps {
  /** Frozen frame, already cropped to exactly what was displayed. */
  frame: HTMLCanvasElement;
  gray: GrayImage;
  /** Optional starting geometry, e.g. an AI hint: [edge A, vertex, edge B]. */
  initial?: [Vec2, Vec2, Vec2] | null;
  onExit: () => void;
  onMeasurement?: (m: AngleMeasurement | null) => void;
}

const ManualProtractor: React.FC<ManualProtractorProps> = ({ frame, gray, initial, onExit, onMeasurement }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [points, setPoints] = useState<Placed>(initial ? [initial[1], initial[0], initial[2]] : EMPTY);
  const [history, setHistory] = useState<Placed[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  // Snap-to-edge defaults OFF: on a busy fixture it can pull a point onto a
  // nearby strong edge (observed ~5.5 deg on the Mitutoyo render). The operator
  // enables it explicitly per session after seeing where the raw taps land.
  const [snap, setSnap] = useState(false);
  const [convention, setConvention] = useState<AngleConvention>('interior');
  const frameUrl = useMemo(() => frame.toDataURL('image/jpeg', 0.92), [frame]);

  // P1 fix: the frozen image keeps its intrinsic aspect ratio across orientation
  // changes. imgRect is the object-contain rect of the frame inside the
  // container; points are stored normalized in IMAGE coords, so rotating the
  // device (which only re-letterboxes) cannot move a point relative to the image.
  const imgRect: Rect = useMemo(
    () => containRect(size.w, size.h, frame.width, frame.height),
    [size.w, size.h, frame.width, frame.height],
  );

  // Track the rendered size so the overlay never drifts on resize / orientation change.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [vertex, edgeA, edgeB] = points;
  const complete = vertex && edgeA && edgeB;
  const measurement = useMemo<AngleMeasurement | null>(
    () => (complete ? measureFromPoints(edgeA, vertex, edgeB, { frameWidth: gray.width, frameHeight: gray.height, convention }) : null),
    [complete, edgeA, vertex, edgeB, gray.width, gray.height, convention],
  );
  useEffect(() => onMeasurement?.(measurement), [measurement, onMeasurement]);

  const toNorm = useCallback(
    (e: React.PointerEvent): Vec2 => {
      const r = rootRef.current!.getBoundingClientRect();
      return toImageNorm(e.clientX, e.clientY, r.left, r.top, imgRect);
    },
    [imgRect],
  );

  const maybeSnap = useCallback(
    (p: Vec2, index: number): Vec2 => {
      // The vertex is often hidden (inside a bend, under a pivot) — only snap edge points.
      if (!snap || index === 0 || size.w === 0) return p;
      const k = gray.width / size.w;
      const hit = snapToEdge(gray, { x: p.x * gray.width, y: p.y * gray.height }, { radius: Math.round(12 * k) });
      return hit ? { x: hit.x / gray.width, y: hit.y / gray.height } : p;
    },
    [snap, gray, size.w],
  );

  const drawLoupe = useCallback(
    (p: Vec2) => {
      const c = loupeRef.current;
      if (!c) return;
      const ctx = c.getContext('2d')!;
      const src = (LOUPE_PX / LOUPE_ZOOM) * (frame.width / Math.max(1, size.w));
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, LOUPE_PX, LOUPE_PX);
      ctx.drawImage(frame, p.x * frame.width - src / 2, p.y * frame.height - src / 2, src, src, 0, 0, LOUPE_PX, LOUPE_PX);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(LOUPE_PX / 2, 0);
      ctx.lineTo(LOUPE_PX / 2, LOUPE_PX);
      ctx.moveTo(0, LOUPE_PX / 2);
      ctx.lineTo(LOUPE_PX, LOUPE_PX / 2);
      ctx.stroke();
    },
    [frame, size.w],
  );

  const commit = useCallback((next: Placed) => {
    setHistory((h) => [...h.slice(-49), points]);
    setPoints(next);
  }, [points]);

  // Active pointer for the drag: secondary touches must not hijack it.
  const activePointerId = useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (locked || dragIndex !== null) return;
    const p = toNorm(e);
    const nextEmpty = points.findIndex((q) => q === null);
    let index = nextEmpty;
    if (index === -1) {
      // all placed: grab the nearest handle (hit distance in displayed image px)
      let best = HANDLE_HIT_PX;
      points.forEach((q, i) => {
        const d = Math.hypot((q!.x - p.x) * imgRect.w, (q!.y - p.y) * imgRect.h);
        if (d < best) { best = d; index = i; }
      });
      if (index === -1) return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    setHistory((h) => [...h.slice(-49), points]);
    const next = [...points] as Placed;
    next[index] = p;
    setPoints(next);
    setDragIndex(index);
    drawLoupe(p);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragIndex === null || e.pointerId !== activePointerId.current) return;
    const p = toNorm(e);
    setPoints((prev) => {
      const next = [...prev] as Placed;
      next[dragIndex] = p;
      return next;
    });
    drawLoupe(p);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragIndex === null || e.pointerId !== activePointerId.current) return;
    activePointerId.current = null;
    const i = dragIndex;
    setPoints((prev) => {
      const next = [...prev] as Placed;
      next[i] = maybeSnap(prev[i]!, i);
      return next;
    });
    setDragIndex(null);
  };

  const undo = () => {
    if (!history.length || locked) return;
    setPoints(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };
  const reset = () => {
    if (locked) return;
    commit(EMPTY);
  };
  const save = () => {
    if (!measurement?.found || !complete) return;
    const url = exportAnnotated(frame, [edgeA, vertex, edgeB], measurement);
    const a = document.createElement('a');
    a.href = url;
    a.download = `angle-${(measurement.displayDeg ?? 0).toFixed(1)}deg-${Date.now()}.png`;
    a.click();
  };

  // ---- drawing (container CSS pixels, via the contain rect) ----
  const px = useCallback((p: Vec2) => toContainerPx(p, imgRect), [imgRect]);
  const arcPath = (() => {
    if (!complete || !measurement?.found) return null;
    const v = px(vertex), a = px(edgeA), b = px(edgeB);
    const ua = sub(a, v), ub = sub(b, v);
    const r = Math.min(48, 0.45 * Math.hypot(ua.x, ua.y), 0.45 * Math.hypot(ub.x, ub.y));
    const na = Math.hypot(ua.x, ua.y), nb = Math.hypot(ub.x, ub.y);
    const s = { x: v.x + (ua.x / na) * r, y: v.y + (ua.y / na) * r };
    const t = { x: v.x + (ub.x / nb) * r, y: v.y + (ub.y / nb) * r };
    const sweep = signedAngle(ua, ub) > 0 ? 1 : 0;
    return { d: `M ${s.x} ${s.y} A ${r} ${r} 0 0 ${sweep} ${t.x} ${t.y}`, r, v, ua, ub, na, nb };
  })();
  const labelPos = (() => {
    if (!arcPath) return null;
    const { v, ua, ub, na, nb, r } = arcPath;
    let bx = ua.x / na + ub.x / nb, by = ua.y / na + ub.y / nb;
    const bl = Math.hypot(bx, by);
    if (bl < 1e-6) { bx = -ua.y / na; by = ua.x / na; } else { bx /= bl; by /= bl; }
    return { x: v.x + bx * (r + 34), y: v.y + by * (r + 34) };
  })();
  const loupePos = (() => {
    if (dragIndex === null || !points[dragIndex]) return null;
    const p = px(points[dragIndex]!);
    const x = Math.min(size.w - LOUPE_PX - 4, Math.max(4, p.x - LOUPE_PX / 2));
    const y = p.y - LOUPE_PX - 48 >= 4 ? p.y - LOUPE_PX - 48 : Math.min(size.h - LOUPE_PX - 4, p.y + 48);
    return { x, y };
  })();
  const nextPrompt = points.findIndex((q) => q === null);

  const btn = 'flex items-center gap-1.5 px-3 h-11 rounded-md bg-black/70 hover:bg-black/90 text-sm font-semibold disabled:opacity-40';
  // Icon-only toolbar on small screens: same buttons, handlers, order and
  // 44px touch targets — the text labels just collapse below the sm breakpoint
  // so the toolbar fits one row on a portrait phone instead of covering the frame.
  const btnLabel = 'hidden sm:inline';

  return (
    <div ref={rootRef} className="absolute inset-0 z-40 select-none" style={{ touchAction: 'none' }}>
      {/* P1: the frozen frame keeps its intrinsic aspect ratio (imgRect), never
          stretched — letterboxed on rotation. Points are image-normalized, so
          the overlay, loupe, snap, and export all stay geometrically correct. */}
      <img
        src={frameUrl}
        alt="Frozen frame"
        className="absolute pointer-events-none"
        style={{ left: imgRect.x, top: imgRect.y, width: imgRect.w, height: imgRect.h }}
        draggable={false}
      />

      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${size.w || 1} ${size.h || 1}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <filter id="mp-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="transparent" />
        {vertex && edgeA && (
          <line x1={px(vertex).x} y1={px(vertex).y} x2={px(edgeA).x} y2={px(edgeA).y} stroke="#67e8f9" strokeWidth={3} strokeLinecap="round" filter="url(#mp-glow)" />
        )}
        {vertex && edgeB && (
          <line x1={px(vertex).x} y1={px(vertex).y} x2={px(edgeB).x} y2={px(edgeB).y} stroke="#a3e635" strokeWidth={3} strokeLinecap="round" filter="url(#mp-glow)" />
        )}
        {arcPath && <path d={arcPath.d} fill="none" stroke="#fef08a" strokeWidth={2} filter="url(#mp-glow)" />}
        {points.map((q, i) =>
          q ? (
            <g key={i}>
              <circle cx={px(q).x} cy={px(q).y} r={HANDLE_HIT_PX / 2} fill={locked ? 'transparent' : 'rgba(34,211,238,0.12)'} stroke={locked ? 'none' : 'rgba(34,211,238,0.6)'} strokeDasharray="3 3" />
              <circle cx={px(q).x} cy={px(q).y} r={i === 0 ? 5 : 4} fill={i === 0 ? '#fef08a' : i === 1 ? '#67e8f9' : '#a3e635'} />
            </g>
          ) : null,
        )}
        {labelPos && measurement?.found && (
          <text x={labelPos.x} y={labelPos.y} fill="#fef08a" fontSize={22} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.85)', strokeWidth: 4 }}>
            {formatAngle(measurement.displayDeg)}
          </text>
        )}
      </svg>

      <canvas
        ref={loupeRef}
        width={LOUPE_PX}
        height={LOUPE_PX}
        className="absolute rounded-full border-2 border-cyan-400 pointer-events-none shadow-lg"
        style={{ left: loupePos?.x ?? 0, top: loupePos?.y ?? 0, width: LOUPE_PX, height: LOUPE_PX, display: loupePos ? 'block' : 'none' }}
      />

      <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-2 justify-between pointer-events-auto">
        <div className="flex gap-2">
          <button className={btn} onClick={onExit} title="Back to live camera"><Camera className="w-4 h-4" /><span className={btnLabel}>Live</span></button>
          <button className={btn} onClick={undo} disabled={!history.length || locked} title="Undo"><Undo2 className="w-4 h-4" /></button>
          <button className={btn} onClick={reset} disabled={locked} title="Reset points"><RotateCcw className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-2">
          <button
            className={`${btn} ${snap ? 'text-cyan-300' : 'text-gray-400'}`}
            onClick={() => setSnap((s) => !s)}
            title="Snap edge points to the nearest strong edge"
            aria-pressed={snap}
            aria-label="Snap to edge"
          >
            <Magnet className="w-4 h-4" /><span className={btnLabel}>Snap</span>
          </button>
          <button
            className={btn}
            onClick={() => setConvention((c) => NEXT_CONVENTION[c])}
            title="Interior / supplement / exterior"
            aria-label={`Angle convention: ${conventionLabel(convention)}. Activate to change.`}
          >
            <Repeat className="w-4 h-4" />
            {/* Convention stays identifiable on mobile: the label is short. */}
            <span className="text-xs sm:text-sm">{conventionLabel(convention)}</span>
          </button>
          <button
            className={`${btn} ${locked ? 'text-yellow-300' : ''}`}
            onClick={() => setLocked((l) => !l)}
            disabled={!measurement?.found}
            title="Lock result"
            aria-pressed={locked}
            aria-label={locked ? 'Unlock result' : 'Lock result'}
          >
            {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}<span className={btnLabel}>{locked ? 'Locked' : 'Lock'}</span>
          </button>
          <button className={btn} onClick={save} disabled={!measurement?.found} title="Save annotated photo" aria-label="Save annotated photo"><Download className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Industrial measurement readout: large high-contrast digits for workshop
          readability, plus explicit FROZEN / LOCKED status so a live reading is
          never confused with a frozen measurement. Presentation only — the
          numbers come from the unchanged AngleMeasurement contract. */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-3 py-2.5 text-center pointer-events-none border-t border-white/10">
        {nextPrompt !== -1 ? (
          <span className="font-mono text-cyan-300 text-lg">{PROMPTS[nextPrompt]}</span>
        ) : measurement?.found ? (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-300 bg-amber-400/15 border border-amber-300/40 rounded px-2 py-0.5">
                Frozen
              </span>
              {locked && (
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-lime-300 bg-lime-400/15 border border-lime-300/40 rounded px-2 py-0.5">
                  Locked
                </span>
              )}
              <span className="font-mono font-bold tabular-nums text-yellow-200 text-4xl md:text-5xl leading-none">
                {formatAngle(measurement.displayDeg)}
              </span>
            </div>
            <div className="hidden sm:block font-mono text-gray-400 text-xs md:text-sm">
              {conventionLabel(convention)} · interior {formatAngle(measurement.angleDeg)} · supplement{' '}
              {formatAngle(measurement.supplementDeg)} · 2D apparent · manual · snap {snap ? 'on' : 'off'}
            </div>
            <div className="sm:hidden font-mono text-gray-400 text-xs">
              {conventionLabel(convention)} · 2D apparent · snap {snap ? 'on' : 'off'}
            </div>
            {/* P2: warning meets 4.5:1 contrast (text-gray-300 on near-black). */}
            <p className="font-mono text-gray-300 text-[11px] mt-1 px-2">
              Verify both edge points before trusting the angle. Snap may select nearby features.
            </p>
          </div>
        ) : (
          <span className="font-mono text-yellow-400">{measurement?.reason}</span>
        )}
      </div>
    </div>
  );
};

export default ManualProtractor;
