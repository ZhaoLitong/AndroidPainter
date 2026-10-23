import { describe, expect, it } from 'vitest';
import {
  bounds,
  changed,
  createDrawing,
  defaultStyle,
  normalizeHex,
  validate,
  type Operation,
} from '../src/drawing/model';
const pen: Operation = { id: 'p', type: 'pen', points: [{ x: 10, y: 20 }], style: defaultStyle };
describe('document validation', () => {
  it('normalizes valid HEX and rejects partial or unsafe colors', () => {
    expect(normalizeHex('aBcD09')).toBe('#abcd09');
    expect(normalizeHex('#fff')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
  });
  it('constrains geometry in reverse drag directions', () => {
    expect(bounds({ x: 100, y: 100 }, { x: 80, y: 60 }, true)).toEqual({
      x: 60,
      y: 60,
      width: 40,
      height: 40,
    });
  });
  it('rejects invalid geometry, styles and dimensions before rendering', () => {
    const d = createDrawing('Test', 256, 256, 'transparent');
    expect(() => validate({ ...d, width: 8192 })).toThrow();
    expect(() =>
      validate({ ...d, operations: [{ ...pen, points: [{ x: NaN, y: 1 }] }] }),
    ).toThrow();
    expect(() =>
      validate({ ...d, operations: [{ ...pen, style: { ...defaultStyle, opacity: 2 } }] }),
    ).toThrow();
    expect(() => validate({ ...d, operations: [{ ...pen, type: 'rectangle' }] })).toThrow();
    expect(() => validate({ ...d, schemaVersion: 2 })).toThrow('Unsupported');
  });
  it('enforces retained point budgets', () => {
    const d = createDrawing('Test', 256, 256, '#ffffff');
    expect(() =>
      validate({
        ...d,
        operations: [{ ...pen, points: Array.from({ length: 250001 }, () => ({ x: 1, y: 1 })) }],
      }),
    ).toThrow('limit');
  });
  it('creates immutable revisions', () => {
    const d = createDrawing('Test', 256, 256, '#ffffff'),
      next = changed(d, [pen]);
    expect(d.operations).toHaveLength(0);
    expect(next.revision).toBe(1);
    expect(next.operations).toHaveLength(1);
  });
});
