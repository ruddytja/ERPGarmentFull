import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { SessionProvider } from './core/session';
import './index.css';
import './styles/modules.css';

createRoot(document.getElementById('root')!).render(
  <SessionProvider>
    <App />
  </SessionProvider>
);
