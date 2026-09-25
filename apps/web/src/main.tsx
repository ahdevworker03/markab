import { createRoot } from 'react-dom/client';

import App from './App';
import { configureApiClient } from '@/lib/api-config';
import { initializeTheme } from '@/providers/ThemeProvider';

import './index.css';

configureApiClient();
initializeTheme();

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => undefined);
  });
}
