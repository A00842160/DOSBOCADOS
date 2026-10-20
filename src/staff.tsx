// Who is using the tablet right now, so orders and payments record their name.

import { createContext, useContext, useState, type ReactNode } from 'react';

const KEY = 'dosbocados.atiende';

interface StaffState {
  name: string | null;
  setName: (name: string | null) => void;
}

const StaffContext = createContext<StaffState>({ name: null, setName: () => {} });

function readSaved(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function StaffProvider({ children }: { children: ReactNode }) {
  const [name, setNameState] = useState<string | null>(readSaved);
  const setName = (next: string | null) => {
    setNameState(next);
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      // Remembering the name is a convenience; the app works without it.
    }
  };
  return <StaffContext.Provider value={{ name, setName }}>{children}</StaffContext.Provider>;
}

export function useStaff(): StaffState {
  return useContext(StaffContext);
}
