import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/fonts';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { COMPANY } from './config/brand';
import { loadLiveChat } from './services/liveChat';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary label={COMPANY}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

loadLiveChat();
