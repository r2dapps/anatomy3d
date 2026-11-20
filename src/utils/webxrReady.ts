/**
 * WebXR Spatial Readiness Foundation (Meta Quest 2 / Standalone Headsets).
 *
 * The full-body BodyParts3D adult dataset is authored in real-world meters
 * (~1.72m standing height, origin at floor y = 0), matching WebXR local-floor
 * reference space 1:1 without arbitrary rescaling.
 */
export const WEBXR_METRIC_CONFIG = {
  referenceSpace: 'local-floor' as const,
  specimenHeightMeters: 1.72,
  recommendedViewingDistanceMeters: 1.45,
  targetQuest2Fps: 72,
  batchedDrawCallTarget: 15,
};

export interface WebXRCapability {
  supported: boolean;
  immersiveVr: boolean;
  immersiveAr: boolean;
}

export async function probeWebXRCapability(): Promise<WebXRCapability> {
  if (typeof navigator === 'undefined' || !('xr' in navigator)) {
    return { supported: false, immersiveVr: false, immersiveAr: false };
  }
  const xr = (navigator as Navigator & { xr?: { isSessionSupported: (mode: string) => Promise<boolean> } }).xr;
  if (!xr || typeof xr.isSessionSupported !== 'function') {
    return { supported: false, immersiveVr: false, immersiveAr: false };
  }
  try {
    const [immersiveVr, immersiveAr] = await Promise.all([
      xr.isSessionSupported('immersive-vr').catch(() => false),
      xr.isSessionSupported('immersive-ar').catch(() => false),
    ]);
    return { supported: immersiveVr || immersiveAr, immersiveVr, immersiveAr };
  } catch {
    return { supported: false, immersiveVr: false, immersiveAr: false };
  }
}
