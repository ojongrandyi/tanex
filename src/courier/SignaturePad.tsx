// Optional recipient signature (DISPATCH_SPEC §4, §6): drawn with a finger on a canvas and saved
// as a PNG (the server accepts PNG up to 512 KB). Pointer events cover touch, pen and mouse.
import React, { useCallback, useEffect, useRef, useState } from 'react';

export const SignaturePad: React.FC<{
  label: string;
  clearLabel: string;
  onChange: (png: Blob | null) => void;
}> = ({ label, clearLabel, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  // Size the drawing surface to the element (and the screen's pixel ratio) once laid out.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * ratio);
    c.height = Math.round(rect.height * ratio);
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1C120E';
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const finish = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    canvasRef.current?.toBlob((b) => onChange(b), 'image/png');
  }, [onChange]);

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#1C120E';
    ctx.fill();
    setEmpty(false);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const p = point(e);
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className="tx-cr-sign">
      <canvas
        ref={canvasRef}
        className="tx-cr-sign__pad"
        aria-label={label}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={finish}
      />
      {empty && <span className="tx-cr-sign__hint" aria-hidden="true">{label}</span>}
      <button type="button" className="tx-cr-btn tx-cr-btn--ghost tx-cr-btn--small" onClick={clear} disabled={empty}>{clearLabel}</button>
    </div>
  );
};
