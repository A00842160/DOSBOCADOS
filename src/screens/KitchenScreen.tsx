import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import type { Navigate } from '../App';
import { mutateOrder, openOrders } from '../db';
import { kitchenQueue, LATE_MINUTES, prepSummary, waitLevel, WARN_MINUTES } from '../domain/kitchen';
import { markServed, orderLabel } from '../domain/order';

/** Everything waiting in the kitchen, oldest first, for the rush. */
export default function KitchenScreen({ navigate }: { navigate: Navigate }) {
  const orders = useLiveQuery(openOrders, [], []);
  const now = useNow();
  const rounds = kitchenQueue(orders, now);
  const prep = prepSummary(rounds);

  if (rounds.length === 0) {
    return <p className="placeholder">No hay nada en cocina. Lo que mandes a cocina aparece aquí.</p>;
  }

  return (
    <div className="kitchen">
      <article className="product prep">
        <h2>Por preparar</h2>
        <div className="prep-list">
          {prep.map((item) => (
            <div key={item.name} className="prep-item">
              <span className="prep-qty">{item.qty}</span>
              <span>
                {item.name}
                {item.notes.length > 0 && <span className="line-notes">{item.notes.join(' · ')}</span>}
              </span>
            </div>
          ))}
        </div>
      </article>
      <p className="hint">
        Amarillo a los {WARN_MINUTES} minutos, rojo a los {LATE_MINUTES}. Toca el nombre para abrir el pedido.
      </p>
      <div className="kitchen-grid">
        {rounds.map((r) => (
          <article key={`${r.order.id}-${r.batch}`} className={`product round ${waitLevel(r.minutes)}`}>
            <button
              className="round-head"
              onClick={() => navigate({ name: 'pedido', orderId: r.order.id, back: { name: 'cocina' } })}
            >
              <span>
                {orderLabel(r.order)}
                {r.order.batches > 1 && <span className="muted"> · ronda {r.batch}</span>}
              </span>
              <span className="round-time">{r.minutes} min</span>
            </button>
            <div className="round-lines">
              {r.lines.map((l) => (
                <div key={l.id} className="round-line">
                  <span className="prep-qty">{l.qty}</span>
                  <span>
                    {l.name}
                    {(l.mods.length > 0 || l.note) && (
                      <span className="line-notes">{[...l.mods, l.note].filter(Boolean).join(' · ')}</span>
                    )}
                    {l.changed && <span className="line-notes">Cambió, avisar a cocina</span>}
                  </span>
                </div>
              ))}
            </div>
            <button
              className="primary"
              onClick={() => mutateOrder(r.order.id, (o) => markServed(o, Date.now(), r.batch))}
            >
              Ya salió
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

/** The current time, refreshed every 20 seconds so waiting minutes keep counting. */
export function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
