import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { CajaCerrada, currentDay, db, mutateOrder } from '../db';
import { activeLines, orderLabel, orderTotal, type Order } from '../domain/order';
import {
  addPayment,
  changeDue,
  equalPart,
  methodLabel,
  methodsFor,
  paidAmount,
  payments,
  remaining,
  removePayment,
  tipFromPercent,
  type Method,
} from '../domain/payment';
import { billTicket } from '../domain/ticket';
import { formatPrice } from '../menu';
import { useStaff } from '../staff';
import TicketDialog from './TicketDialog';

const TIP_PERCENTS = [0, 10, 15, 20];
const BILLS = [100, 200, 500, 1000];

interface Props {
  orderId: string;
  onBack: () => void;
  onDone: () => void;
}

function toPesos(text: string): number {
  const n = Math.round(Number(text.replace(/[^0-9.]/g, '')));
  return Number.isFinite(n) ? n : 0;
}

export default function PaymentScreen({ orderId, onBack, onDone }: Props) {
  const order = useLiveQuery(() => db.orders.get(orderId), [orderId]);
  const [picked, setMethod] = useState<Method | null>(null);
  const [amountText, setAmountText] = useState<string | null>(null);
  const [tipPercent, setTipPercent] = useState<number | null>(0);
  const [tipText, setTipText] = useState('');
  const [receivedText, setReceivedText] = useState('');
  const [byItems, setByItems] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A ref, not state, so a fast double tap can't slip in before the re-render.
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const day = useLiveQuery(async () => (await currentDay()) ?? null, []);
  const staff = useStaff();

  if (!order) return <main className="screen" />;
  // A delivery app order starts on "Pagado en la app"; others start on cash.
  const method = picked ?? methodsFor(order)[0].id;

  const left = remaining(order);
  const amount = amountText === null ? left : Math.min(toPesos(amountText), left);
  const tip = tipPercent !== null ? tipFromPercent(amount, tipPercent) : toPesos(tipText);
  const received = toPesos(receivedText);
  const change = changeDue(amount, tip, received);
  const cashShort = method === 'efectivo' && receivedText !== '' && change < 0;
  const cajaClosed = day === null;
  const canPay = amount > 0 && !cashShort && !cajaClosed && !saving;

  function resetForm() {
    setAmountText(null);
    setTipPercent(0);
    setTipText('');
    setReceivedText('');
  }

  async function pay() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const next = await mutateOrder(orderId, (o) =>
        addPayment(o, {
          method,
          amount,
          tip,
          received: method === 'efectivo' ? (receivedText === '' ? amount + tip : received) : undefined,
          by: staff.name ?? undefined,
        }),
      );
      resetForm();
      if (next?.closedAt) setShowBill(true);
    } catch (e) {
      if (!(e instanceof CajaCerrada)) throw e;
      setError(e.message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  if (showBill) {
    return (
      <main className="screen">
        <TicketDialog title={`Cuenta pagada · ${orderLabel(order)}`} lines={billTicket(order)} onClose={onDone} />
      </main>
    );
  }

  return (
    <main className="screen">
      <header className="bar">
        <button className="back" onClick={onBack}>
          ← Volver
        </button>
        <h1>Cobrar · {orderLabel(order)}</h1>
      </header>

      <div className="pay-layout">
        <section className="pay-summary">
          <div className="sum-row">
            <span>Total</span>
            <span>{formatPrice(orderTotal(order))}</span>
          </div>
          <div className="sum-row">
            <span>Pagado</span>
            <span>{formatPrice(paidAmount(order))}</span>
          </div>
          <div className="sum-row big">
            <span>Falta</span>
            <span>{formatPrice(left)}</span>
          </div>
          {payments(order).map((p) => (
            <div key={p.id} className="paid-row">
              <span>
                {methodLabel(p.method)} {formatPrice(p.amount)}
                {p.tip > 0 && ` + propina ${formatPrice(p.tip)}`}
              </span>
              <button
                className="qty-btn"
                aria-label="Quitar pago"
                onClick={() => mutateOrder(orderId, (o) => removePayment(o, p.id))}
              >
                ×
              </button>
            </div>
          ))}
        </section>

        <section className="pay-form">
          <div className={methodsFor(order).length > 3 ? 'segmented four' : 'segmented'}>
            {methodsFor(order).map((m) => (
              <button
                key={m.id}
                className={m.id === method ? 'seg active' : 'seg'}
                onClick={() => {
                  setMethod(m.id);
                  setReceivedText('');
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          <label>
            Cobrar en este pago
            <input inputMode="numeric" value={amountText ?? String(left)} onChange={(e) => setAmountText(e.target.value)} />
          </label>
          <div className="chips">
            <button className="chip" onClick={() => setAmountText(null)}>
              Todo
            </button>
            {[2, 3, 4].map((n) => (
              <button key={n} className="chip" onClick={() => setAmountText(String(equalPart(order, n)))}>
                Entre {n}
              </button>
            ))}
            <button className="chip" onClick={() => setByItems(true)}>
              Por platillos
            </button>
          </div>

          <label>Propina</label>
          <div className="chips">
            {TIP_PERCENTS.map((p) => (
              <button
                key={p}
                className={tipPercent === p ? 'chip on' : 'chip'}
                onClick={() => {
                  setTipPercent(p);
                  setTipText('');
                }}
              >
                {p === 0 ? 'Sin propina' : `${p}%`}
              </button>
            ))}
            <input
              className="inline-input"
              inputMode="numeric"
              placeholder="Otra $"
              value={tipText}
              onChange={(e) => {
                setTipText(e.target.value);
                setTipPercent(null);
              }}
            />
          </div>
          {tip > 0 && <p className="hint">Propina: {formatPrice(tip)}</p>}

          {method === 'efectivo' && (
            <>
              <label>
                Recibido
                <input
                  inputMode="numeric"
                  placeholder={`Exacto ${formatPrice(amount + tip)}`}
                  value={receivedText}
                  onChange={(e) => setReceivedText(e.target.value)}
                />
              </label>
              <div className="chips">
                {BILLS.filter((b) => b >= amount + tip).map((b) => (
                  <button key={b} className="chip" onClick={() => setReceivedText(String(b))}>
                    {formatPrice(b)}
                  </button>
                ))}
              </div>
              {receivedText !== '' && (
                <p className={cashShort ? 'change short' : 'change'}>
                  {cashShort ? `Faltan ${formatPrice(-change)}` : `Cambio: ${formatPrice(change)}`}
                </p>
              )}
            </>
          )}

          {(cajaClosed || error) && (
            <p className="notice warn">{error ?? new CajaCerrada().message}</p>
          )}
          <button className="primary big" disabled={!canPay} onClick={pay}>
            Registrar {formatPrice(amount + tip)}
          </button>
        </section>
      </div>

      {byItems && (
        <ItemsDialog
          order={order}
          onCancel={() => setByItems(false)}
          onPick={(total) => {
            setAmountText(String(total));
            setByItems(false);
          }}
        />
      )}
    </main>
  );
}

function ItemsDialog({
  order,
  onCancel,
  onPick,
}: {
  order: Order;
  onCancel: () => void;
  onPick: (total: number) => void;
}) {
  // Picks units, so 3 tacos can be split as 2 for one person and 1 for another.
  const [picked, setPicked] = useState<Record<string, number>>({});
  const lines = activeLines(order);
  const total = lines.reduce((sum, l) => sum + (picked[l.id] ?? 0) * l.unitPrice, 0);

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>¿Qué paga esta persona?</h2>
        {lines.map((l) => {
          const n = picked[l.id] ?? 0;
          return (
            <div key={l.id} className="paid-row">
              <span>
                {l.name} <span className="muted">({l.qty} × {formatPrice(l.unitPrice)})</span>
              </span>
              <div className="line-qty">
                <button
                  className="qty-btn"
                  onClick={() => setPicked({ ...picked, [l.id]: Math.max(0, n - 1) })}
                >
                  −
                </button>
                <span className="qty">{n}</span>
                <button
                  className="qty-btn"
                  onClick={() => setPicked({ ...picked, [l.id]: Math.min(l.qty, n + 1) })}
                >
                  +
                </button>
              </div>
              <span className="line-total">{formatPrice(n * l.unitPrice)}</span>
            </div>
          );
        })}
        <div className="sum-row big">
          <span>Le toca</span>
          <span>{formatPrice(total)}</span>
        </div>
        <div className="form-actions">
          <button className="secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className="primary" disabled={total === 0} onClick={() => onPick(total)}>
            Usar {formatPrice(total)}
          </button>
        </div>
      </div>
    </div>
  );
}
