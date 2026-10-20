import { useState } from 'react';

/** A text box that saves when it loses focus or on Enter, and shows the stored value otherwise. */
export default function CommitInput({
  value,
  onCommit,
  numeric,
  decimal,
  placeholder,
  className,
}: {
  value: string;
  onCommit: (text: string) => unknown;
  numeric?: boolean;
  /** Allows a decimal point, for amounts like 2.5 kg. */
  decimal?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <input
      className={className}
      value={draft ?? value}
      placeholder={placeholder}
      inputMode={decimal ? 'decimal' : numeric ? 'numeric' : undefined}
      onChange={(e) =>
        setDraft(decimal ? decimalText(e.target.value) : numeric ? e.target.value.replace(/\D/g, '') : e.target.value)
      }
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

/** Keeps digits and a single decimal point. */
export function decimalText(text: string): string {
  const clean = text.replace(',', '.').replace(/[^\d.]/g, '');
  const [whole, ...rest] = clean.split('.');
  return rest.length ? `${whole}.${rest.join('')}` : whole;
}
