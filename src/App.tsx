import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { currentDay, db, openOrders } from './db';
import { kitchenQueue, LATE_MINUTES } from './domain/kitchen';
import { isLow } from './domain/inventory';
import MenuScreen from './MenuScreen';
import EncargadoScreen from './screens/EncargadoScreen';
import KitchenScreen, { useNow } from './screens/KitchenScreen';
import OrderListScreen from './screens/OrderListScreen';
import OrderScreen from './screens/OrderScreen';
import PaymentScreen from './screens/PaymentScreen';
import StaffPicker from './screens/StaffPicker';
import TablesScreen from './screens/TablesScreen';
import { channelLabel, PLATFORMS, type Channel } from './domain/order';

export type Route =
  | { name: 'inicio' }
  | { name: 'mesas' }
  | { name: 'lista'; channel: Exclude<Channel, 'mesa'> }
  | { name: 'pedido'; orderId: string; back: Route }
  | { name: 'cobro'; orderId: string; back: Route }
  | { name: 'apps' }
  | { name: 'menu' }
  | { name: 'cocina' }
  | { name: 'encargado' };

export type Navigate = (route: Route) => void;

const HOME_TILES: { route: Route; label: string; hint: string }[] = [
  { route: { name: 'mesas' }, label: 'Mesas', hint: '6 mesas' },
  { route: { name: 'lista', channel: 'llevar' }, label: 'Para llevar', hint: 'Pedido en mostrador' },
  { route: { name: 'lista', channel: 'whatsapp' }, label: 'WhatsApp', hint: 'Pedido por mensaje' },
  { route: { name: 'apps' }, label: 'Apps de reparto', hint: 'Uber Eats, Rappi, DiDi' },
  { route: { name: 'menu' }, label: 'Menú', hint: 'Platillos y precios' },
];

function title(route: Route): string {
  switch (route.name) {
    case 'mesas':
      return 'Mesas';
    case 'lista':
      return channelLabel(route.channel);
    case 'apps':
      return 'Apps de reparto';
    case 'menu':
      return 'Menú';
    case 'cocina':
      return 'Cocina';
    case 'encargado':
      return 'Encargado';
    default:
      return 'DosBocados';
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'inicio' });
  const dayOpen = useLiveQuery(async () => Boolean(await currentDay()), [], true);
  const rounds = kitchenQueue(useLiveQuery(openOrders, [], []), useNow());
  const late = rounds.filter((r) => r.minutes >= LATE_MINUTES).length;
  const low = useLiveQuery(async () => (await db.supplies.toArray()).filter(isLow).map((s) => s.name), [], []);

  if (route.name === 'pedido') {
    return (
      <OrderScreen
        orderId={route.orderId}
        onBack={() => setRoute(route.back)}
        onPay={() => setRoute({ name: 'cobro', orderId: route.orderId, back: route })}
      />
    );
  }

  if (route.name === 'cobro') {
    const pedido = route.back.name === 'pedido' ? route.back : null;
    return (
      <PaymentScreen
        orderId={route.orderId}
        onBack={() => setRoute(route.back)}
        onDone={() => setRoute(pedido ? pedido.back : { name: 'inicio' })}
      />
    );
  }

  if (route.name !== 'inicio') {
    return (
      <main className="screen">
        <header className="bar">
          <button className="back" onClick={() => setRoute({ name: 'inicio' })}>
            ← Volver
          </button>
          <h1>{title(route)}</h1>
        </header>
        {route.name === 'menu' && <MenuScreen />}
        {route.name === 'cocina' && <KitchenScreen navigate={setRoute} />}
        {route.name === 'apps' && (
          <div className="tables">
            {PLATFORMS.map((p) => (
              <button key={p} className="table-tile" onClick={() => setRoute({ name: 'lista', channel: p })}>
                <span className="table-number">{channelLabel(p)}</span>
              </button>
            ))}
          </div>
        )}
        {route.name === 'mesas' && <TablesScreen navigate={setRoute} />}
        {route.name === 'lista' && <OrderListScreen channel={route.channel} navigate={setRoute} />}
        {route.name === 'encargado' && <EncargadoScreen />}
      </main>
    );
  }

  return (
    <main className="screen">
      <header className="bar">
        <h1>DosBocados</h1>
        <StaffPicker />
      </header>
      {!dayOpen && (
        <p className="notice warn home-notice">La caja no está abierta. El encargado la abre en Encargado › Caja.</p>
      )}
      {low.length > 0 && (
        <p className="notice warn home-notice">Por acabarse: {low.join(', ')}. Revisa Encargado › Inventario.</p>
      )}
      <div className="grid">
        {HOME_TILES.map((tile) => (
          <button key={tile.label} className="tile" onClick={() => setRoute(tile.route)}>
            <span className="tile-label">{tile.label}</span>
            <span className="tile-hint">{tile.hint}</span>
          </button>
        ))}
        <button className={late ? 'tile kitchen-tile late' : 'tile kitchen-tile'} onClick={() => setRoute({ name: 'cocina' })}>
          <span className="tile-label">Cocina</span>
          <span className="tile-hint">
            {rounds.length === 0
              ? 'Nada en espera'
              : `${rounds.length} en espera${late ? ` · ${late} con más de ${LATE_MINUTES} min` : ''}`}
          </span>
        </button>
      </div>
      <button className="access" onClick={() => setRoute({ name: 'encargado' })}>
        Encargado
      </button>
    </main>
  );
}
