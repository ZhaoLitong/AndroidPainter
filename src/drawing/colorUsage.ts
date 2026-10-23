import { normalizeHex, type Operation } from './model';

export type ColorUsage = { color: string; opacity: number; count: number };
export const colorHistoryLimit = 20;

// Keep all counts so colors outside the visible top 20 can climb back into it.
// Stable sorting preserves recency order when usage counts tie.
export function readColorUsage(value: unknown): ColorUsage[] {
  if (!Array.isArray(value)) return [];
  const result: ColorUsage[] = [];
  for (const item of value) {
    if (!item || typeof item.color !== 'string') continue;
    const color = normalizeHex(item.color);
    if (!color || !Number.isFinite(item.opacity) || item.opacity < 0 || item.opacity > 1) continue;
    const count = item.count === undefined ? 1 : item.count;
    if (!Number.isSafeInteger(count) || count < 1) continue;
    const existing = result.find((r) => r.color === color && r.opacity === item.opacity);
    if (existing) existing.count += count;
    else result.push({ color, opacity: item.opacity, count });
  }
  return result.sort((a, b) => b.count - a.count);
}

export function recordColorUsage(history: ColorUsage[], op: Operation): ColorUsage[] {
  if (op.type === 'eraser' || op.type === 'clear' || op.style.opacity === 0) return history;
  const shape = ['rectangle', 'ellipse', 'triangle'].includes(op.type);
  const colors = new Set<string>();
  if (!shape || op.style.mode !== 'fill') colors.add(op.style.color.toLowerCase());
  if (shape && op.style.mode !== 'outline') colors.add(op.style.fill.toLowerCase());
  let next = history;
  for (const color of colors) {
    const opacity = op.style.opacity;
    const existing = next.find((r) => r.color === color && r.opacity === opacity);
    next = [
      { color, opacity, count: (existing?.count ?? 0) + 1 },
      ...next.filter((r) => r !== existing),
    ];
  }
  return next.sort((a, b) => b.count - a.count);
}
