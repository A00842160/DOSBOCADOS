import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { currentDay, db, mutateDay, recentDays } from '../db';
import { closeDay, corte, SALIDA_KINDS, type Day } from '../domain/cash';
import { CHANNELS, isPlatform } from '../domain/order';
import { METHODS } from '../domain/payment';
import { corteTicket, formatDateTime } from '../domain/ticket';
import { formatPrice } from '../menu';
import TicketDialog from './TicketDialog';

/** Owner only: what the day sold, the cash that should be in the drawer, and closing the day. */
export default function CorteScreen({ who }: { who: string }) {
  const day = useLiveQuery(async () => (await currentDay()) ?? null, []);
  const orders = useLiveQuery(() => db.orders.toArray(), [], []);
  const history = useLiveQuery(() => recentDays(), [], []);
  const [counted, setCounted] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [showing, setShowing] = useState<Day | null>(null);

  if (day === undefined) return null;

  const closed = history.filter((d) => d.closedAt);
  const dialog = showing && (
    <TicketDialog title="Corte de caja" lines={corteTicket(showing, corte(showing, orders))} onClose={() => setShowing(null)} />
  );

  const past = closed.length > 0 && (
    <article className="product">
      <h2>Cortes anteriores</h2>
      {closed.map((d) => (
        <div key={d.id} className="paid-row">
          <span>
            {formatDateTime(d.openedAt).slice(0, 10)} · {formatPrice(corte(d, orders).sales)}
          </span>
          <button className="secondary" onClick={() => setShowing(d)}>
            Ver corte
          </button>
        </div>
      ))}
    </article>
  );

  if (!day) {
    return (
      <div className="settings">
        <p className="category-note">No hay caja abierta. Ábrela en la sección Caja para empezar el día.</p>
        {past}
        {dialog}
      </div>
    );
  }

  const c = corte(day, orders);
  const countedValue = counted === '' ? undefined : Number(counted);
  const diff = countedValue === undefined ? null : countedValue - c.expectedCash;

  return (
    <div className="corte">
      <section className="corte-col">
        <article className="product">
          <h2>Venta del día</h2>
          <Row label="Venta total" value={c.sales} big />
          <Row label="Pedidos cobrados" text={String(c.orders)} />
          <Row label="Ticket promedio" value={c.averageTicket} />
          <h3>Por forma de pago</h3>
          {METHODS.filter((m) => m.id !== 'plataforma' || c.byMethod.plataforma.sales > 0).map((m) => (
            <Row key={m.id} label={m.label} value={c.byMethod[m.id].sales} />
          ))}
          {c.onAccount > 0 && <Row label="Incluye abonos de pedidos abiertos" value={c.onAccount} />}
          {c.paidBefore > 0 && <Row label="Ventas ya pagadas en días anteriores" value={c.paidBefore} />}
          <h3>Por canal</h3>
          {CHANNELS.filter((ch) => !isPlatform(ch.id) || c.byChannel[ch.id].orders > 0).map((ch) => (
            <Row key={ch.id} label={`${ch.label} (${c.byChannel[ch.id].orders})`} value={c.byChannel[ch.id].sales} />
          ))}
          {c.commissions > 0 && (
            <>
              <Row label="− Comisiones de apps de reparto" value={c.commissions} />
              <Row label="= Venta neta" value={c.sales - c.commissions} />
            </>
          )}
          <h3>Propinas</h3>
          <Row label="En efectivo (en la caja)" value={c.tipsCash} />
          <Row label="Con tarjeta o transferencia" value={c.tipsCard} />
          {c.byStaff.some((s) => s.name !== 'Sin nombre') && (
            <>
              <h3>Cobrado por</h3>
              {c.byStaff.map((s) => (
                <Row key={s.name} label={s.tips > 0 ? `${s.name} (+ ${formatPrice(s.tips)} de propina)` : s.name} value={s.amount} />
              ))}
            </>
          )}
          {(c.cancelledOrders > 0 || c.cancelledLines > 0) && (
            <>
              <h3>Cancelaciones</h3>
              <Row label="Pedidos cancelados" text={String(c.cancelledOrders)} />
              <Row label={`Platillos cancelados (${c.cancelledLines})`} value={c.cancelledAmount} />
            </>
          )}
        </article>
        <article className="product">
          <h2>Platillos vendidos</h2>
          {c.items.length === 0 && <p className="product-description">Todavía no hay ventas cobradas.</p>}
          {c.items.map((item) => (
            <Row key={item.name} label={`${item.qty} × ${item.name}`} value={item.total} />
          ))}
        </article>
      </section>

      <section className="corte-col">
        <article className="product">
          <h2>Efectivo en caja</h2>
          <Row label="Fondo" value={c.fondo} />
          <Row label="+ Cobrado en efectivo" value={c.byMethod.efectivo.sales} />
          <Row label="+ Propinas en efectivo" value={c.tipsCash} />
          {SALIDA_KINDS.filter((k) => c.salidasByKind[k.id] > 0).map((k) => (
            <Row key={k.id} label={`− Salidas: ${k.label}`} value={c.salidasByKind[k.id]} />
          ))}
          <Row label="= Debe haber" value={c.expectedCash} big />
          <label>
            Efectivo contado
            <input
              inputMode="numeric"
              value={counted}
              onChange={(e) => setCounted(e.target.value.replace(/\D/g, ''))}
              placeholder="Cuenta el cajón"
            />
          </label>
          {diff !== null && (
            <p className={diff < 0 ? 'change short' : 'change'}>
              {diff === 0 ? 'Cuadra exacto' : diff > 0 ? `Sobran ${formatPrice(diff)}` : `Faltan ${formatPrice(-diff)}`}
            </p>
          )}
        </article>

        {c.openOrders > 0 && (
          <p className="notice warn">
            Hay {c.openOrders} pedido{c.openOrders > 1 ? 's' : ''} sin cobrar (falta {formatPrice(c.openAmount)}). Lo que
            falta cuenta para el día en que se cobre; lo que ya abonaron sí está en este corte.
          </p>
        )}

        <div className="form-actions start">
          <button className="secondary" onClick={() => setShowing(day)}>
            Ver ticket del corte
          </button>
          {!confirming ? (
            <button className="primary" onClick={() => setConfirming(true)}>
              Cerrar el día
            </button>
          ) : (
            <>
              <button className="secondary" onClick={() => setConfirming(false)}>
                No, seguir
              </button>
              <button
                className="danger"
                onClick={async () => {
                  const done = await mutateDay(day.id, (d) => closeDay(d, countedValue, who));
                  setConfirming(false);
                  setCounted('');
                  if (done) setShowing(done);
                }}
              >
                Sí, cerrar el día
              </button>
            </>
          )}
        </div>
        {past}
      </section>
      {dialog}
    </div>
  );
}

function Row({ label, value, text, big }: { label: string; value?: number; text?: string; big?: boolean }) {
  return (
    <div className={big ? 'sum-row big' : 'sum-row'}>
      <span>{label}</span>
      <span>{text ?? formatPrice(value ?? 0)}</span>
    </div>
  );
}
