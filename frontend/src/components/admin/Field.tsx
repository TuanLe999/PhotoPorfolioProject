/** Các control dùng lại trong sidebar và inspector. */

import type { ReactNode } from 'react';
import type { Option } from '../../lib/catalog';

interface BaseProps {
  label?: string;
  hint?: string;
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="f__row">{children}</div>;
}

export function GroupTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="adm-group__title">
      <span>{children}</span>
      {action}
    </div>
  );
}

function Wrapper({ label, hint, right, children }: BaseProps & { right?: ReactNode; children: ReactNode }) {
  return (
    <div className="f">
      {label && (
        <div className="f__label">
          <span>{label}</span>
          {right}
        </div>
      )}
      {children}
      {hint && <div className="adm-hint" style={{ marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

export function TextField({
  label,
  hint,
  value,
  placeholder,
  onChange,
}: BaseProps & { value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <Wrapper label={label} hint={hint}>
      <input className="inp" type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Wrapper>
  );
}

export function TextArea({
  label,
  hint,
  value,
  rows = 4,
  onChange,
}: BaseProps & { value: string; rows?: number; onChange: (value: string) => void }) {
  return (
    <Wrapper label={label} hint={hint}>
      <textarea className="ta" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </Wrapper>
  );
}

export function RangeField({
  label,
  hint,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange,
}: BaseProps & {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <Wrapper label={label} hint={hint} right={<b>{`${round(value)}${unit}`}</b>}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Wrapper>
  );
}

const round = (n: number) => (Number.isInteger(n) ? n : Math.round(n * 100) / 100);

export function SelectField<T extends string | number>({
  label,
  hint,
  value,
  options,
  onChange,
}: BaseProps & { value: T | string; options: Option<T>[]; onChange: (value: string) => void }) {
  return (
    <Wrapper label={label} hint={hint}>
      <select className="sel" value={String(value)} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option value={String(option.id)} key={String(option.id)}>
            {option.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

export function ColorField({
  label,
  hint,
  value,
  onChange,
}: BaseProps & { value: string; onChange: (value: string) => void }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#888888';
  return (
    <Wrapper label={label} hint={hint}>
      <div className="swatch-row">
        <input type="color" value={safe} onChange={(e) => onChange(e.target.value)} />
        <input className="inp" type="text" spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Wrapper>
  );
}

export function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="f">
      <label className="chk">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    </div>
  );
}

export function SegField<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: BaseProps & { value: T; options: Option<T>[]; onChange: (value: T) => void }) {
  return (
    <Wrapper label={label} hint={hint}>
      <div className="seg">
        {options.map((option) => (
          <button
            type="button"
            key={String(option.id)}
            className={option.id === value ? 'is-on' : undefined}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Wrapper>
  );
}
