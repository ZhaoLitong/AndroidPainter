export type Point = { x: number; y: number };
export type Tool = 'pen' | 'eraser' | 'line' | 'rectangle' | 'ellipse' | 'triangle';
export type Style = {
  color: string;
  fill: string;
  opacity: number;
  width: number;
  mode: 'outline' | 'fill' | 'both';
  constrained: boolean;
};
export type Operation = { id: string; type: Tool | 'clear'; points: Point[]; style: Style };
export type Drawing = {
  schemaVersion: 1;
  rendererVersion: 1;
  id: string;
  name: string;
  needsDetails?: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
  width: number;
  height: number;
  background: string;
  operations: Operation[];
};
export const defaultStyle: Style = {
  color: '#20252b',
  fill: '#e3a45d',
  opacity: 1,
  width: 8,
  mode: 'outline',
  constrained: false,
};
export const limits = { operations: 5000, points: 250000, bytes: 20 * 1024 * 1024 };
export function uid() {
  return crypto.randomUUID();
}
export function createDrawing(
  name: string,
  width: number,
  height: number,
  background: string,
): Drawing {
  const now = new Date().toISOString();
  return validate({
    schemaVersion: 1,
    rendererVersion: 1,
    id: uid(),
    name: name.trim() || 'Untitled drawing',
    createdAt: now,
    updatedAt: now,
    revision: 0,
    width,
    height,
    background,
    operations: [],
  });
}
export function normalizeHex(value: string) {
  const hex = value.replace(/^#/, '');
  return /^[\da-f]{6}$/i.test(hex) ? '#' + hex.toLowerCase() : null;
}
export function bounds(a: Point, b: Point, constrained: boolean) {
  let dx = b.x - a.x,
    dy = b.y - a.y;
  if (constrained) {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    dx = (dx < 0 ? -1 : 1) * size;
    dy = (dy < 0 ? -1 : 1) * size;
  }
  return {
    x: Math.min(a.x, a.x + dx),
    y: Math.min(a.y, a.y + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}
export function validate(value: unknown): Drawing {
  const d = value as Drawing;
  if (!d || d.schemaVersion !== 1 || d.rendererVersion !== 1)
    throw new Error('Unsupported project version. The original file has not been changed.');
  if (
    !/^[a-zA-Z0-9-]{1,80}$/.test(d.id) ||
    typeof d.name !== 'string' ||
    (d.needsDetails !== undefined && typeof d.needsDetails !== 'boolean') ||
    d.name.length > 120 ||
    !Number.isInteger(d.revision) ||
    d.revision < 0 ||
    !Number.isFinite(Date.parse(d.createdAt)) ||
    !Number.isFinite(Date.parse(d.updatedAt))
  )
    throw new Error('Invalid project metadata.');
  if (
    ![d.width, d.height].every((n) => Number.isInteger(n) && n >= 256 && n <= 2048) ||
    !(d.background === 'transparent' || normalizeHex(d.background))
  )
    throw new Error('Invalid canvas settings.');
  if (!Array.isArray(d.operations) || d.operations.length > limits.operations)
    throw new Error('Project operation limit exceeded.');
  let count = 0;
  for (const op of d.operations) {
    if (
      !op ||
      typeof op.id !== 'string' ||
      !['pen', 'eraser', 'line', 'rectangle', 'ellipse', 'triangle', 'clear'].includes(op.type) ||
      !Array.isArray(op.points)
    )
      throw new Error('Invalid drawing operation.');
    count += op.points.length;
    if (
      op.points.some(
        (p) =>
          !p ||
          !Number.isFinite(p.x) ||
          !Number.isFinite(p.y) ||
          Math.abs(p.x) > 1000000 ||
          Math.abs(p.y) > 1000000,
      )
    )
      throw new Error('Invalid geometry.');
    if (
      (op.type === 'clear' && op.points.length !== 0) ||
      (['pen', 'eraser'].includes(op.type) && op.points.length < 1) ||
      (['line', 'rectangle', 'ellipse', 'triangle'].includes(op.type) && op.points.length !== 2)
    )
      throw new Error('Invalid point count.');
    const s = op.style;
    if (
      !s ||
      !normalizeHex(s.color) ||
      !normalizeHex(s.fill) ||
      !Number.isFinite(s.width) ||
      s.width < 1 ||
      s.width > (op.type === 'eraser' ? 256 : 128) ||
      !Number.isFinite(s.opacity) ||
      s.opacity < 0 ||
      s.opacity > 1 ||
      !['outline', 'fill', 'both'].includes(s.mode) ||
      typeof s.constrained !== 'boolean'
    )
      throw new Error('Invalid tool settings.');
  }
  if (count > limits.points || new Blob([JSON.stringify(d)]).size > limits.bytes)
    throw new Error('Project limit reached. Export your drawing or undo to free space.');
  return d;
}
export function changed(d: Drawing, operations = d.operations): Drawing {
  return { ...d, operations, revision: d.revision + 1, updatedAt: new Date().toISOString() };
}
