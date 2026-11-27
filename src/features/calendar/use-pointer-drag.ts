/**
 * Mouse drag helper for the web. Tracks a drag via window listeners so the
 * pointer can leave the element. Touch input never starts a drag (it scrolls);
 * a touch tap is reported through onEnd with moved=false.
 *
 * Native (Android/iOS) drag will use react-native-gesture-handler in M6.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export interface Pt {
  x: number;
  y: number;
}

interface Options<D> {
  threshold?: number;
  onMove?: (pt: Pt, start: Pt, data: D) => void;
  onEnd: (pt: Pt, start: Pt, data: D, moved: boolean) => void;
  onCancel?: (data: D) => void;
}

export function pointFrom(e: { nativeEvent: unknown }): Pt & { button: number; pointerType: string } {
  const n = e.nativeEvent as { clientX: number; clientY: number; button?: number; pointerType?: string };
  return { x: n.clientX, y: n.clientY, button: n.button ?? 0, pointerType: n.pointerType ?? 'mouse' };
}

export function usePointerDrag<D>(opts: Options<D>) {
  const optsRef = useRef(opts);
  // Latest callbacks, updated after each render (handlers only run later, on pointer events).
  useEffect(() => {
    optsRef.current = opts;
  });
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  return useCallback((e: { nativeEvent: unknown; stopPropagation?: () => void }, data: D) => {
    if (Platform.OS !== 'web') return;
    const p = pointFrom(e);
    if (p.button !== 0) return;
    e.stopPropagation?.();
    cleanupRef.current?.();
    const start = { x: p.x, y: p.y };
    const isMouse = p.pointerType === 'mouse' || p.pointerType === 'pen';
    const threshold = optsRef.current.threshold ?? 4;
    let moved = false;

    const move = (ev: PointerEvent) => {
      if (!isMouse) {
        // A touch that moves is a scroll: abandon.
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 10) cancel();
        return;
      }
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < threshold) return;
      moved = true;
      ev.preventDefault();
      optsRef.current.onMove?.({ x: ev.clientX, y: ev.clientY }, start, data);
    };
    const up = (ev: PointerEvent) => {
      cleanup();
      optsRef.current.onEnd({ x: ev.clientX, y: ev.clientY }, start, data, moved);
    };
    const cancel = () => {
      cleanup();
      optsRef.current.onCancel?.(data);
    };
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') cancel();
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
      document.body.style.userSelect = '';
      cleanupRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    if (isMouse) document.body.style.userSelect = 'none';
    cleanupRef.current = cleanup;
  }, []);
}

/** Bounding rect of a RN Web view ref. */
export function rectOf(ref: { current: unknown }): DOMRect | null {
  const el = ref.current as { getBoundingClientRect?: () => DOMRect } | null;
  return el?.getBoundingClientRect ? el.getBoundingClientRect() : null;
}
