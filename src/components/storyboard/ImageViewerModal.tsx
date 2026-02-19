import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react';

interface ImageViewerModalProps {
  imageUrl: string | null;
  downloadUrl?: string | null;
  open: boolean;
  onClose: () => void;
}

export function ImageViewerModal({ imageUrl, downloadUrl, open, onClose }: ImageViewerModalProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setScale(0.35);
      setTranslate({ x: 0, y: 0 });
    }
  }, [open, imageUrl]);

  // Lock canvas scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale(prev => Math.min(Math.max(0.25, prev + delta), 5));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
  }, [translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setTranslate({
      x: panStart.current.tx + (e.clientX - panStart.current.x),
      y: panStart.current.ty + (e.clientY - panStart.current.y),
    });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const handleDownload = useCallback(async () => {
    const url = downloadUrl || imageUrl;
    if (!url) return;
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `abrahub-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    }
  }, [imageUrl, downloadUrl]);

  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-black/95 border-none overflow-hidden [&>button]:hidden">
        {/* Toolbar */}
        <div className="absolute top-3 right-3 z-50 flex gap-1.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/60 text-white hover:bg-black/80" onClick={() => setScale(s => Math.min(s + 0.25, 5))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/60 text-white hover:bg-black/80" onClick={() => setScale(s => Math.max(s - 0.25, 0.25))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/60 text-white hover:bg-black/80" onClick={() => { setScale(1); setTranslate({ x: 0, y: 0 }); }}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/60 text-white hover:bg-blue-600" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 bg-black/60 text-white hover:bg-red-600" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom info */}
        <div className="absolute bottom-3 left-3 z-50 text-white/60 text-xs bg-black/50 px-2 py-1 rounded">
          {Math.round(scale * 100)}%
        </div>

        {/* Image area */}
        <div
          ref={containerRef}
          className="w-[90vw] h-[85vh] flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            className="max-w-none"
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transition: isPanning ? 'none' : 'transform 0.15s ease-out',
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
