import type { SystemId } from '../data/fullBodyAnatomy.ts';

export interface TourLabelSpec {
  id: string;
  label: string;
  subtitle?: string;
  conceptName: string;
  partIds: string[];
  system: SystemId;
}

export interface ProjectedCalloutInput {
  id: string;
  label: string;
  subtitle?: string;
  conceptName: string;
  system: SystemId;
  anchorX: number;
  anchorY: number;
  depth: number;
  visible: boolean;
}

export interface ViewportSafeRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ResolvedCalloutPosition {
  id: string;
  label: string;
  subtitle?: string;
  conceptName: string;
  system: SystemId;
  anchorX: number;
  anchorY: number;
  boxX: number;
  boxY: number;
  side: 'left' | 'right';
}

export type WebXrCapability = 'checking' | 'supported' | 'unsupported' | 'insecure-context';

export interface XrRigTransform {
  position: [number, number, number];
  scale: number;
  rotationY: number;
}

/**
 * Formats an FMA anatomical concept name into clean, concise display casing
 * for on-screen 3D callout labels (e.g., "zone of deltoid" -> "Deltoid").
 */
export function formatCalloutLabel(rawName: string): string {
  const cleaned = rawName
    .trim()
    .replace(/^zone of\s+/i, '')
    .replace(/\sorgan$/i, '');
  if (!cleaned) return rawName;
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Resolves a public asset URL against Vite's BASE_URL so both root hosting ('/')
 * and GitHub Pages project subpaths ('/repo-name/') load models and icons without 404s.
 */
export function resolveAssetUrl(assetPath: string, baseUrl = '/'): string {
  if (/^https?:\/\//i.test(assetPath) || assetPath.startsWith('data:')) {
    return assetPath;
  }
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const cleanAsset = assetPath.replace(/^\/+/, '');
  if (normalizedBase !== '/' && assetPath.startsWith(normalizedBase)) {
    return assetPath;
  }
  return `${normalizedBase}${cleanAsset}`;
}

export function getTourCalloutWidth(viewportW: number): number {
  return viewportW < 640 ? 104 : 148;
}

/**
 * Deterministically lays out projected 3D anatomical callout labels along the
 * open left and right flanks of the viewport with vertical anti-collision spacing,
 * ensuring leader lines fan outward cleanly without overlapping the 3D specimen,
 * their own anchor dots, or floating UI panels.
 */
export function layoutTourCallouts(
  inputs: readonly ProjectedCalloutInput[],
  viewportW: number,
  viewportH: number,
  safeRect?: Partial<ViewportSafeRect>
): ResolvedCalloutPosition[] {
  if (inputs.length === 0 || viewportW <= 0 || viewportH <= 0) return [];

  const isCompact = viewportW < 640;
  const labelWidth = getTourCalloutWidth(viewportW);
  const minVerticalGap = isCompact ? 34 : 42;

  const leftEdge = Math.max(10, safeRect?.left ?? (isCompact ? 10 : 76));
  const rightEdge = Math.min(viewportW - 10, safeRect?.right ?? (isCompact ? viewportW - 10 : viewportW - 312));
  const topEdge = Math.max(72, safeRect?.top ?? (isCompact ? 74 : 88));
  const bottomEdge = Math.min(viewportH - 24, safeRect?.bottom ?? (isCompact ? viewportH * 0.44 : viewportH - 118));

  const valid = inputs.filter(
    (item) =>
      item.visible &&
      Number.isFinite(item.anchorX) &&
      Number.isFinite(item.anchorY) &&
      item.depth >= -1 &&
      item.depth <= 1 &&
      item.anchorX >= -40 &&
      item.anchorX <= viewportW + 40 &&
      item.anchorY >= -40 &&
      item.anchorY <= viewportH + 40
  );

  if (valid.length === 0) return [];

  const midX = (leftEdge + rightEdge) / 2;
  const openWidth = Math.max(0, rightEdge - leftEdge);
  const leftBucket: ProjectedCalloutInput[] = [];
  const rightBucket: ProjectedCalloutInput[] = [];

  // Assign callouts to their natural side relative to viewport midline, balancing ties
  for (let i = 0; i < valid.length; i++) {
    const item = valid[i];
    const delta = item.anchorX - midX;
    if (Math.abs(delta) < 16) {
      if (rightBucket.length <= leftBucket.length) {
        rightBucket.push(item);
      } else {
        leftBucket.push(item);
      }
    } else if (delta < 0) {
      leftBucket.push(item);
    } else {
      rightBucket.push(item);
    }
  }

  // Rebalance if one side gets crowded while the other is empty (for >= 3 labels)
  if (valid.length >= 3 && leftBucket.length === 0) {
    rightBucket.sort((a, b) => a.anchorX - b.anchorX);
    const moved = rightBucket.shift();
    if (moved) leftBucket.push(moved);
  } else if (valid.length >= 3 && rightBucket.length === 0) {
    leftBucket.sort((a, b) => b.anchorX - a.anchorX);
    const moved = leftBucket.shift();
    if (moved) rightBucket.push(moved);
  }

  const placeColumn = (
    bucket: ProjectedCalloutInput[],
    side: 'left' | 'right'
  ): ResolvedCalloutPosition[] => {
    if (bucket.length === 0) return [];
    const sorted = [...bucket].sort((a, b) => a.anchorY - b.anchorY);
    const ys = sorted.map((item) =>
      Math.max(topEdge + 14, Math.min(bottomEdge - 14, item.anchorY))
    );

    // Forward pass: enforce minimum vertical separation downward
    for (let i = 1; i < ys.length; i++) {
      if (ys[i] - ys[i - 1] < minVerticalGap) {
        ys[i] = ys[i - 1] + minVerticalGap;
      }
    }

    // Backward pass: pull back inside bottomEdge while preserving spacing
    const maxY = Math.max(topEdge + 14, bottomEdge - 14);
    if (ys[ys.length - 1] > maxY) {
      ys[ys.length - 1] = maxY;
      for (let i = ys.length - 2; i >= 0; i--) {
        if (ys[i + 1] - ys[i] < minVerticalGap) {
          ys[i] = ys[i + 1] - minVerticalGap;
        }
      }
    }

    // Clamp top again in extreme narrow viewports
    const minY = topEdge + 14;
    if (ys[0] < minY) {
      ys[0] = minY;
      for (let i = 1; i < ys.length; i++) {
        if (ys[i] - ys[i - 1] < minVerticalGap) {
          ys[i] = Math.min(maxY, ys[i - 1] + minVerticalGap);
        }
      }
    }

    // Keep central specimen corridor open: on mobile dock cleanly to left/right flanks;
    // on desktop push tag edges past both the midline flank and each landmark's anchor dot.
    const maxFlank = Math.max(0, (openWidth - labelWidth * 2) / 2);
    const flankGap = Math.min(132, Math.max(36, maxFlank * 0.56));
    const armGap = isCompact ? 24 : 74;

    return sorted.map((item, idx) => {
      let boxX: number;
      if (isCompact) {
        boxX = side === 'left' ? leftEdge : rightEdge - labelWidth;
      } else if (side === 'left') {
        const rightEdgeTarget = Math.min(item.anchorX - armGap, midX - flankGap);
        boxX = Math.max(leftEdge, rightEdgeTarget - labelWidth);
      } else {
        const leftEdgeTarget = Math.max(item.anchorX + armGap, midX + flankGap);
        boxX = Math.min(rightEdge - labelWidth, leftEdgeTarget);
      }

      return {
        id: item.id,
        label: item.label,
        subtitle: item.subtitle,
        conceptName: item.conceptName,
        system: item.system,
        anchorX: item.anchorX,
        anchorY: item.anchorY,
        boxX: Math.max(leftEdge, Math.min(rightEdge - labelWidth, boxX)),
        boxY: ys[idx],
        side,
      };
    });
  };

  return [...placeColumn(leftBucket, 'left'), ...placeColumn(rightBucket, 'right')];
}

/**
 * Computes Quest 2 local-floor WebXR placement for the 1:1 metric anatomy rig.
 * - Full-body mode: stands on the VR floor (y = 0) 1.35m directly in front of the user.
 * - Isolated organ mode: scales small specimens up comfortably and brings them to
 *   chest/eye inspection height (~1.32m) 0.90m in front of the headset.
 */
export function getXrRigTransform(
  isolate: boolean,
  targetCenter?: [number, number, number] | null,
  targetExtent?: number
): XrRigTransform {
  if (!isolate || !targetCenter) {
    return {
      position: [0, 0, -1.35],
      scale: 1,
      rotationY: 0,
    };
  }

  const safeExtent = Math.max(0.08, targetExtent ?? 0.35);
  const scale = Math.max(1, Math.min(2.4, 0.42 / safeExtent));
  const [cx, cy, cz] = targetCenter;

  return {
    position: [-cx * scale, 1.32 - cy * scale, -0.92 - cz * scale],
    scale,
    rotationY: 0,
  };
}

/**
 * Probes WebXR immersive-vr headset support safely without throwing on older
 * browsers or non-secure HTTP contexts.
 */
export async function checkWebXrSupport(
  env?: { isSecureContext?: boolean; xr?: { isSessionSupported?: (mode: string) => Promise<boolean> } }
): Promise<WebXrCapability> {
  const isSecure =
    env?.isSecureContext !== undefined
      ? env.isSecureContext
      : typeof window !== 'undefined'
      ? window.isSecureContext
      : true;

  if (!isSecure) return 'insecure-context';

  const xr =
    env && 'xr' in env
      ? env.xr
      : typeof navigator !== 'undefined'
      ? (navigator as Navigator & { xr?: { isSessionSupported?: (mode: string) => Promise<boolean> } }).xr
      : undefined;

  if (!xr || typeof xr.isSessionSupported !== 'function') {
    return 'unsupported';
  }

  try {
    const ok = await xr.isSessionSupported('immersive-vr');
    return ok ? 'supported' : 'unsupported';
  } catch {
    return 'unsupported';
  }
}
