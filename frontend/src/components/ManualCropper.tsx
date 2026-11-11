import React, { useEffect, useRef, useState } from 'react';
import { Check, X, Crop, RotateCcw } from 'lucide-react';

interface CropRect {
  x: number; // percentage 0-100
  y: number;
  w: number;
  h: number;
}

type DragMode =
  | null
  | 'move'
  | 'draw'
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se';

interface ManualCropperProps {
  imageUrl: string;
  rotation: number;
  onApplyCrop: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export const ManualCropper: React.FC<ManualCropperProps> = ({
  imageUrl,
  rotation,
  onApplyCrop,
  onCancel,
}) => {
  const [uprightUrl, setUprightUrl] = useState<string>('');
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const boxContainerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startCrop: CropRect;
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    startCrop: { x: 0, y: 0, w: 0, h: 0 },
  });

  // Normalize image orientation before cropping so coordinates map 1:1
  useEffect(() => {
    let cancelled = false;
    const normRot = ((rotation % 360) + 360) % 360;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      if (normRot === 0) {
        setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        setUprightUrl(imageUrl);
        return;
      }

      const swap = normRot === 90 || normRot === 270;
      const cw = swap ? img.naturalHeight : img.naturalWidth;
      const ch = swap ? img.naturalWidth : img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(cw / 2, ch / 2);
        ctx.rotate((normRot * Math.PI) / 180);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setNaturalSize({ w: cw, h: ch });
        setUprightUrl(dataUrl);
      }
    };
    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl, rotation]);

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const startDrag = (mode: DragMode, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const container = boxContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const pctX = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    const pctY = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);

    const initialBox =
      mode === 'draw' ? { x: pctX, y: pctY, w: 0, h: 0 } : crop ? { ...crop } : { x: pctX, y: pctY, w: 0, h: 0 };

    if (mode === 'draw') {
      setCrop(initialBox);
    }

    dragState.current = {
      mode,
      startX: pctX,
      startY: pctY,
      startCrop: initialBox,
    };
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const { mode, startX, startY, startCrop } = dragState.current;
      if (!mode || !boxContainerRef.current) return;

      const rect = boxContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const curX = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
      const curY = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
      const dx = curX - startX;
      const dy = curY - startY;
      const minSize = 3;

      if (mode === 'draw') {
        const x = Math.min(startX, curX);
        const y = Math.min(startY, curY);
        const w = Math.abs(curX - startX);
        const h = Math.abs(curY - startY);
        setCrop({ x, y, w: Math.min(w, 100 - x), h: Math.min(h, 100 - y) });
        return;
      }

      if (mode === 'move') {
        const nx = clamp(startCrop.x + dx, 0, 100 - startCrop.w);
        const ny = clamp(startCrop.y + dy, 0, 100 - startCrop.h);
        setCrop({ ...startCrop, x: nx, y: ny });
        return;
      }

      let { x, y, w, h } = startCrop;
      if (mode.includes('w')) {
        const newX = clamp(startCrop.x + dx, 0, startCrop.x + startCrop.w - minSize);
        w = startCrop.w + (startCrop.x - newX);
        x = newX;
      }
      if (mode.includes('e')) {
        w = clamp(startCrop.w + dx, minSize, 100 - startCrop.x);
      }
      if (mode.includes('n')) {
        const newY = clamp(startCrop.y + dy, 0, startCrop.y + startCrop.h - minSize);
        h = startCrop.h + (startCrop.y - newY);
        y = newY;
      }
      if (mode.includes('s')) {
        h = clamp(startCrop.h + dy, minSize, 100 - startCrop.y);
      }
      setCrop({ x, y, w, h });
    };

    const handlePointerUp = () => {
      if (dragState.current.mode === 'draw') {
        setCrop((curr) => (curr && curr.w >= 3 && curr.h >= 3 ? curr : null));
      }
      dragState.current.mode = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const hasValidSelection = !!crop && crop.w >= 3 && crop.h >= 3;

  const handleApply = () => {
    if (!imgRef.current || !hasValidSelection || !crop || naturalSize.w === 0 || naturalSize.h === 0) return;
    setIsApplying(true);

    const sx = Math.round((crop.x / 100) * naturalSize.w);
    const sy = Math.round((crop.y / 100) * naturalSize.h);
    const sw = Math.max(20, Math.round((crop.w / 100) * naturalSize.w));
    const sh = Math.max(20, Math.round((crop.h / 100) * naturalSize.h));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsApplying(false);
      return;
    }

    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, sw, sh);
    canvas.toBlob(
      (blob) => {
        setIsApplying(false);
        if (blob) {
          onApplyCrop(blob);
        }
      },
      'image/jpeg',
      0.95
    );
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full space-y-3">
      {/* Crop Mode Toolbar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 bg-slate-800/95 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white">
        <div className="flex items-center space-x-2">
          <Crop className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-amber-200">Select Crop Area</span>
          <span className="text-[11px] text-slate-300 hidden sm:inline">
            • {hasValidSelection ? 'Area selected! Click Apply Crop or drag outside to re-select' : 'Click & drag directly over the receipt area to keep'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {hasValidSelection && (
            <button
              type="button"
              onClick={() => setCrop(null)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] font-semibold text-slate-200"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Re-select</span>
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] font-semibold text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying || !uprightUrl || !hasValidSelection}
            className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-[11px] font-bold text-white shadow"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isApplying ? 'Cropping...' : 'Apply Crop'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Selection Canvas */}
      <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
        {uprightUrl ? (
          <div
            ref={boxContainerRef}
            onPointerDown={(e) => startDrag('draw', e)}
            className="relative inline-block select-none touch-none shadow-2xl rounded-lg overflow-hidden cursor-crosshair"
          >
            <img
              ref={imgRef}
              src={uprightUrl}
              alt="Crop preview"
              draggable={false}
              className="max-h-[500px] max-w-full w-auto block pointer-events-none"
            />

            {!crop && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                <div className="bg-slate-900/85 border border-amber-400/60 text-amber-200 text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
                  Drag a rectangle over the receipt slip to crop
                </div>
              </div>
            )}

            {crop && (
              <>
                {/* 4 Shaded Outside Overlays */}
                <div
                  className="absolute left-0 right-0 top-0 bg-black/55 pointer-events-none"
                  style={{ height: `${crop.y}%` }}
                />
                <div
                  className="absolute left-0 right-0 bottom-0 bg-black/55 pointer-events-none"
                  style={{ height: `${Math.max(0, 100 - crop.y - crop.h)}%` }}
                />
                <div
                  className="absolute left-0 bg-black/55 pointer-events-none"
                  style={{ top: `${crop.y}%`, height: `${crop.h}%`, width: `${crop.x}%` }}
                />
                <div
                  className="absolute right-0 bg-black/55 pointer-events-none"
                  style={{
                    top: `${crop.y}%`,
                    height: `${crop.h}%`,
                    width: `${Math.max(0, 100 - crop.x - crop.w)}%`,
                  }}
                />

                {/* Selected Crop Box */}
                <div
                  onPointerDown={(e) => startDrag('move', e)}
                  style={{
                    left: `${crop.x}%`,
                    top: `${crop.y}%`,
                    width: `${crop.w}%`,
                    height: `${crop.h}%`,
                  }}
                  className="absolute border-2 border-amber-400 cursor-move shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
                >
                  <div className="absolute -top-2 -left-2 w-3.5 h-3.5 bg-amber-400 border border-slate-900 rounded-sm cursor-nwse-resize" onPointerDown={(e) => startDrag('nw', e)} />
                  <div className="absolute -top-2 -right-2 w-3.5 h-3.5 bg-amber-400 border border-slate-900 rounded-sm cursor-nesw-resize" onPointerDown={(e) => startDrag('ne', e)} />
                  <div className="absolute -bottom-2 -left-2 w-3.5 h-3.5 bg-amber-400 border border-slate-900 rounded-sm cursor-nesw-resize" onPointerDown={(e) => startDrag('sw', e)} />
                  <div className="absolute -bottom-2 -right-2 w-3.5 h-3.5 bg-amber-400 border border-slate-900 rounded-sm cursor-nwse-resize" onPointerDown={(e) => startDrag('se', e)} />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-400">Preparing image for crop...</div>
        )}
      </div>
    </div>
  );
};
