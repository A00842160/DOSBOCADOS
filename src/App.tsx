import { useState } from 'react';
import MenuScreen from './MenuScreen';
import EncargadoScreen from './screens/EncargadoScreen';
import OrderListScreen from './screens/OrderListScreen';
import OrderScreen from './screens/OrderScreen';
import PaymentScreen from './screens/PaymentScreen';
import StaffPicker from './screens/StaffPicker';
import TablesScreen from './screens/TablesScreen';
import type { Channel } from './domain/order';

export type Route =
  | { name: 'inicio' }
  | { name: 'mesas' }
  | { name: 'lista'; channel: Exclude<Channel, 'mesa'> }
  | { name: 'pedido'; orderId: string; back: Route }
  | { name: 'cobro'; orderId: string; back: Route }
  | { name: 'menu' }
  | { name: 'encargado' };

export type Navigate = (route: Route) => void;

const HOME_TILES: { route: Route; label: string; hint: string }[] = [
  { route: { name: 'mesas' }, label: 'Mesas', hint: '6 mesas' },
  { route: { name: 'lista', channel: 'llevar' }, label: 'Para llevar', hint: 'Pedido en mostrador' },
  { route: { name: 'lista', channel: 'whatsapp' }, label: 'WhatsApp', hint: 'Pedido por mensaje' },
  { route: { name: 'menu' }, label: 'Menú', hint: 'Platillos y precios' },
];

function title(route: Route): string {
  switch (route.name) {
    case 'mesas':
      return 'Mesas';
    case 'lista':
      return route.channel === 'llevar' ? 'Para llevar' : 'WhatsApp';
    case 'menu':
      return 'Menú';
    case 'encargado':
      return 'Encargado';
    default:
      return 'DosBocados';
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'inicio' });

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
      <div className="grid">
        {HOME_TILES.map((tile) => (
          <button key={tile.label} className="tile" onClick={() => setRoute(tile.route)}>
            <span className="tile-label">{tile.label}</span>
            <span className="tile-hint">{tile.hint}</span>
          </button>
        ))}
      </div>
      <button className="access" onClick={() => setRoute({ name: 'encargado' })}>
        Encargado
      </button>
    </main>
  );
}
