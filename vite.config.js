import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/flashcards_penale/',
  plugins: [react()],
});
