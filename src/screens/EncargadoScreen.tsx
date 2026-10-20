import { useEffect, useState } from 'react';
import { pinMatches, setRolePin, useAuth, type Role } from '../auth';
import CashScreen from './CashScreen';
import CorteScreen from './CorteScreen';
import InventoryScreen from './InventoryScreen';
import MenuEditorScreen from './MenuEditorScreen';
import ReportScreen from './ReportScreen';
import PinPad from './PinPad';
import SettingsScreen from './SettingsScreen';
import SoldOutScreen from './SoldOutScreen';
import { useStaff } from '../staff';
import { isLow } from '../domain/inventory';
import { useSupplies } from '../inventoryStore';

type Section = 'agotados' | 'caja' | 'inventario' | 'corte' | 'reportes' | 'menu' | 'personal';

const SECTIONS: { id: Section; label: string; roles: Role[] }[] = [
  { id: 'agotados', label: 'Agotados', roles: ['encargado', 'dueno'] },
  { id: 'caja', label: 'Caja', roles: ['encargado', 'dueno'] },
  { id: 'inventario', label: 'Inventario', roles: ['encargado', 'dueno'] },
  { id: 'corte', label: 'Corte', roles: ['dueno'] },
  { id: 'reportes', label: 'Reportes', roles: ['dueno'] },
  { id: 'menu', label: 'Menú y precios', roles: ['dueno'] },
  { id: 'personal', label: 'Personal y PINs', roles: ['dueno'] },
];

/** The screen locks itself after this long without a touch. */
const IDLE_MS = 2 * 60 * 1000;

export default function EncargadoScreen() {
  const auth = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [section, setSection] = useState<Section>('agotados');
  const staff = useStaff();
  const low = useSupplies().filter(isLow).length;

  useEffect(() => {
    if (!role) return;
    let last = Date.now();
    const touch = () => (last = Date.now());
    const timer = setInterval(() => {
      if (Date.now() - last > IDLE_MS) setRole(null);
    }, 5000);
    window.addEventListener('pointerdown', touch);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', touch);
    };
  }, [role]);

  if (!auth) return null;

  if (!auth.owner) return <OwnerSetup onDone={() => setRole('dueno')} />;

  if (!role) {
    return (
      <Login
        hasEncargado={Boolean(auth.encargado)}
        onRole={(r) => {
          setRole(r);
          setSection('agotados');
        }}
      />
    );
  }

  const visible = SECTIONS.filter((s) => s.roles.includes(role));
  const roleLabel = role === 'dueno' ? 'Dueño' : 'Encargado';
  const who = staff.name ? `${staff.name} (${roleLabel})` : roleLabel;

  return (
    <div className="admin">
      <nav className="tabs">
        {visible.map((s) => (
          <button key={s.id} className={s.id === section ? 'tab active' : 'tab'} onClick={() => setSection(s.id)}>
            {s.label}
            {s.id === 'inventario' && low > 0 && <span className="count-badge">{low}</span>}
          </button>
        ))}
        <span className="role-chip">{roleLabel}</span>
        <button className="secondary" onClick={() => setRole(null)}>
          Cerrar sesión
        </button>
      </nav>
      {section === 'agotados' && <SoldOutScreen />}
      {section === 'caja' && <CashScreen who={who} />}
      {section === 'inventario' && <InventoryScreen role={role} who={who} />}
      {section === 'corte' && role === 'dueno' && <CorteScreen who={who} />}
      {section === 'reportes' && role === 'dueno' && <ReportScreen />}
      {section === 'menu' && role === 'dueno' && <MenuEditorScreen />}
      {section === 'personal' && role === 'dueno' && <SettingsScreen />}
    </div>
  );
}

/** First run: whoever installs the app (the owner) creates the owner PIN. */
function OwnerSetup({ onDone }: { onDone: () => void }) {
  const [first, setFirst] = useState<string | null>(null);

  if (first === null) {
    return (
      <div className="setup">
        <p className="category-note">
          Primera vez: crea tu PIN de dueño de 6 números. Con él verás el corte de caja y configurarás los PINs de los
          demás.
        </p>
        <PinPad
          title="Crea tu PIN de dueño"
          lengths={[6]}
          onSubmit={async (pin) => {
            setFirst(pin);
            return null;
          }}
        />
      </div>
    );
  }

  return (
    <PinPad
      key="confirm"
      title="Escríbelo otra vez"
      lengths={[6]}
      onSubmit={async (pin) => {
        if (pin !== first) {
          setFirst(null);
          return 'No coincide, empieza de nuevo';
        }
        await setRolePin('dueno', pin);
        onDone();
        return null;
      }}
      onCancel={() => setFirst(null)}
    />
  );
}

/** Pick the role first, so an owner PIN that starts like the encargado PIN still works. */
function Login({ hasEncargado, onRole }: { hasEncargado: boolean; onRole: (role: Role) => void }) {
  const auth = useAuth();
  const [as, setAs] = useState<Role>(hasEncargado ? 'encargado' : 'dueno');
  if (!auth) return null;
  return (
    <div className="setup">
      <div className="segmented two">
        <button className={as === 'encargado' ? 'seg active' : 'seg'} onClick={() => setAs('encargado')}>
          Encargado
        </button>
        <button className={as === 'dueno' ? 'seg active' : 'seg'} onClick={() => setAs('dueno')}>
          Dueño
        </button>
      </div>
      <PinPad
        key={as}
        title={as === 'dueno' ? 'PIN de dueño (6 números)' : 'PIN de encargado (4 números)'}
        hint={
          as === 'encargado' && !hasEncargado
            ? 'Todavía no hay PIN de encargado. Entra como Dueño y ponlo en Personal y PINs.'
            : undefined
        }
        lengths={[as === 'dueno' ? 6 : 4]}
        onSubmit={async (pin) => {
          const ok = await pinMatches(pin, as === 'dueno' ? auth.owner : auth.encargado);
          if (!ok) return 'PIN incorrecto';
          onRole(as);
          return null;
        }}
      />
    </div>
  );
}
