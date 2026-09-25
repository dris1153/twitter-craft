import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/assets/tailwind.css';
import { I18nProvider } from '@/hooks/use-i18n';
import { App } from './app';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
