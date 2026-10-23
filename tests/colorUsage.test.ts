import { describe, expect, it } from 'vitest';
import { colorHistoryLimit, readColorUsage, recordColorUsage } from '../src/drawing/colorUsage';
import { defaultStyle, type Operation } from '../src/drawing/model';

const pen: Operation = { id: 'p', type: 'pen', points: [{ x: 1, y: 1 }], style: defaultStyle };
describe('most used colors', () => {
  it('ranks frequency before recency and preserves counts across reloads', () => {
    let history = recordColorUsage([], pen);
    history = recordColorUsage(history, pen);
    const other = { ...pen, style: { ...defaultStyle, color: '#abcdef' } };
    history = recordColorUsage(history, other);
    expect(history[0].color).toBe(defaultStyle.color);
    history = recordColorUsage(readColorUsage(JSON.parse(JSON.stringify(history))), other);
    expect(history[0]).toEqual({ color: '#abcdef', opacity: 1, count: 2 });
  });
  it('retains counts beyond the 20 displayed colors', () => {
    let history = recordColorUsage([], pen);
    for (let i = 0; i < 25; i++)
      history = recordColorUsage(history, {
        ...pen,
        style: { ...defaultStyle, color: '#' + i.toString(16).padStart(6, '0') },
      });
    expect(history.slice(0, colorHistoryLimit)).toHaveLength(20);
    history = recordColorUsage(history, pen);
    expect(history[0]).toEqual({ color: defaultStyle.color, opacity: 1, count: 2 });
  });
  it('counts only colors actually painted and deduplicates matching fill and outline', () => {
    const shape: Operation = {
      ...pen,
      type: 'rectangle',
      style: { ...defaultStyle, mode: 'fill' },
    };
    expect(recordColorUsage([], shape).map((r) => r.color)).toEqual([defaultStyle.fill]);
    expect(
      recordColorUsage([], { ...shape, style: { ...shape.style, mode: 'both' } }),
    ).toHaveLength(2);
    expect(
      recordColorUsage([], {
        ...shape,
        style: { ...shape.style, mode: 'both', fill: defaultStyle.color },
      })[0].count,
    ).toBe(1);
    for (const type of ['eraser', 'clear'] as const)
      expect(recordColorUsage([], { ...pen, type })).toEqual([]);
    expect(recordColorUsage([], { ...pen, style: { ...defaultStyle, opacity: 0 } })).toEqual([]);
  });
  it('migrates legacy entries, normalizes colors and ignores malformed data', () => {
    expect(
      readColorUsage([
        null,
        { color: '#ABCDEF', opacity: 0.5 },
        { color: '#abcdef', opacity: 1 },
        { color: '#123456', opacity: 1, count: -1 },
      ]),
    ).toEqual([
      { color: '#abcdef', opacity: 0.5, count: 1 },
      { color: '#abcdef', opacity: 1, count: 1 },
    ]);
  });
});
