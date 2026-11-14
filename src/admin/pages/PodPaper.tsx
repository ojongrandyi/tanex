// Proof of Delivery paper (CONTENT §11; tracker #38). The server writes the document when a
// delivery job is completed (server/dispatch/podDocument.ts); this draws it in the Document
// Center, which turns it into the PDF. Documents are English, like the other papers. The photo
// and signature come from the private dispatch route, so they show only for staff who may see
// them (dispatch or finance); others see "on file".
import React from 'react';
import type { AdminDocument } from '../../types/admin';
import { Barcode } from '../../components/Barcode';
import { DocumentHeaderBrand, DocumentIdLine, DocumentLegalFooter } from '../../components/DocumentBrand';
import { VEHICLE_LABELS } from '../../shared/dispatchStatus';

export interface PodDetails {
  jobId: string;
  scope: string;
  deliveredAtText: string;
  receivedBy: string;
  courierName: string | null;
  vehicleType: string | null;
  hasPhoto: boolean;
  hasSignature: boolean;
  note: string | null;
  cashRefs: string[];
  attempts: number;
}

function readDetails(doc: AdminDocument): PodDetails | null {
  const d = doc.details as Partial<PodDetails> | undefined;
  return d && typeof d.jobId === 'string' ? (d as PodDetails) : null;
}

const place = (address?: string, city?: string) => [address, city].filter(Boolean).join(', ');

export const PodPaper = React.forwardRef<HTMLDivElement, { doc: AdminDocument; title: string }>(({ doc, title }, ref) => {
  const d = readDetails(doc);
  const file = (kind: 'photo' | 'signature') => d ? `/api/dispatch/jobs/${encodeURIComponent(d.jobId)}/pod/${kind}` : '';
  const vehicle = d?.vehicleType && d.vehicleType in VEHICLE_LABELS ? VEHICLE_LABELS[d.vehicleType as keyof typeof VEHICLE_LABELS].en : null;
  return (
    <div className="receipt-paper" ref={ref}>
      <div className="rec-header">
        <div className="rec-brand">
          <DocumentHeaderBrand />
          <p>{title}</p>
        </div>
        <div className="rec-meta font-mono">
          <div className="m-row"><span>Document No:</span> <strong className="rec-meta-id">{doc.id}</strong></div>
          <div className="m-row"><span>Date:</span> <strong>{doc.createdDate}</strong></div>
          <div className="m-row"><span>Status:</span> <strong className="rec-status-pill paid">DELIVERED</strong></div>
        </div>
      </div>

      <div className="rec-divider" />
      <DocumentIdLine trackingId={doc.shipmentTracking} />

      <div className="rec-section-title">DELIVERY CONFIRMATION</div>
      <div className="rec-summary-grid">
        <div className="rec-card">
          <span className="rec-card-lbl">DELIVERED ON</span>
          <strong>{d?.deliveredAtText || doc.createdDate}</strong>
          <div>{doc.service}</div>
          {d && d.attempts > 0 && <div>Attempts before delivery: {d.attempts}</div>}
        </div>
        <div className="rec-card">
          <span className="rec-card-lbl">RECEIVED BY</span>
          <strong>{d?.receivedBy || doc.recipientName}</strong>
          {d?.courierName && <div>Courier: {d.courierName}{vehicle ? ` (${vehicle})` : ''}</div>}
        </div>
      </div>

      <div className="rec-section-title">FROM / TO</div>
      <div className="rec-summary-grid">
        <div className="rec-card">
          <span className="rec-card-lbl">PICKUP</span>
          <strong>{doc.senderName}</strong>
          <div>{place(doc.senderAddress, doc.senderCity)}</div>
          {doc.senderPhone && <div className="rec-card-contact font-mono">{doc.senderPhone}</div>}
        </div>
        <div className="rec-card">
          <span className="rec-card-lbl">DROP-OFF</span>
          <strong>{doc.recipientName}</strong>
          <div>{place(doc.recipientAddress, doc.recipientCity)}</div>
          {doc.recipientPhone && <div className="rec-card-contact font-mono">{doc.recipientPhone}</div>}
        </div>
      </div>

      <div className="rec-section-title">ITEM</div>
      <div className="table-responsive-wrapper">
        <table className="rec-items-table">
          <thead>
            <tr><th>Item Description</th><th>Service</th><th>Pieces</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>{doc.cargoDescription}</strong></td><td>{doc.service}</td><td className="font-mono">{doc.pieces}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="rec-section-title">PROOF</div>
      <div className="rec-summary-grid">
        <div className="rec-card">
          <span className="rec-card-lbl">PHOTO AT HANDOVER</span>
          {d?.hasPhoto
            ? <img src={file('photo')} alt={`Parcel handed over for ${doc.shipmentTracking}`} width={240} height={180}
                style={{ objectFit: 'cover', maxWidth: '100%', height: 'auto' }} />
            : <div>Not on file</div>}
        </div>
        <div className="rec-card">
          <span className="rec-card-lbl">RECIPIENT SIGNATURE</span>
          {d?.hasSignature
            ? <img src={file('signature')} alt={`Signature of ${d.receivedBy}`} width={240} height={120}
                style={{ objectFit: 'contain', maxWidth: '100%', height: 'auto' }} />
            : <div>Not captured</div>}
        </div>
      </div>
      {d?.note && <p className="rec-card-company">Courier note: {d.note}</p>}
      {d && d.cashRefs.length > 0 && <p className="font-mono">Payment collected, ledger ref: {d.cashRefs.join(', ')}</p>}

      <div className="bol-barcode-center">
        <Barcode value={doc.shipmentTracking} width={2} height={50} fontSize={12} />
      </div>
      <DocumentLegalFooter />
    </div>
  );
});
PodPaper.displayName = 'PodPaper';
