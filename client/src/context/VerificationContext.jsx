import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { previewVerification as previewVerificationPipeline, runVerification as runVerificationPipeline } from '../services/verificationService.js';
import api from '../services/api.js';

const VerificationContext = createContext(null);

export function VerificationProvider({ children }) {
  const [pendingImage, setPendingImageState] = useState(null); // { files: [{file, previewUrl}] }
  // Local cache only — as of Phase 7 results are also persisted server-side
  // (MongoDB), so getResult() falls back to a real API fetch on a cache
  // miss (e.g. after a page refresh) instead of showing "not found".
  const resultsRef = useRef(new Map());

  const pendingRef = useRef(null); // mirrors state so cleanup side effects stay out of state updaters

  const setPendingImage = useCallback((images, qrImage = null) => {
    pendingRef.current = { files: images, qrImage, extracted: null, confirmedFields: null };
    setPendingImageState({ files: images, qrImage, extracted: null, confirmedFields: null });
  }, []);

  const previewVerification = useCallback(async () => {
    const queued = pendingRef.current;
    if (!queued?.files?.length) throw new Error('No images are queued for extraction.');
    if (queued.extracted) return queued.extracted;
    const extracted = await previewVerificationPipeline(
      queued.files.map((image) => image.file),
      { qrFile: queued.qrImage?.file }
    );
    const next = { ...queued, extracted };
    pendingRef.current = next;
    setPendingImageState(next);
    return extracted;
  }, []);

  const confirmFields = useCallback((confirmedFields) => {
    if (!pendingRef.current) return;
    const next = { ...pendingRef.current, confirmedFields };
    pendingRef.current = next;
    setPendingImageState(next);
  }, []);

  // Releases the queued photos (and their blob: preview URLs, which otherwise leak) once the
  // result has been saved server-side.
  const clearPendingImage = useCallback(() => {
    pendingRef.current?.files?.forEach((image) => { if (image.previewUrl) URL.revokeObjectURL(image.previewUrl); });
    if (pendingRef.current?.qrImage?.previewUrl) URL.revokeObjectURL(pendingRef.current.qrImage.previewUrl);
    pendingRef.current = null;
    setPendingImageState(null);
  }, []);

  const runVerification = useCallback(
    async ({ onStepChange } = {}) => {
      const queued = pendingRef.current;
      if (!queued?.files?.length) {
        throw new Error('No images are queued for verification.');
      }
      // The server persists the scan and returns the real stored image URL
      // — we intentionally do NOT override it with the local blob preview
      // URL, since that preview is revoked once the user leaves /verify.
      const record = await runVerificationPipeline(queued.files.map((image) => image.file), {
        onStepChange,
        qrFile: queued.qrImage?.file,
        confirmedFields: queued.confirmedFields,
      });
      if (!record?.id) throw new Error('The server returned an incomplete result.');
      resultsRef.current.set(record.id, record);
      return record;
    },
    []
  );

  const getResult = useCallback(async (id) => {
    if (resultsRef.current.has(id)) return resultsRef.current.get(id);

    const { data } = await api.get(`/verification/${id}`);
    resultsRef.current.set(data.scan.id, data.scan);
    return data.scan;
  }, []);

  const value = useMemo(
    () => ({
      pendingImage,
      setPendingImage,
      previewVerification,
      confirmFields,
      clearPendingImage,
      runVerification,
      getResult,
    }),
    [pendingImage, setPendingImage, previewVerification, confirmFields, clearPendingImage, runVerification, getResult]
  );

  return <VerificationContext.Provider value={value}>{children}</VerificationContext.Provider>;
}

export function useVerification() {
  const ctx = useContext(VerificationContext);
  if (!ctx) throw new Error('useVerification must be used within a VerificationProvider');
  return ctx;
}
