import { useState } from 'react';
import { useAuth, verifyPin, type StaffMember } from '../auth';
import { useStaff } from '../staff';
import PinPad from './PinPad';

/** Home-screen chip showing who is serving; tapping it switches person with their PIN. */
export default function StaffPicker() {
  const auth = useAuth();
  const staff = useStaff();
  const [open, setOpen] = useState(false);
  const [member, setMember] = useState<StaffMember | null>(null);

  if (!auth || auth.staff.length === 0) return null;

  const close = () => {
    setOpen(false);
    setMember(null);
  };

  return (
    <>
      <button className="secondary push-right" onClick={() => setOpen(true)}>
        Atiende: {staff.name ?? 'elige tu nombre'}
      </button>
      {open && (
        <div className="overlay" onClick={close}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            {member ? (
              <PinPad
                title={`PIN de ${member.name}`}
                lengths={[4]}
                onCancel={() => setMember(null)}
                onSubmit={async (pin) => {
                  const error = await verifyPin(pin, member);
                  if (error) return error;
                  staff.setName(member.name);
                  close();
                  return null;
                }}
              />
            ) : (
              <>
                <h2>¿Quién atiende?</h2>
                <div className="picker-grid">
                  {auth.staff.map((s) => (
                    <button key={s.id} className="pick" onClick={() => setMember(s)}>
                      <span className="pick-name">{s.name}</span>
                    </button>
                  ))}
                </div>
                <button className="secondary" onClick={close}>
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
