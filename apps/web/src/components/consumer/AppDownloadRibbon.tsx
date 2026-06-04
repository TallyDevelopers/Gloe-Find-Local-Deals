'use client';

import { X } from './icons';

/**
 * Slim "get the app" ribbon above the header. Mobile web only (hidden on
 * desktop via CSS — you can't install there), and dismissible. The shown/hidden
 * state lives in <AppShell/> so it can offset the over-hero header on the home
 * page; this component is purely presentational.
 *
 * TODO: the app isn't on the App Store yet. When it ships, point APP_STORE_URL
 * at the real listing (and add the iOS Smart App Banner meta tag in layout.tsx).
 */
const APP_STORE_URL = '#'; // TODO: replace with https://apps.apple.com/app/id<APP_ID>

export function AppDownloadRibbon({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="app-ribbon">
      <a className="app-ribbon-link" href={APP_STORE_URL}>
        <span className="app-ribbon-text">
          <strong>Get the Gloē app</strong>
          <span>Vouchers in Apple Wallet + deal alerts near you</span>
        </span>
        <span className="app-ribbon-cta">Open</span>
      </a>
      <button type="button" className="app-ribbon-close" aria-label="Dismiss" onClick={onDismiss}>
        <X size={16} color="var(--text-inverse)" />
      </button>
    </div>
  );
}
