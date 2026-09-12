import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { sendConnectRequest, getConnections } from '../../services/api';
import './ConnectButton.css';

// Shared, reactive state across every ConnectButton on screen.
const sentUuids      = new Set<string>();  // requested this session (optimistic)
const connectedUuids = new Set<string>();  // already friends / pending (from the server)
const listeners      = new Set<() => void>();
let version = 0;

function notify(): void { version++; listeners.forEach(l => l()); }
function subscribe(cb: () => void): () => void { listeners.add(cb); return () => { listeners.delete(cb); }; }
function getSnapshot(): number { return version; }

let lastLoad = 0;
let loading  = false;

/**
 * Load (and cache) the set of players the user is already linked to. Called on
 * login and whenever a leaderboard mounts; throttled so the many ConnectButtons on
 * one board don't each fire a request.
 */
export async function loadConnections(): Promise<void> {
  const now = Date.now();
  if (loading || now - lastLoad < 30_000) return;
  loading = true;
  try {
    const uuids = await getConnections();
    connectedUuids.clear();
    (uuids ?? []).forEach(u => connectedUuids.add(u));
    lastLoad = now;
    notify();
  } catch {
    /* keep the last known set on failure */
  } finally {
    loading = false;
  }
}

/**
 * Tap-to-connect button for leaderboard rows. Renders nothing for a player already
 * in the network (friend or pending request); otherwise sends a connect request by
 * the player's public UUID and flips to a check once sent.
 */
export function ConnectButton({ userUuid }: { userUuid: string }): React.JSX.Element | null {
  useSyncExternalStore(subscribe, getSnapshot);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void loadConnections(); }, []);

  // Already connected/pending → no icon at all.
  if (connectedUuids.has(userUuid)) return null;

  const sent = sentUuids.has(userUuid);

  const onClick = async (): Promise<void> => {
    if (sent || busy) return;
    setBusy(true);
    sentUuids.add(userUuid);       // optimistic
    notify();
    try {
      await sendConnectRequest(userUuid);
    } catch {
      sentUuids.delete(userUuid);
      notify();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className={`connect-btn${sent ? ' connect-btn--sent' : ''}`}
      onClick={onClick}
      disabled={sent || busy}
      aria-label={sent ? 'Connect request sent' : 'Connect'}
      title={sent ? 'Request sent' : 'Connect'}
    >
      {sent ? '✓' : '+ Connect'}
    </button>
  );
}
