import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, discardIfEmpty, mutateOrder } from '../db';
import {
  addItem,
  cancelOrder,
  canCancelOrder,
  canEditLine,
  hasInKitchen,
  hasKitchenWork,
  markServed,
  ownerCancelLine,
  sendToKitchen,
  orderLabel,
  orderTotal,
  QUICK_MODS,
  setNotes,
  setQty,
  type Order,
  type OrderLine,
} from '../domain/order';
import { loadAuth, pinMatches } from '../auth';
import { useSoldOut } from '../availability';
import { billTicket, kitchenTicket } from '../domain/ticket';
import { CATEGORIES, formatPrice, productsIn, PRODUCTS, type Product } from '../menu';
import PinPad from './PinPad';
import TicketDialog from './TicketDialog';

const STATUS_LABEL: Record<OrderLine['status'], string> = {
  pendiente: 'Por mandar',
  'en-cocina': 'En cocina',
  salio: 'Salió',
};

interface Props {
  orderId: string;
  onBack: () => void;
  onPay: () => void;
}

export default function OrderScreen({ orderId, onBack, onPay }: Props) {
  const order = useLiveQuery(() => db.orders.get(orderId), [orderId]);
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [product, setProduct] = useState<Product | null>(null);
  const [editing, setEditing] = useState<OrderLine | null>(null);
  const soldOut = useSoldOut();
  const [ticket, setTicket] = useState<{ title: string; lines: string[] } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [ownerCancel, setOwnerCancel] = useState<OrderLine | null>(null);

  if (!order) return <main className="screen" />;

  const update = (change: (o: Order) => Order) => mutateOrder(orderId, change);

  async function leave() {
    await discardIfEmpty(orderId);
    onBack();
  }

  async function sendKitchen() {
    let result: ReturnType<typeof sendToKitchen> | undefined;
    await mutateOrder(orderId, (o) => {
      result = sendToKitchen(o);
      return result.order;
    });
    if (result) {
      setTicket({
        title: `Ticket de cocina · ronda ${result.batch.number}`,
        lines: kitchenTicket(result.order, result.batch),
      });
    }
  }

  async function cancelWhole() {
    await mutateOrder(orderId, cancelOrder);
    setConfirmCancel(false);
    onBack();
  }

  function pick(p: Product) {
    if (p.variants.length === 1) {
      if (!soldOut.has(p.variants[0].id)) update((o) => addItem(o, p, p.variants[0]));
    } else {
      setProduct(p);
    }
  }

  const qtyOf = (variantId: string) =>
    order.lines.filter((l) => l.variantId === variantId && !l.cancelled).reduce((n, l) => n + l.qty, 0);

  return (
    <main className="screen order-screen">
      <header className="bar">
        <button className="back" onClick={leave}>
          ← Volver
        </button>
        <h1>{orderLabel(order)}</h1>
        {order.lines.length > 0 && canCancelOrder(order) && (
          <button className="danger push-right" onClick={() => setConfirmCancel(true)}>
            Cancelar pedido
          </button>
        )}
      </header>

      <div className="order-layout">
        <nav className="menu-categories">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={c.id === categoryId && !product ? 'category active' : 'category'}
              onClick={() => {
                setCategoryId(c.id);
                setProduct(null);
              }}
            >
              {c.name}
            </button>
          ))}
        </nav>

        <section className="picker">
          {product ? (
            <>
              <div className="picker-head">
                <button className="secondary" onClick={() => setProduct(null)}>
                  ← {CATEGORIES.find((c) => c.id === product.categoryId)?.name}
                </button>
                <h2>{product.name}</h2>
              </div>
              <div className="picker-grid">
                {product.variants.map((v) => {
                  const qty = qtyOf(v.id);
                  const available = !soldOut.has(v.id);
                  return (
                    <button
                      key={v.id}
                      className="pick"
                      disabled={!available}
                      onClick={() => update((o) => addItem(o, product, v))}
                    >
                      <span className="pick-name">
                        {v.favorite && <span className="favorite">★ </span>}
                        {v.name}
                      </span>
                      <span className="pick-price">{available ? formatPrice(v.price) : 'Agotado'}</span>
                      {qty > 0 && <span className="pick-qty">{qty}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="picker-grid">
              {productsIn(categoryId).map((p) => {
                const available = p.variants.some((v) => !soldOut.has(v.id));
                const single = p.variants.length === 1;
                const qty = single ? qtyOf(p.variants[0].id) : 0;
                return (
                  <button key={p.id} className="pick" disabled={!available} onClick={() => pick(p)}>
                    <span className="pick-name">{p.name}</span>
                    <span className="pick-price">
                      {!available
                        ? 'Agotado'
                        : single
                          ? formatPrice(p.variants[0].price)
                          : `${p.variants.length} opciones`}
                    </span>
                    {qty > 0 && <span className="pick-qty">{qty}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="ticket">
          <div className="ticket-lines">
            {order.lines.length === 0 && <p className="placeholder">Toca un platillo para agregarlo.</p>}
            {order.lines.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                onQty={(qty) => update((o) => setQty(o, line.id, qty))}
                onEdit={() => (line.status === 'salio' ? setOwnerCancel(line) : setEditing(line))}
              />
            ))}
          </div>
          <div className="ticket-total">
            <span>Total</span>
            <span>{formatPrice(orderTotal(order))}</span>
          </div>
          <div className="ticket-actions">
            <button className="primary" disabled={!hasKitchenWork(order)} onClick={sendKitchen}>
              Mandar a cocina
            </button>
            <button className="secondary" disabled={!hasInKitchen(order)} onClick={() => update(markServed)}>
              Ya salió de cocina
            </button>
            <button
              className="secondary"
              disabled={orderTotal(order) === 0}
              onClick={() => setTicket({ title: 'Ticket de cobro', lines: billTicket(order) })}
            >
              Ticket de cobro
            </button>
            <button className="secondary" disabled={orderTotal(order) === 0} onClick={onPay}>
              Cobrar
            </button>
          </div>
        </aside>
      </div>

      {ticket && <TicketDialog title={ticket.title} lines={ticket.lines} onClose={() => setTicket(null)} />}

      {confirmCancel && (
        <div className="overlay" onClick={() => setConfirmCancel(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>¿Cancelar todo el pedido de {orderLabel(order)}?</h2>
            <p className="product-description">Si algo ya está en cocina, avísales que se canceló.</p>
            <div className="form-actions">
              <button className="secondary" onClick={() => setConfirmCancel(false)}>
                No, regresar
              </button>
              <button className="danger" onClick={cancelWhole}>
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {ownerCancel && (
        <div className="overlay" onClick={() => setOwnerCancel(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <p className="product-description">
              {ownerCancel.name} ya salió de cocina. Solo el dueño puede cancelarlo.
            </p>
            <PinPad
              title="PIN del dueño"
              lengths={[6]}
              onCancel={() => setOwnerCancel(null)}
              onSubmit={async (pin) => {
                if (!(await pinMatches(pin, (await loadAuth()).owner))) return 'PIN incorrecto';
                await update((o) => ownerCancelLine(o, ownerCancel.id));
                setOwnerCancel(null);
                return null;
              }}
            />
          </div>
        </div>
      )}

      {editing && (
        <NotesDialog
          line={editing}
          onCancel={() => setEditing(null)}
          onSave={(mods, note) => {
            update((o) => setNotes(o, editing.id, mods, note));
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}

function LineRow({ line, onQty, onEdit }: { line: OrderLine; onQty: (qty: number) => void; onEdit: () => void }) {
  const editable = canEditLine(line);
  return (
    <div className={line.cancelled ? 'line cancelled' : 'line'}>
      <button className="line-main" onClick={onEdit} disabled={line.cancelled}>
        <span className="line-name">{line.name}</span>
        {(line.mods.length > 0 || line.note) && (
          <span className="line-notes">{[...line.mods, line.note].filter(Boolean).join(' · ')}</span>
        )}
        <span className={`line-status ${line.cancelled ? 'cancelado' : line.status}`}>
          {line.cancelled ? 'Cancelado' : STATUS_LABEL[line.status]}
        </span>
      </button>
      <div className="line-qty">
        {editable && (
          <button className="qty-btn" onClick={() => onQty(line.qty - 1)} aria-label="Quitar uno">
            −
          </button>
        )}
        <span className="qty">{line.qty}</span>
        {editable && (
          <button className="qty-btn" onClick={() => onQty(line.qty + 1)} aria-label="Agregar uno">
            +
          </button>
        )}
      </div>
      <span className="line-total">{formatPrice(line.cancelled ? 0 : line.unitPrice * line.qty)}</span>
    </div>
  );
}

function NotesDialog({
  line,
  onCancel,
  onSave,
}: {
  line: OrderLine;
  onCancel: () => void;
  onSave: (mods: string[], note: string) => void;
}) {
  const [mods, setMods] = useState(line.mods);
  const [note, setNote] = useState(line.note);
  const product = PRODUCTS.find((p) => p.id === line.productId);

  const toggle = (mod: string) => setMods((m) => (m.includes(mod) ? m.filter((x) => x !== mod) : [...m, mod]));

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{line.name}</h2>
        {product?.description && <p className="product-description">{product.description}</p>}
        <div className="chips">
          {QUICK_MODS.map((mod) => (
            <button key={mod} className={mods.includes(mod) ? 'chip on' : 'chip'} onClick={() => toggle(mod)}>
              {mod}
            </button>
          ))}
        </div>
        <label>
          Nota para cocina
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. la salsa aparte" />
        </label>
        <div className="form-actions">
          <button className="secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className="primary" onClick={() => onSave(mods, note)}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
