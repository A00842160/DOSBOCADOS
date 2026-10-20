import { useState } from 'react';
import SoldOutScreen from './SoldOutScreen';

type Section = 'agotados';

const SECTIONS: { id: Section; label: string }[] = [{ id: 'agotados', label: 'Agotados' }];

export default function EncargadoScreen() {
  const [section, setSection] = useState<Section>('agotados');

  return (
    <div className="admin">
      <nav className="tabs">
        {SECTIONS.map((s) => (
          <button key={s.id} className={s.id === section ? 'tab active' : 'tab'} onClick={() => setSection(s.id)}>
            {s.label}
          </button>
        ))}
      </nav>
      {section === 'agotados' && <SoldOutScreen />}
    </div>
  );
}
