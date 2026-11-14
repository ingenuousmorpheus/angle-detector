/**
 * pointerGuard.test.ts — Codex PASS WITH CONDITIONS regression.
 *
 * Concern: `onPointerDown` checked `dragIndex` (React state) but not the
 * synchronously-updated `activePointerId` ref. Two pointerdowns firing before
 * the rerender would both see `dragIndex === null`, letting the second pointer
 * steal the drag and move the wrong point.
 *
 * Fix: `canStartPointerDrag` requires the ref to be null as well. The ref
 * updates synchronously, so the race is closed.
 */
import { describe, expect, it } from 'vitest';
import { canStartPointerDrag } from '../src/render/ManualProtractor';

describe('canStartPointerDrag', () => {
  it('allows the first pointerdown', () => {
    expect(canStartPointerDrag(false, null, null)).toBe(true);
  });

  it('blocks a second pointerdown before rerender (the race)', () => {
    // Pointer A went down: ref set synchronously, but React state
    // (dragIndex) has not updated yet — still null.
    const activePointerId: number | null = 7; // pointer A, set synchronously
    const dragIndex: number | null = null; // stale: rerender hasn't happened
    expect(canStartPointerDrag(false, dragIndex, activePointerId)).toBe(false);
  });

  it('blocks during an active drag (after rerender)', () => {
    expect(canStartPointerDrag(false, 0, 7)).toBe(false);
  });

  it('blocks when locked', () => {
    expect(canStartPointerDrag(true, null, null)).toBe(false);
  });

  it('allows a new drag after the previous pointer released', () => {
    // onPointerUp cleared the ref and state.
    expect(canStartPointerDrag(false, null, null)).toBe(true);
  });
});

describe('race simulation: two rapid pointerdowns', () => {
  it('the original pointer retains control; the second cannot hijack', () => {
    // Simulate component locals across two synchronous pointerdown events.
    let dragIndex: number | null = null; // React state (stale until rerender)
    let activePointerId: number | null = null; // ref (synchronous)
    const acquiredBy: number[] = [];

    const pointerDown = (pointerId: number) => {
      if (!canStartPointerDrag(false, dragIndex, activePointerId)) return false;
      activePointerId = pointerId; // synchronous, like the ref
      acquiredBy.push(pointerId);
      // setDragIndex(index) is queued; dragIndex stays null until rerender.
      return true;
    };

    // Two pointerdowns in the same task, no rerender between them.
    expect(pointerDown(7)).toBe(true); // pointer A acquires
    expect(pointerDown(9)).toBe(false); // pointer B rejected
    expect(acquiredBy).toEqual([7]);
    expect(activePointerId).toBe(7);

    // After release, a new pointer may start.
    activePointerId = null;
    dragIndex = null;
    expect(pointerDown(9)).toBe(true);
    expect(acquiredBy).toEqual([7, 9]);
  });
});
