import React, { useEffect, useState } from 'react';
import { Trash2, RotateCcw, X, ArrowRight, AlertTriangle, Inbox } from 'lucide-react';
import { Shipment } from '../../types/shipment';
import { useAdminData } from '../../context/AdminDataContext';
import './RecentlyDeletedModal.css';
import { RECENTLY_DELETED_MODAL_TEXT as TXT } from './RecentlyDeletedModal.text';

interface RecentlyDeletedModalProps {
  onClose: () => void;
}

export const RecentlyDeletedModal: React.FC<RecentlyDeletedModalProps> = ({ onClose }) => {
  const { getTrashedShipments, restoreShipment, permanentlyDeleteShipment } = useAdminData();
  const [loading, setLoading] = useState(true);
  const [trashed, setTrashed] = useState<Shipment[]>([]);
  const [busyTracking, setBusyTracking] = useState<string | null>(null);
  const [confirmPurgeTracking, setConfirmPurgeTracking] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getTrashedShipments().then((list) => {
      setTrashed(list);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleRestore = async (trackingNumber: string) => {
    setBusyTracking(trackingNumber);
    const result = await restoreShipment(trackingNumber);
    setBusyTracking(null);
    if (result.success) {
      setTrashed(prev => prev.filter(s => s.trackingNumber !== trackingNumber));
      setToast(TXT.restoredBackInYourShipments(trackingNumber));
    } else {
      setToast(TXT.failedToRestore(trackingNumber, result.error || TXT.serverRejected));
    }
    setTimeout(() => setToast(null), 4000);
  };

  const handlePermanentDelete = async (trackingNumber: string) => {
    setBusyTracking(trackingNumber);
    const result = await permanentlyDeleteShipment(trackingNumber);
    setBusyTracking(null);
    setConfirmPurgeTracking(null);
    if (result.success) {
      setTrashed(prev => prev.filter(s => s.trackingNumber !== trackingNumber));
      setToast(TXT.permanentlyDeleted(trackingNumber));
    } else {
      setToast(TXT.failedToPermanentlyDelete(trackingNumber, result.error || TXT.serverRejected));
    }
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="trash-modal-overlay animate-fade-in" onClick={onClose}>
      <div className="trash-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="trash-modal-top">
          <div className="trash-modal-title-group">
            <Trash2 size={18} className="text-slate" />
            <div>
              <h3>{TXT.recentlyDeleted}</h3>
              <p>{TXT.deletedShipmentsAreKeptHere}</p>
            </div>
          </div>
          <button type="button" className="trash-close-btn" onClick={onClose} title={TXT.closeEsc}>
            <X size={18} />
          </button>
        </div>

        {toast && <div className="trash-toast-inline">{toast}</div>}

        <div className="trash-modal-body">
          {loading ? (
            <div className="trash-empty-state">
              <span>{TXT.loading}</span>
            </div>
          ) : trashed.length === 0 ? (
            <div className="trash-empty-state">
              <Inbox size={32} className="text-slate" />
              <strong>{TXT.nothingInTheTrash}</strong>
              <p>{TXT.deletedShipmentsWillShowUp}</p>
            </div>
          ) : (
            <div className="trash-list">
              {trashed.map((s) => {
                const originCity = typeof s.origin === 'object' ? s.origin?.city : s.origin;
                const originState = typeof s.origin === 'object' ? s.origin?.state : '';
                const destCity = typeof s.destination === 'object' ? s.destination?.city : s.destination;
                const destState = typeof s.destination === 'object' ? s.destination?.state : '';
                const isBusy = busyTracking === s.trackingNumber;
                const isConfirmingPurge = confirmPurgeTracking === s.trackingNumber;

                return (
                  <div key={s.trackingNumber} className="trash-row">
                    <div className="trash-row-main">
                      <strong className="trash-tracking font-mono">{s.trackingNumber}</strong>
                      <span className="trash-route">
                        {originCity}, {originState} <ArrowRight size={11} className="inline-arrow" /> {destCity}, {destState}
                      </span>
                      <span className="trash-cargo">{s.cargoDescription || s.shipmentType}</span>
                    </div>

                    {isConfirmingPurge ? (
                      <div className="trash-purge-confirm">
                        <AlertTriangle size={14} className="text-crimson" />
                        <span>{TXT.permanentlyDeleteThisCannotBe}</span>
                        <button type="button" className="trash-btn-ghost" onClick={() => setConfirmPurgeTracking(null)} disabled={isBusy}>
                          {TXT.cancel}
                        </button>
                        <button type="button" className="trash-btn-danger" onClick={() => handlePermanentDelete(s.trackingNumber)} disabled={isBusy}>
                          {isBusy ? TXT.deleting : TXT.yesDeleteForever}
                        </button>
                      </div>
                    ) : (
                      <div className="trash-row-actions">
                        <button
                          type="button"
                          className="trash-btn-restore"
                          onClick={() => handleRestore(s.trackingNumber)}
                          disabled={isBusy}
                        >
                          <RotateCcw size={13} />
                          <span>{isBusy ? TXT.restoring : TXT.restore}</span>
                        </button>
                        <button
                          type="button"
                          className="trash-btn-purge"
                          onClick={() => setConfirmPurgeTracking(s.trackingNumber)}
                          disabled={isBusy}
                          title={TXT.permanentlyDelete}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
