import React, { useEffect, useState } from 'react';

interface PaymentQrProps {
  value: string;
  /** Method name, used in the image's alt text (CONTENT.md §6.8). */
  methodLabel: string;
  /** Translated alt text and caption (the track page passes them; English otherwise). */
  alt?: string;
  caption?: string;
}

const QR_SIZE = 180;

/** A QR code for a wallet address or payment link. The qrcode library is only downloaded when one is shown. */
export const PaymentQr: React.FC<PaymentQrProps> = ({ value, methodLabel, alt, caption }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setSrc(null);
    setFailed(false);
    import('qrcode')
      .then((QRCode) => QRCode.toDataURL(value, { width: QR_SIZE * 2, margin: 1, errorCorrectionLevel: 'M' }))
      .then((url) => { if (active) setSrc(url); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [value]);

  if (failed) return null;

  return (
    <figure className="ngf-pm-qr">
      {src
        ? <img src={src} alt={alt ?? `QR code for ${methodLabel}`} width={QR_SIZE} height={QR_SIZE} />
        : <span className="ngf-pm-qr-placeholder" aria-hidden="true" />}
      <figcaption>{caption ?? 'Scan with your wallet or camera app.'}</figcaption>
    </figure>
  );
};
