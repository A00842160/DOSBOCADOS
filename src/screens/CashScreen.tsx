import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { currentDay, mutateDay, startDay } from '../db';
import { addSalida, openDay, removeSalida, SALIDA_KINDS, type SalidaKind } from '../domain/cash';
import { formatDateTime } from '../domain/ticket';
import { formatPrice } from '../menu';

const FONDO_CHIPS = [300, 500, 1000];

/** Encargado and owner: open the drawer with the fondo and record cash taken out. */
export default function CashScreen({ who }: { who: string }) {
  const day = useLiveQuery(async () => (await currentDay()) ?? null, []);
  const [fondo, setFondo] = useState('');
  const [kind, setKind] = useState<SalidaKind>('compra');
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');

  if (day === undefined) return null;

  if (!day) {
    const value = Number(fondo);
    return (
      <form
        className="new-order"
        onSubmit={(e) => {
          e.preventDefault();
          if (fondo !== '' && value >= 0) startDay(openDay(value, who));
        }}
      >
        <p className="category-note">
          Abre la caja al empezar el día. Todo lo que se cobre hasta el corte cuenta para este día.
        </p>
        <label>
          Fondo de caja (efectivo con el que empiezas)
          <input
            autoFocus
            inputMode="numeric"
            value={fondo}
            onChange={(e) => setFondo(e.target.value.replace(/\D/g, ''))}
            placeholder="Ej. 500"
          />
        </label>
        <div className="chips">
          {FONDO_CHIPS.map((n) => (
            <button type="button" key={n} className={value === n ? 'chip on' : 'chip'} onClick={() => setFondo(String(n))}>
              {formatPrice(n)}
            </button>
          ))}
        </div>
        <div className="form-actions start">
          <button type="submit" className="primary" disabled={fondo === ''}>
            Abrir caja
          </button>
        </div>
      </form>
    );
  }

  const salida = Number(amount);
  return (
    <div className="settings">
      <article className="product">
        <h2>Caja abierta</h2>
        <p className="product-description">
          Desde {formatDateTime(day.openedAt)}
          {day.openedBy ? ` por ${day.openedBy}` : ''} · Fondo {formatPrice(day.fondo)}
        </p>
      </article>

      <article className="product">
        <h2>Salida de caja</h2>
        <p className="product-description">Dinero que sale del cajón: compras del día, propinas o ventas que se retiran.</p>
        <form
          className="salida-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (salida <= 0) return;
            await mutateDay(day.id, (d) => addSalida(d, { kind, amount: salida, concept, by: who }));
            setAmount('');
            setConcept('');
          }}
        >
          <div className="segmented four">
            {SALIDA_KINDS.map((k) => (
              <button type="button" key={k.id} className={k.id === kind ? 'seg active' : 'seg'} onClick={() => setKind(k.id)}>
                {k.label}
              </button>
            ))}
          </div>
          <div className="staff-form">
            <input
              className="inline-input"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="$"
            />
            <input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Concepto, ej. Tortillas" />
            <button type="submit" className="primary" disabled={!(salida > 0)}>
              Registrar
            </button>
          </div>
        </form>
        {day.salidas.map((s) => (
          <div key={s.id} className="paid-row">
            <span>
              {SALIDA_KINDS.find((k) => k.id === s.kind)!.label}
              {s.concept ? ` · ${s.concept}` : ''}
              <span className="muted"> · {formatDateTime(s.at).slice(-5)}</span>
            </span>
            <span className="row-end">
              {formatPrice(s.amount)}
              <button className="secondary" onClick={() => mutateDay(day.id, (d) => removeSalida(d, s.id))}>
                Quitar
              </button>
            </span>
          </div>
        ))}
        {day.salidas.length > 0 && (
          <div className="paid-row total-row">
            <span>Total de salidas</span>
            <span>{formatPrice(day.salidas.reduce((sum, s) => sum + s.amount, 0))}</span>
          </div>
        )}
      </article>
    </div>
  );
}
