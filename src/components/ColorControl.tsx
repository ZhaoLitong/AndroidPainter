import { t } from '../i18n';
import { useEffect, useState } from 'react';
import { normalizeHex } from '../drawing/model';
export function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const [text, setText] = useState(value),
    [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(value);
    setInvalid(false);
  }, [value]);
  return (
    <div className="color-control">
      <label>
        {label}
        <input
          aria-label={label + t(' picker')}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <label className="hex-field">
        HEX
        <input
          aria-label={label + ' HEX'}
          maxLength={7}
          value={text}
          aria-invalid={invalid}
          onChange={(e) => {
            setText(e.target.value);
            const color = normalizeHex(e.target.value);
            setInvalid(!color);
            if (color) onChange(color);
          }}
          onBlur={() => {
            if (!normalizeHex(text)) {
              setText(value);
              setInvalid(false);
            }
          }}
        />
      </label>
    </div>
  );
}
