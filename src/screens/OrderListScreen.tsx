import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { Navigate } from '../App';
import { openOrders, saveOrder } from '../db';
import { loadCommissions } from '../commissions';
import { isPlatform, itemCount, newOrder, orderTotal, type Channel } from '../domain/order';
import { formatPrice } from '../menu';
import { useStaff } from '../staff';

interface Props {
  channel: Exclude<Channel, 'mesa'>;
  navigate: Navigate;
}

export default function OrderListScreen({ channel, navigate }: Props) {
  const orders = useLiveQuery(openOrders, [], []).filter((o) => o.channel === channel && o.lines.length > 0);
  const [creating, setCreating] = useState(false);
  const staff = useStaff();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const back = { name: 'lista', channel } as const;

  async function create() {
    const order = newOrder(channel, {
      customerName: name.trim() || undefined,
      phone: phone.trim() || undefined,
      createdBy: staff.name ?? undefined,
      commissionRate: isPlatform(channel) ? (await loadCommissions())[channel] : undefined,
    });
    await saveOrder(order);
    navigate({ name: 'pedido', orderId: order.id, back });
  }

  if (creating) {
    return (
      <form
        className="new-order"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <label>
          {isPlatform(channel) ? 'Nombre o número de pedido de la app' : 'Nombre del cliente'}
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isPlatform(channel) ? 'Ej. #4821 Juan' : 'Ej. Juan'}
          />
        </label>
        {channel === 'whatsapp' && (
          <label>
            Teléfono
            <input
              value={phone}
              inputMode="tel"
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej. 229 123 4567"
            />
          </label>
        )}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={() => setCreating(false)}>
            Cancelar
          </button>
          <button type="submit" className="primary">
            Empezar pedido
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="order-list">
      <button className="primary big" onClick={() => setCreating(true)}>
        + Nuevo pedido
      </button>
      {orders.length === 0 && <p className="placeholder">No hay pedidos abiertos.</p>}
      {orders.map((o) => (
        <button
          key={o.id}
          className="order-row"
          onClick={() => navigate({ name: 'pedido', orderId: o.id, back })}
        >
          <span className="order-row-name">{o.customerName || 'Sin nombre'}</span>
          {o.phone && <span className="order-row-phone">{o.phone}</span>}
          <span className="order-row-info">
            {itemCount(o)} platillos · {formatPrice(orderTotal(o))}
          </span>
        </button>
      ))}
    </div>
  );
}
