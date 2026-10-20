import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Capacitor loads the build from the device's filesystem, so asset paths must be relative.
  base: './',
});
