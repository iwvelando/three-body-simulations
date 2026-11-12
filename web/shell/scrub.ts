import { useRef, type PointerEvent } from "react";

// Pointer handlers for a chart that moves the page to wherever it is
// pointed at. A mouse or a pen scrubs while pressed; a mouse that only
// passes over a chart on its way elsewhere moves nothing, since the chart
// and what it would move are seldom on screen together. A finger is
// different again, because a finger
// also scrolls the page, and a swipe that only passes over a chart must
// not move anything. So a touch scrubs when it is a tap, or once it has
// plainly set off sideways; the chart lets the browser keep vertical
// swipes (touch-action: pan-y), which end the touch before either.
const sideways = 8;

export function useScrub(point: (clientX: number) => void) {
  // The touch under way, kept across the renders its own scrubbing causes.
  const touch = useRef<{
    id: number;
    x: number;
    y: number;
    dragging: boolean;
  } | null>(null);
  return {
    onPointerDown(e: PointerEvent<Element>) {
      e.currentTarget.setPointerCapture(e.pointerId);
      if (e.pointerType !== "touch") return point(e.clientX);
      touch.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        dragging: false,
      };
    },
    onPointerMove(e: PointerEvent<Element>) {
      if (e.pointerType !== "touch") {
        if (e.buttons > 0) point(e.clientX);
        return;
      }
      const start = touch.current;
      if (!start || start.id !== e.pointerId) return;
      const dx = Math.abs(e.clientX - start.x),
        dy = Math.abs(e.clientY - start.y);
      if (!start.dragging && dx > sideways && dx > dy) start.dragging = true;
      if (start.dragging) point(e.clientX);
    },
    onPointerUp(e: PointerEvent<Element>) {
      const start = touch.current;
      if (e.pointerType !== "touch" || !start || start.id !== e.pointerId)
        return;
      const tap =
        !start.dragging &&
        Math.hypot(e.clientX - start.x, e.clientY - start.y) <= sideways;
      touch.current = null;
      if (tap) point(e.clientX);
    },
    onPointerCancel() {
      touch.current = null;
    },
  };
}
