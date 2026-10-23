import { bounds, type Drawing, type Operation } from './model';
export function surface(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}
export function context(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported by this WebView.');
  return ctx;
}
export function paint(target: HTMLCanvasElement, mask: HTMLCanvasElement, op: Operation) {
  const ctx = context(target);
  if (op.type === 'clear') {
    ctx.clearRect(0, 0, target.width, target.height);
    return;
  }
  const m = context(mask),
    s = op.style,
    p = op.points;
  m.clearRect(0, 0, mask.width, mask.height);
  m.lineCap = 'round';
  m.lineJoin = 'round';
  m.lineWidth = s.width;
  m.strokeStyle = s.color;
  m.fillStyle = s.fill;
  m.beginPath();
  if (op.type === 'pen' || op.type === 'eraser') {
    m.fillStyle = s.color;
    if (p.length === 1) {
      m.arc(p[0].x, p[0].y, s.width / 2, 0, Math.PI * 2);
      m.fill();
    } else {
      m.moveTo(p[0].x, p[0].y);
      for (let i = 1; i < p.length - 1; i++)
        m.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
      m.lineTo(p[p.length - 1].x, p[p.length - 1].y);
      m.stroke();
    }
  } else if (op.type === 'line') {
    m.moveTo(p[0].x, p[0].y);
    m.lineTo(p[1].x, p[1].y);
    m.stroke();
  } else {
    const b = bounds(p[0], p[1], s.constrained && op.type !== 'triangle');
    if (op.type === 'rectangle') m.rect(b.x, b.y, b.width, b.height);
    if (op.type === 'ellipse')
      m.ellipse(
        b.x + b.width / 2,
        b.y + b.height / 2,
        b.width / 2,
        b.height / 2,
        0,
        0,
        Math.PI * 2,
      );
    if (op.type === 'triangle') {
      m.moveTo(b.x + b.width / 2, b.y);
      m.lineTo(b.x + b.width, b.y + b.height);
      m.lineTo(b.x, b.y + b.height);
      m.closePath();
    }
    if (s.mode !== 'outline') m.fill();
    if (s.mode !== 'fill') m.stroke();
  }
  ctx.save();
  ctx.globalCompositeOperation = op.type === 'eraser' ? 'destination-out' : 'source-over';
  ctx.globalAlpha = op.type === 'eraser' ? 1 : s.opacity;
  ctx.drawImage(mask, 0, 0);
  ctx.restore();
}
export function replay(d: Drawing, target: HTMLCanvasElement, mask: HTMLCanvasElement) {
  context(target).clearRect(0, 0, d.width, d.height);
  for (const op of d.operations) paint(target, mask, op);
}
export function exportCanvas(d: Drawing) {
  const content = surface(d.width, d.height),
    mask = surface(d.width, d.height);
  replay(d, content, mask);
  const ctx = context(content);
  if (d.background !== 'transparent') {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = d.background;
    ctx.fillRect(0, 0, d.width, d.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  mask.width = 0;
  mask.height = 0;
  return content;
}
export function thumbnail(d: Drawing, source?: HTMLCanvasElement) {
  const full = source ?? exportCanvas(d),
    small = surface(240, Math.round((240 * d.height) / d.width));
  context(small).drawImage(full, 0, 0, small.width, small.height);
  if (!source) {
    full.width = 0;
    full.height = 0;
  }
  const url = small.toDataURL('image/png');
  small.width = 0;
  return url;
}
