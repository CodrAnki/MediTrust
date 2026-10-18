import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ShieldCheck, Trash2 } from 'lucide-react';
import UploadDropzone from '../components/verify/UploadDropzone.jsx';
import CameraCapture from '../components/verify/CameraCapture.jsx';
import Alert from '../components/ui/Alert.jsx';
import { validateMedicineImage } from '../utils/fileValidation.js';
import { verificationSignals } from '../data/verificationSignals.js';
import { useVerification } from '../context/VerificationContext.jsx';

const MAX_IMAGES = 5;

export default function Verify() {
  const navigate = useNavigate();
  const { pendingImage, setPendingImage } = useVerification();
  const [images, setImages] = useState(() => pendingImage?.files || []);
  const [qrImage, setQrImage] = useState(() => pendingImage?.qrImage || null);
  const [error, setError] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const handedOffRef = useRef(false);
  const previewsRef = useRef({ images, qrImage });

  useEffect(() => {
    previewsRef.current = { images, qrImage };
  }, [images, qrImage]);

  useEffect(() => () => {
    if (handedOffRef.current) return;
    previewsRef.current.images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    if (previewsRef.current.qrImage) URL.revokeObjectURL(previewsRef.current.qrImage.previewUrl);
  }, []);

  function addFiles(selected) {
    const candidates = Array.isArray(selected) ? selected : [selected];
    const available = MAX_IMAGES - images.length;
    if (!available) return setError(`You can verify up to ${MAX_IMAGES} images at once.`);
    const additions = [];
    for (const file of candidates.slice(0, available)) {
      const validationError = validateMedicineImage(file);
      if (validationError) { setError(validationError); continue; }
      additions.push({ id: `${file.name}-${file.lastModified}-${Math.random()}`, file, previewUrl: URL.createObjectURL(file) });
    }
    if (candidates.length > available) setError(`Only the first ${available} image(s) were added; the limit is ${MAX_IMAGES}.`);
    if (additions.length) { setImages((current) => [...current, ...additions]); if (candidates.length <= available) setError(null); }
  }

  function removeImage(id) {
    const removed = images.find((image) => image.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    setImages((current) => current.filter((image) => image.id !== id));
  }

  function addQrImage(selected) {
    const file = Array.isArray(selected) ? selected[0] : selected;
    const validationError = validateMedicineImage(file);
    if (validationError) return setError(validationError);
    const nextQrImage = {
      file,
      previewUrl: URL.createObjectURL(file),
    };
    if (qrImage) URL.revokeObjectURL(qrImage.previewUrl);
    setQrImage(nextQrImage);
    setError(null);
  }

  function removeQrImage() {
    if (qrImage) URL.revokeObjectURL(qrImage.previewUrl);
    setQrImage(null);
  }

  function handleVerify() {
    if (!images.length) return setError('Select at least one medicine image before verifying.');
    handedOffRef.current = true;
    setPendingImage(images, qrImage);
    navigate('/verify/review');
  }

  return <section className="mx-auto max-w-5xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8">
    <div className="max-w-[620px]"><h1 className="font-[var(--font-display)] text-[30px] font-semibold tracking-tight text-[var(--color-ink)] sm:text-[36px]">Verify Your Medicine</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">Add clear photos of the front, back, batch/expiry label, QR code, and seal. MediTrust combines information from every image.</p></div>
    <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-10"><div className="flex flex-col gap-4">
      {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}
      <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Medicine images ({images.length}/{MAX_IMAGES})</p>
      {images.length < MAX_IMAGES && <UploadDropzone onFileSelected={addFiles} />}
      {images.length > 0 && <><p className="text-[14px] font-medium text-[var(--color-ink)]">Selected Images</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => <div key={image.id} className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-white p-2"><img src={image.previewUrl} alt={`Medicine image ${index + 1}`} className="h-28 w-full rounded-lg object-cover"/><p className="mt-1 truncate text-[11px] text-[var(--color-ink-faint)]">Image {index + 1}: {image.file.name}</p><button type="button" onClick={() => removeImage(image.id)} aria-label={`Remove image ${index + 1}`} className="absolute right-3 top-3 rounded-full bg-white p-1.5 text-[var(--color-danger)] shadow"><Trash2 size={14}/></button></div>)}
      </div>{images.length < MAX_IMAGES && <p className="text-center text-[13px] text-[var(--color-primary)]">+ Add More Images</p>}</>}
      {images.length < MAX_IMAGES && <button type="button" onClick={() => setCameraOpen(true)} className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-6 py-4 text-[15px] font-medium text-[var(--color-ink)]"><Camera size={18}/>Capture with Camera</button>}
      <div className="mt-3 border-t border-[var(--color-border)] pt-6">
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">QR code photo (optional)</p>
        <p className="mb-4 text-[13px] leading-relaxed text-[var(--color-ink-faint)]">Upload a clear, separate photo of the medicine QR code. The server will decode it and check it against trusted batch and manufacturer QR records.</p>
        {!qrImage && <UploadDropzone onFileSelected={addQrImage} multiple={false} title="Upload QR Code Photo" description="Choose only the QR code image" />}
        {qrImage && <div className="relative max-w-xs overflow-hidden rounded-xl border border-[var(--color-border)] bg-white p-2">
          <img src={qrImage.previewUrl} alt="Selected QR code" className="h-36 w-full rounded-lg object-contain"/>
          <p className="mt-1 truncate text-[11px] text-[var(--color-ink-faint)]">{qrImage.file.name}</p>
          <button type="button" onClick={removeQrImage} aria-label="Remove QR code image" className="absolute right-3 top-3 rounded-full bg-white p-1.5 text-[var(--color-danger)] shadow"><Trash2 size={14}/></button>
        </div>}
      </div>
      <button type="button" disabled={!images.length} onClick={handleVerify} className="mt-2 flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-3.5 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:bg-[var(--color-border)]"><ShieldCheck size={17}/>Scan & Review Details</button>
    </div><aside className="h-fit rounded-2xl border border-[var(--color-border)] bg-white p-6"><p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">What we check</p><ul className="mt-4 flex flex-col gap-4">{verificationSignals.map((signal) => { const Icon = signal.icon; return <li key={signal.key} className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><Icon size={15}/></span><div><p className="text-[13.5px] font-medium text-[var(--color-ink)]">{signal.title}</p><p className="mt-0.5 text-[12.5px] text-[var(--color-ink-faint)]">{signal.description}</p></div></li>; })}</ul></aside></div>
    {cameraOpen && <CameraCapture onCapture={(file) => { setCameraOpen(false); addFiles(file); }} onClose={() => setCameraOpen(false)} />}
  </section>;
}
