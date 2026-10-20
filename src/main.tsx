import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StaffProvider } from './staff';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StaffProvider>
      <App />
    </StaffProvider>
  </StrictMode>,
);
