import { useEffect, useState } from 'react';
import { roleForPin, setRolePin, useAuth, type Role } from '../auth';
import PinPad from './PinPad';
import SettingsScreen from './SettingsScreen';
import SoldOutScreen from './SoldOutScreen';

type Section = 'agotados' | 'personal';

const SECTIONS: { id: Section; label: string; roles: Role[] }[] = [
  { id: 'agotados', label: 'Agotados', roles: ['encargado', 'dueno'] },
  { id: 'personal', label: 'Personal y PINs', roles: ['dueno'] },
];

/** The screen locks itself after this long without a touch. */
const IDLE_MS = 2 * 60 * 1000;

export default function EncargadoScreen() {
  const auth = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [section, setSection] = useState<Section>('agotados');

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
      <PinPad
        title="Escribe tu PIN"
        lengths={[4, 6]}
        onSubmit={async (pin) => {
          const found = await roleForPin(pin, auth);
          if (!found) return 'PIN incorrecto';
          setRole(found);
          setSection('agotados');
          return null;
        }}
      />
    );
  }

  const visible = SECTIONS.filter((s) => s.roles.includes(role));

  return (
    <div className="admin">
      <nav className="tabs">
        {visible.map((s) => (
          <button key={s.id} className={s.id === section ? 'tab active' : 'tab'} onClick={() => setSection(s.id)}>
            {s.label}
          </button>
        ))}
        <span className="role-chip">{role === 'dueno' ? 'Dueño' : 'Encargado'}</span>
        <button className="secondary" onClick={() => setRole(null)}>
          Cerrar sesión
        </button>
      </nav>
      {section === 'agotados' && <SoldOutScreen />}
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
