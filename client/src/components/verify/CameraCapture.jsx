import { useEffect, useRef, useState } from 'react';
import { X, Camera, RotateCcw } from 'lucide-react';

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setReady(true);
        }
      } catch (err) {
        setError(
          'Camera access was denied or is unavailable. Please allow camera access, or upload an image instead.'
        );
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `medicine-scan-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        onCapture(file);
      },
      'image/jpeg',
      0.92
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-[var(--color-ink)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close camera"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
        >
          <X size={18} />
        </button>

        <div className="relative flex aspect-[3/4] items-center justify-center bg-black">
          {error ? (
            <p className="max-w-xs px-6 text-center text-[13.5px] leading-relaxed text-white/80">
              {error}
            </p>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          )}

          {ready && !error && (
            <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/70" />
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex items-center justify-center gap-4 bg-[var(--color-ink)] px-6 py-5">
          {error ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white px-5 py-2.5 text-[14px] font-medium text-[var(--color-ink)]"
            >
              Close
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCapture}
              disabled={!ready}
              aria-label="Capture photo"
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/30 bg-white text-[var(--color-ink)] transition-transform active:scale-95 disabled:opacity-50"
            >
              <Camera size={24} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
