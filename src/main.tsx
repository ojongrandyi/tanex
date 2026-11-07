import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/fonts';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { COMPANY, isAdminPathname } from './config/brand';
import { loadLiveChat } from './services/liveChat';
import { currentLang, startRouter } from './router/navigation';
import { loadLocale } from './i18n/runtime';

// Path routing: rewrites a legacy /#/… link to its path before the first render.
startRouter();

function render() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary label={COMPANY}>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

// A French page waits for the French dictionary so the first paint is already in French. If it
// can't be fetched, the page still renders (in English) rather than staying blank.
const lang = isAdminPathname(window.location.pathname) ? 'en' : currentLang();
if (lang === 'en') render();
else loadLocale(lang).then(render, render);

loadLiveChat();
