// Location prompt and status during a delivery (DISPATCH_SPEC §6, CONTENT §10.3): explains why the
// position is shared before the browser asks, says what to do when it is blocked, and reminds the
// courier to keep the app open (a web app cannot share its position in the background).
import React from 'react';
import { LocateFixed, MapPinOff } from 'lucide-react';
import { useCourierText } from './context';
import type { LocationSharing } from './useLocationSharing';

export const LocationCard: React.FC<{ location: LocationSharing }> = ({ location }) => {
  const { t, time } = useCourierText();
  const { permission, sharing, screenLock, lastSentAt, start } = location;

  if (permission === 'unsupported') {
    return <div className="tx-cr-loc tx-cr-loc--off" role="status"><MapPinOff size={22} aria-hidden="true" /><p>{t('location.unsupported')}</p></div>;
  }
  if (permission === 'denied') {
    return (
      <div className="tx-cr-loc tx-cr-loc--off" role="alert">
        <MapPinOff size={22} aria-hidden="true" />
        <div><p><strong>{t('location.off')}</strong></p><p>{t('location.blocked')}</p></div>
      </div>
    );
  }
  if (!sharing) {
    return (
      <div className="tx-cr-loc tx-cr-loc--ask">
        <LocateFixed size={22} aria-hidden="true" />
        <div>
          <p>{t('location.ask')}</p>
          <button type="button" className="tx-cr-btn tx-cr-btn--primary tx-cr-btn--block" onClick={start}>{t('location.turnOn')}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="tx-cr-loc tx-cr-loc--on" role="status">
      <LocateFixed size={22} aria-hidden="true" />
      <div>
        <p><strong>{t('location.sharing')}</strong>{lastSentAt ? ` · ${t('sync.lastUpdate', { time: time(lastSentAt) })}` : ''}</p>
        <p>{t('location.keepOpen')}</p>
        {screenLock && <p className="tx-cr-muted">{t('location.screenOn')}</p>}
      </div>
    </div>
  );
};
