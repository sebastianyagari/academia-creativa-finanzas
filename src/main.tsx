import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Fuentes incluidas en la app (sin Google Fonts) para funcionar sin internet.
// Solo el subconjunto latino: cubre tildes, ñ y signos del español.
import '@fontsource/baloo-bhaina-2/latin-500.css';
import '@fontsource/baloo-bhaina-2/latin-700.css';
import '@fontsource/baloo-bhaina-2/latin-800.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';

import './styles/tokens.css';
import './styles/global.css';

import { AccessGate } from './components/AccessGate';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento #root');

createRoot(root).render(
  <StrictMode>
    <AccessGate>
      <App />
    </AccessGate>
  </StrictMode>,
);
