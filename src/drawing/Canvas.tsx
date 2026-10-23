import { t } from '../i18n';
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { context, paint, replay, surface } from './renderer';
import {
  limits,
  uid,
  type Drawing,
  type Operation,
  type Point,
  type Style,
  type Tool,
} from './model';
export type CanvasHandle = { snapshot: () => HTMLCanvasElement };
type Props = {
  onMeasure: (width: number, height: number) => void;
  canvasHandle: RefObject<CanvasHandle | null>;
  document: Drawing;
  tool: Tool;
  style: Style;
  fitToken: number;
  onCommit: (op: Operation) => void;
  onError: (message: string) => void;
};
export function DrawingCanvas(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    latest = useRef(props),
    redraw = useRef<() => void>(() => {}),
    fit = useRef<() => void>(() => {});
  latest.current = props;
  useLayoutEffect(() => {
    const container = host.current!,
      view = canvas.current!,
      d = latest.current.document;
    const area = container.getBoundingClientRect();
    if (area.width > 0 && area.height > 0) latest.current.onMeasure(area.width, area.height);
    const committed = surface(d.width, d.height),
      work = surface(d.width, d.height),
      mask = surface(d.width, d.height);
    let active: Operation | null = null,
      navigation = false,
      frame = 0,
      scale = 1,
      base = 1,
      x = 0,
      y = 0,
      vw = 1,
      vh = 1,
      previousPair: { mid: Point; distance: number } | null = null;
    let rendered: Operation[] = [];
    const pointers = new Map<number, Point>();
    const local = (event: PointerEvent): Point => {
      const r = container.getBoundingClientRect();
      return { x: event.clientX - r.left, y: event.clientY - r.top };
    };
    const toDocument = (p: Point) => ({ x: (p.x - x) / scale, y: (p.y - y) / scale });
    const pair = () => {
      const [a, b] = [...pointers.values()];
      return {
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      };
    };
    function draw() {
      frame = 0;
      const target = context(view);
      target.clearRect(0, 0, view.width, view.height);
      const c = context(work);
      c.clearRect(0, 0, d.width, d.height);
      c.drawImage(committed, 0, 0);
      if (active) paint(work, mask, active);
      target.save();
      target.scale(view.width / vw, view.height / vh);
      target.translate(x, y);
      target.scale(scale, scale);
      if (d.background !== 'transparent') {
        target.fillStyle = d.background;
        target.fillRect(0, 0, d.width, d.height);
      } else {
        target.fillStyle = '#fff';
        target.fillRect(0, 0, d.width, d.height);
        target.fillStyle = '#e5e4e1';
        const tile = 20 / scale;
        for (let row = 0; row < d.height / tile; row++)
          for (let col = 0; col < d.width / tile; col++)
            if ((row + col) % 2 === 0)
              target.fillRect(
                col * tile,
                row * tile,
                Math.min(tile, d.width - col * tile),
                Math.min(tile, d.height - row * tile),
              );
      }
      target.drawImage(work, 0, 0);
      target.strokeStyle = '#00000018';
      target.lineWidth = 1 / scale;
      target.strokeRect(0, 0, d.width, d.height);
      target.restore();
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(draw);
    }
    function fitCanvas() {
      base = Math.min(vw / d.width, vh / d.height);
      base = Math.max(0.01, base);
      scale = base;
      x = (vw - d.width * scale) / 2;
      y = (vh - d.height * scale) / 2;
      schedule();
    }
    function cancel() {
      active = null;
      pointers.clear();
      navigation = false;
      previousPair = null;
      schedule();
    }
    function down(e: PointerEvent) {
      if (e.button !== 0) return;
      e.preventDefault();
      view.setPointerCapture(e.pointerId);
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (pointers.size >= 2) {
        active = null;
        navigation = true;
        previousPair = pair();
        schedule();
        return;
      }
      if (navigation) return;
      const point = toDocument(p);
      if (point.x < 0 || point.y < 0 || point.x > d.width || point.y > d.height) return;
      const { tool, style } = latest.current;
      active = {
        id: uid(),
        type: tool,
        style: { ...style },
        points: tool === 'pen' || tool === 'eraser' ? [point] : [point, point],
      };
      schedule();
    }
    function append(e: PointerEvent) {
      if (!active) return;
      if (active.type === 'pen' || active.type === 'eraser') {
        const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
        for (const event of events.length ? events : [e]) {
          const point = toDocument(local(event)),
            last = active.points[active.points.length - 1];
          if (Math.hypot(point.x - last.x, point.y - last.y) >= 0.4) active.points.push(point);
        }
        if (active.points.length > limits.points) {
          active = null;
          navigation = true;
          latest.current.onError('Stroke limit reached. Try a shorter stroke.');
        }
      } else active.points[1] = toDocument(local(e));
    }
    function move(e: PointerEvent) {
      if (!pointers.has(e.pointerId)) return;
      e.preventDefault();
      pointers.set(e.pointerId, local(e));
      if (navigation && pointers.size >= 2) {
        const next = pair();
        if (previousPair) {
          const anchor = toDocument(previousPair.mid);
          scale = Math.max(
            base * 0.25,
            Math.min(base * 8, (scale * next.distance) / previousPair.distance),
          );
          x = next.mid.x - anchor.x * scale;
          y = next.mid.y - anchor.y * scale;
          x = Math.min(vw - 24, Math.max(24 - d.width * scale, x));
          y = Math.min(vh - 24, Math.max(24 - d.height * scale, y));
        }
        previousPair = next;
        schedule();
        return;
      }
      if (!navigation) {
        append(e);
        schedule();
      }
    }
    function up(e: PointerEvent) {
      if (!pointers.has(e.pointerId)) return;
      if (active && !navigation) {
        append(e);
        if (active) {
          const op = active;
          active = null;
          if (
            op.type === 'pen' ||
            op.type === 'eraser' ||
            Math.hypot(op.points[1].x - op.points[0].x, op.points[1].y - op.points[0].y) * scale >=
              2
          )
            latest.current.onCommit(op);
        }
      }
      pointers.delete(e.pointerId);
      if (pointers.size < 2) previousPair = null;
      if (!pointers.size) navigation = false;
      schedule();
    }
    function refresh() {
      active = null;
      const current = latest.current.document;
      if (
        current.operations.length === rendered.length + 1 &&
        rendered.every((op, i) => current.operations[i] === op)
      )
        paint(committed, mask, current.operations[current.operations.length - 1]);
      else replay(current, committed, mask);
      rendered = current.operations;
      schedule();
    }
    redraw.current = refresh;
    fit.current = fitCanvas;
    props.canvasHandle.current = {
      snapshot() {
        // Reuse a working surface rather than allocating more full-size export bitmaps.
        if (rendered !== latest.current.document.operations) refresh();
        const ctx = context(work);
        ctx.clearRect(0, 0, d.width, d.height);
        if (d.background !== 'transparent') {
          ctx.fillStyle = d.background;
          ctx.fillRect(0, 0, d.width, d.height);
        }
        ctx.drawImage(committed, 0, 0);
        schedule();
        return work;
      },
    };
    refresh();
    const resize = new ResizeObserver(() => {
      const r = container.getBoundingClientRect();
      vw = Math.max(1, r.width);
      vh = Math.max(1, r.height);
      const ratio = Math.min(1, Math.sqrt(4_000_000 / (vw * vh)));
      view.width = Math.max(1, Math.floor(vw * ratio));
      view.height = Math.max(1, Math.floor(vh * ratio));
      fitCanvas();
    });
    resize.observe(container);
    view.addEventListener('pointerdown', down);
    view.addEventListener('pointermove', move);
    view.addEventListener('pointerup', up);
    view.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', cancel);
    return () => {
      props.canvasHandle.current = null;
      cancelAnimationFrame(frame);
      resize.disconnect();
      view.removeEventListener('pointerdown', down);
      view.removeEventListener('pointermove', move);
      view.removeEventListener('pointerup', up);
      view.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', cancel);
      for (const c of [committed, work, mask]) {
        c.width = 0;
        c.height = 0;
      }
    };
  }, [props.document.id, props.document.width, props.document.height]);
  useEffect(() => redraw.current(), [props.document.revision]);
  useEffect(() => fit.current(), [props.fitToken]);
  return (
    <div className="canvas-host" ref={host}>
      <canvas
        ref={canvas}
        aria-label={t('Drawing canvas. Use one finger to draw and two fingers to pan and zoom.')}
      />
      <span className="canvas-note">
        {props.document.width} × {props.document.height}
        {t('· Two fingers to pan & zoom')}{' '}
      </span>
    </div>
  );
}
