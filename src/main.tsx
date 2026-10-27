import './polyfills';
import { t } from './i18n';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles.css';
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>{t('Painter needs a fresh start')}</h1>
        <p>{this.state.error}</p>
        <p>
          {t(
            'Your previously saved drawings remain on this device. Unsaved edits may be lost if you reload.',
          )}{' '}
        </p>
        <button onClick={() => location.reload()}>{t('Reload Painter')}</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
// PointerEvent marks the WebView 55 floor (older WebViews are already blocked
// by Capacitor's native minWebViewVersion check); the other APIs the app needs
// are either old enough (Canvas 2D, <dialog>) or shimmed in ./polyfills and
// model.ts (ResizeObserver, crypto.randomUUID).
const supported =
  typeof PointerEvent !== 'undefined' && !!document.createElement('canvas').getContext('2d');
createRoot(document.getElementById('root')!).render(
  supported ? (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  ) : (
    <main className="fatal">
      <h1>{t('A newer WebView is needed')}</h1>
      <p>{t("Please update Android System WebView to use Painter's drawing canvas.")}</p>
    </main>
  ),
);
