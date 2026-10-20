import { useState } from 'react';

type Screen = 'inicio' | 'mesas' | 'para-llevar' | 'whatsapp' | 'bebidas' | 'acceso';

const MENU: { screen: Exclude<Screen, 'inicio'>; label: string; hint: string }[] = [
  { screen: 'mesas', label: 'Mesas', hint: '6 mesas' },
  { screen: 'para-llevar', label: 'Para llevar', hint: 'Pedido en mostrador' },
  { screen: 'whatsapp', label: 'WhatsApp', hint: 'Pedido por mensaje' },
  { screen: 'bebidas', label: 'Bebidas de hoy', hint: 'Disponible / agotado' },
];

const TITLES: Record<Screen, string> = {
  inicio: 'DosBocados',
  mesas: 'Mesas',
  'para-llevar': 'Para llevar',
  whatsapp: 'WhatsApp',
  bebidas: 'Bebidas de hoy',
  acceso: 'Encargado / Dueño',
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('inicio');

  if (screen !== 'inicio') {
    return (
      <main className="screen">
        <header className="bar">
          <button className="back" onClick={() => setScreen('inicio')}>
            ← Volver
          </button>
          <h1>{TITLES[screen]}</h1>
        </header>
        <p className="placeholder">Esta pantalla se construye en los siguientes pasos.</p>
      </main>
    );
  }

  return (
    <main className="screen">
      <header className="bar">
        <h1>{TITLES.inicio}</h1>
      </header>
      <div className="grid">
        {MENU.map((item) => (
          <button key={item.screen} className="tile" onClick={() => setScreen(item.screen)}>
            <span className="tile-label">{item.label}</span>
            <span className="tile-hint">{item.hint}</span>
          </button>
        ))}
      </div>
      <button className="access" onClick={() => setScreen('acceso')}>
        Encargado / Dueño
      </button>
    </main>
  );
}
