import { useLiveQuery } from 'dexie-react-hooks';
import type { Navigate } from '../App';
import { openOrders, saveOrder } from '../db';
import { itemCount, newOrder, orderTotal, TABLES } from '../domain/order';
import { formatPrice } from '../menu';
import { useStaff } from '../staff';

export default function TablesScreen({ navigate }: { navigate: Navigate }) {
  const orders = useLiveQuery(openOrders, [], []);
  const staff = useStaff();

  async function open(table: number) {
    let order = orders.find((o) => o.channel === 'mesa' && o.table === table);
    if (!order) {
      order = newOrder('mesa', { table, createdBy: staff.name ?? undefined });
      await saveOrder(order);
    }
    navigate({ name: 'pedido', orderId: order.id, back: { name: 'mesas' } });
  }

  return (
    <div className="tables">
      {TABLES.map((table) => {
        const order = orders.find((o) => o.channel === 'mesa' && o.table === table);
        const busy = order && order.lines.length > 0;
        return (
          <button key={table} className={busy ? 'table-tile busy' : 'table-tile'} onClick={() => open(table)}>
            <span className="table-number">Mesa {table}</span>
            {busy ? (
              <span className="table-info">
                {itemCount(order)} platillos · {formatPrice(orderTotal(order))}
              </span>
            ) : (
              <span className="table-info">Libre</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
