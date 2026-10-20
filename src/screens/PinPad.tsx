import { useState } from 'react';

interface Props {
  title: string;
  /** PIN lengths to try, shortest first: 4 tries the encargado PIN, 6 the owner's. */
  lengths: number[];
  /** Resolves to an error message, or null when the PIN was accepted. */
  onSubmit: (pin: string) => Promise<string | null>;
  onCancel?: () => void;
  hint?: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function PinPad({ title, lengths, onSubmit, onCancel, hint }: Props) {
  const length = Math.max(...lengths);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function press(key: string) {
    if (busy) return;
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (!key || pin.length >= length) return;
    const next = pin + key;
    setPin(next);
    setError(null);
    if (lengths.includes(next.length)) {
      setBusy(true);
      const message = await onSubmit(next);
      setBusy(false);
      // A shorter PIN that didn't match may still be the start of a longer one.
      if (message && next.length === length) {
        setError(message);
        setPin('');
      }
    }
  }

  return (
    <div className="pinpad">
      <h2>{title}</h2>
      {hint && <p className="hint">{hint}</p>}
      <div className="pin-dots">
        {Array.from({ length }, (_, i) => (
          <span key={i} className={i < pin.length ? 'dot on' : 'dot'} />
        ))}
      </div>
      <p className="pin-error">{error ?? ' '}</p>
      <div className="pin-keys">
        {KEYS.map((key, i) =>
          key ? (
            <button key={i} className="pin-key" onClick={() => press(key)}>
              {key}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
      {onCancel && (
        <button className="secondary" onClick={onCancel}>
          Cancelar
        </button>
      )}
    </div>
  );
}
