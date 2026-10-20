import { useState } from 'react';
import { addStaff, removeEncargadoPin, removeStaff, setRolePin, useAuth, type Role } from '../auth';
import PinPad from './PinPad';

type Editing = { kind: 'role'; role: Role } | { kind: 'staff'; name: string } | null;

export default function SettingsScreen() {
  const auth = useAuth();
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState('');
  const [done, setDone] = useState<string | null>(null);

  if (!auth) return null;

  if (editing) {
    const length = editing.kind === 'role' && editing.role === 'dueno' ? 6 : 4;
    const title =
      editing.kind === 'staff'
        ? `PIN de ${editing.name} (4 números)`
        : editing.role === 'dueno'
          ? 'Tu nuevo PIN de dueño (6 números)'
          : 'PIN del encargado (4 números)';
    return (
      <ConfirmPin
        title={title}
        length={length}
        onCancel={() => setEditing(null)}
        onConfirmed={async (pin) => {
          if (editing.kind === 'role') await setRolePin(editing.role, pin);
          else await addStaff(editing.name, pin);
          setDone(editing.kind === 'staff' ? `Se agregó a ${editing.name}.` : 'PIN guardado.');
          setEditing(null);
          setName('');
        }}
      />
    );
  }

  return (
    <div className="settings">
      {done && <p className="notice">{done}</p>}

      <article className="product">
        <h2>Dueño</h2>
        <p className="product-description">Tu PIN abre todo, incluido el corte de caja.</p>
        <button className="secondary" onClick={() => setEditing({ kind: 'role', role: 'dueno' })}>
          Cambiar mi PIN
        </button>
      </article>

      <article className="product">
        <h2>Encargado</h2>
        <p className="product-description">
          {auth.encargado
            ? 'Tiene PIN. Puede marcar agotados y manejar la caja, pero no ve el corte.'
            : 'Todavía no tiene PIN.'}
        </p>
        <div className="form-actions start">
          <button className="secondary" onClick={() => setEditing({ kind: 'role', role: 'encargado' })}>
            {auth.encargado ? 'Cambiar PIN' : 'Poner PIN'}
          </button>
          {auth.encargado && (
            <button className="secondary" onClick={() => removeEncargadoPin()}>
              Quitar PIN
            </button>
          )}
        </div>
      </article>

      <article className="product">
        <h2>Meseros y cocina</h2>
        <p className="product-description">
          Cada quien elige su nombre con su PIN en la pantalla de inicio, y así se sabe quién tomó y cobró cada pedido.
        </p>
        {auth.staff.map((s) => (
          <div key={s.id} className="paid-row">
            <span>{s.name}</span>
            <button className="secondary" onClick={() => removeStaff(s.id)}>
              Quitar
            </button>
          </div>
        ))}
        <form
          className="staff-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) setEditing({ kind: 'staff', name: name.trim() });
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre, ej. Lupita" />
          <button type="submit" className="primary" disabled={!name.trim()}>
            Agregar
          </button>
        </form>
      </article>
    </div>
  );
}

function ConfirmPin({
  title,
  length,
  onCancel,
  onConfirmed,
}: {
  title: string;
  length: number;
  onCancel: () => void;
  onConfirmed: (pin: string) => Promise<void>;
}) {
  const [first, setFirst] = useState<string | null>(null);
  return first === null ? (
    <PinPad
      title={title}
      lengths={[length]}
      onCancel={onCancel}
      onSubmit={async (pin) => {
        setFirst(pin);
        return null;
      }}
    />
  ) : (
    <PinPad
      key="confirm"
      title="Escríbelo otra vez"
      lengths={[length]}
      onCancel={onCancel}
      onSubmit={async (pin) => {
        if (pin !== first) {
          setFirst(null);
          return 'No coincide, empieza de nuevo';
        }
        await onConfirmed(pin);
        return null;
      }}
    />
  );
}
