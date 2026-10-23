import { useRef, type PointerEvent } from 'react';
import { t } from '../i18n';

export function toHsv(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const v = Math.max(r, g, b),
    delta = v - Math.min(r, g, b);
  const h =
    delta === 0
      ? 0
      : 60 * (v === r ? (g - b) / delta : v === g ? (b - r) / delta + 2 : (r - g) / delta + 4);
  return { h: (h + 360) % 360, s: v === 0 ? 0 : delta / v, v };
}

export function toHex(h: number, s: number, v: number) {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1))))
      .toString(16)
      .padStart(2, '0');
  };
  return '#' + channel(5) + channel(3) + channel(1);
}

export function ColorWheel({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const remembered = useRef({ h: 0, s: 0 });
  const hsv = toHsv(value);
  const h = hsv.s > 0 ? hsv.h : remembered.current.h;
  const s = hsv.v > 0 ? hsv.s : remembered.current.s;
  const update = (hue: number, saturation: number, brightness: number) => {
    remembered.current = { h: hue, s: saturation };
    onChange(toHex(hue, saturation, brightness));
  };
  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const y = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    update(
      ((Math.atan2(y, x) * 180) / Math.PI + 450) % 360,
      Math.min(1, Math.hypot(x, y)),
      hsv.v || 1,
    );
  };
  return (
    <div className="color-wheel-control">
      <div
        className="color-wheel"
        aria-label={t('Color wheel')}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pick(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) pick(event);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            pick(event);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        <span className="color-wheel-shade" style={{ opacity: 1 - hsv.v }} />
        <span
          className="color-wheel-marker"
          style={{
            left: `${50 + 50 * s * Math.sin((h * Math.PI) / 180)}%`,
            top: `${50 - 50 * s * Math.cos((h * Math.PI) / 180)}%`,
            background: value,
          }}
        />
      </div>
      <label className="field">
        {t('Hue')}
        <input
          aria-label={t('Hue')}
          type="range"
          min="0"
          max="359"
          value={Math.round(h) % 360}
          onChange={(e) => update(+e.target.value, s, hsv.v)}
        />
      </label>
      <label className="field">
        {t('Saturation')}
        <input
          aria-label={t('Saturation')}
          type="range"
          min="0"
          max="100"
          value={Math.round(s * 100)}
          onChange={(e) => update(h, +e.target.value / 100, hsv.v)}
        />
      </label>
      <label className="field">
        {t('Brightness')}
        <input
          aria-label={t('Brightness')}
          type="range"
          min="0"
          max="100"
          value={Math.round(hsv.v * 100)}
          onChange={(e) => update(h, s, +e.target.value / 100)}
        />
      </label>
    </div>
  );
}
