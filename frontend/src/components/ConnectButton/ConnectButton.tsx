import React, { useState } from 'react';
import { sendConnectRequest } from '../../services/api';
import './ConnectButton.css';

// Remembers which players the user has sent a connect request to this session,
// so the button stays in its "Requested" state across leaderboard re-renders.
const sentUuids = new Set<string>();

/**
 * Tap-to-connect button shown on leaderboard rows for players the user isn't
 * already themselves. Sends a connect request by the player's public UUID and
 * flips to a check once sent (the backend is idempotent for already-friends/
 * already-requested).
 */
export function ConnectButton({ userUuid }: { userUuid: string }): React.JSX.Element {
  const [sent, setSent]     = useState(() => sentUuids.has(userUuid));
  const [busy, setBusy]     = useState(false);

  const onClick = async (): Promise<void> => {
    if (sent || busy) return;
    setBusy(true);
    sentUuids.add(userUuid);       // optimistic
    setSent(true);
    try {
      await sendConnectRequest(userUuid);
    } catch {
      sentUuids.delete(userUuid);
      setSent(false);
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
