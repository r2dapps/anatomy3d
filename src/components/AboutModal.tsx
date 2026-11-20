import { Cpu, Database, Glasses, Keyboard, X } from 'lucide-react';

interface AboutModalProps {
  open: boolean;
  isSoftwareGl: boolean;
  partCount: number;
  conceptCount: number;
  onClose: () => void;
}

export function AboutModal({
  open,
  isSoftwareGl,
  partCount,
  conceptCount,
  onClose,
}: AboutModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0d1722]/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-atlas-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white border border-[#18212b]/12 shadow-[0_20px_60px_rgba(15,23,32,0.2)] p-5 text-[#18212b] space-y-4 max-h-[88vh] overflow-y-auto atlas-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="about-atlas-title" className="font-display text-lg font-bold tracking-tight">
              Human Anatomy 3D
            </h2>
            <p className="text-[12px] text-[#667482] mt-0.5">
              Full-Body Interactive WebGL Explorer ({partCount.toLocaleString()} meshes ·{' '}
              {conceptCount.toLocaleString()} concepts)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#667482] hover:bg-[#f2f5f4] hover:text-[#18212b] cursor-pointer"
            aria-label="Close about dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[13px] text-[#3a4754] leading-relaxed">
          An interactive full-body adult anatomical study environment spanning 15 organ systems, real-time Solid PBR &amp; Radiographic X-Ray shaders, Sagittal/Axial/Coronal section cuts, instant peel-to-hide dissection, and guided specialty Study Labs for Cardiology, Pulmonology, Orthopedics, Physiotherapy, and Dentistry.
        </p>

        <div className="rounded-xl bg-[#f5f7f6] border border-[#18212b]/8 p-3.5 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5d6c7a] flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            <span>WebGL Optimization &amp; Mobile Smoothness</span>
          </p>
          <p className="text-[12px] text-[#4c5b69] leading-relaxed">
            Per-system batched draw calls driven by GPU DataTextures, quantized 16-bit normals, gzipped chunk streaming, zero-recompile shader clipping planes, demand-driven rendering (0% idle GPU), and adaptive DPR budgets for phones and tablets.
          </p>
          {isSoftwareGl && (
            <p className="text-[11.5px] font-mono-num text-[#0369a1]">
              Software WebGL detected — Eco 1x pacing active.
            </p>
          )}
        </div>

        <div className="rounded-xl bg-[#f0f7fb] border border-[#0284c7]/15 p-3.5 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0369a1] flex items-center gap-1.5">
            <Glasses className="w-3.5 h-3.5" />
            <span>WebXR Roadmap (Meta Quest 2 Ready)</span>
          </p>
          <p className="text-[12px] text-[#3a4e5e] leading-relaxed">
            Built on a 1:1 real-world metric scene root (~1.72m standing scale, local-floor origin) with low draw-call batching prepared for future 72 Hz Meta Quest 2 WebXR spatial dissection.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5d6c7a] flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5" />
            <span>Fast Dissection &amp; Navigation Shortcuts</span>
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-[#4c5b69]">
            <div className="flex justify-between">
              <span>Search structures</span>
              <kbd className="font-mono-num text-[11px] px-1.5 py-0.5 rounded bg-[#eef1ef] border border-[#18212b]/10">
                /
              </kbd>
            </div>
            <div className="flex justify-between">
              <span>Peel quick-hide</span>
              <kbd className="font-mono-num text-[11px] px-1.5 py-0.5 rounded bg-[#eef1ef] border border-[#18212b]/10">
                P / Shift+Click
              </kbd>
            </div>
            <div className="flex justify-between">
              <span>Hide selected</span>
              <kbd className="font-mono-num text-[11px] px-1.5 py-0.5 rounded bg-[#eef1ef] border border-[#18212b]/10">
                H
              </kbd>
            </div>
            <div className="flex justify-between">
              <span>Undo last hide</span>
              <kbd className="font-mono-num text-[11px] px-1.5 py-0.5 rounded bg-[#eef1ef] border border-[#18212b]/10">
                U
              </kbd>
            </div>
            <div className="flex justify-between">
              <span>Solid / X-Ray</span>
              <kbd className="font-mono-num text-[11px] px-1.5 py-0.5 rounded bg-[#eef1ef] border border-[#18212b]/10">
                X
              </kbd>
            </div>
            <div className="flex justify-between">
              <span>Reset view</span>
              <kbd className="font-mono-num text-[11px] px-1.5 py-0.5 rounded bg-[#eef1ef] border border-[#18212b]/10">
                R
              </kbd>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-[#18212b]/10 space-y-2 text-[11.5px] text-[#556371] leading-relaxed">
          <p className="font-semibold uppercase tracking-wider text-[10.5px] text-[#475467] flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" />
            <span>Dataset &amp; Open-Source Attributions</span>
          </p>
          <ul className="space-y-1.5 pl-1 list-disc list-inside">
            <li>
              <strong>BodyParts3D 4.0:</strong> © The Database Center for Life Science (DBCLS), licensed under{' '}
              <a
                href="https://creativecommons.org/licenses/by-sa/2.1/jp/"
                target="_blank"
                rel="noreferrer"
                className="text-[#0369a1] hover:underline"
              >
                CC BY-SA 2.1 JP
              </a>{' '}
              (see{' '}
              <a
                href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
                target="_blank"
                rel="noreferrer"
                className="text-[#0369a1] hover:underline"
              >
                DBCLS License Policy
              </a>
              ).
            </li>
            <li>
              <strong>Atlas Pipeline:</strong> Batched WebGL geometry and atlas architecture inspired by{' '}
              <a
                href="https://github.com/ashemag/human-atlas"
                target="_blank"
                rel="noreferrer"
                className="text-[#0369a1] hover:underline"
              >
                ashemag/human-atlas
              </a>{' '}
              (MIT License).
            </li>
            <li>
              <strong>Live AR Tracking:</strong> Real-time on-device computer vision landmarks powered by{' '}
              <a
                href="https://developers.google.com/mediapipe"
                target="_blank"
                rel="noreferrer"
                className="text-[#0369a1] hover:underline"
              >
                Google MediaPipe
              </a>{' '}
              (Apache 2.0).
            </li>
            <li>
              <strong>Rendering Engine:</strong> Real-time 3D WebGL and WebXR stereo pipeline built with{' '}
              <a
                href="https://threejs.org/"
                target="_blank"
                rel="noreferrer"
                className="text-[#0369a1] hover:underline"
              >
                Three.js
              </a>{' '}
              (MIT License).
            </li>
          </ul>
          <p className="text-[11px] text-[#6b7280] pt-1">
            Strictly for academic education and anatomical study — not a clinical diagnostic instrument.
          </p>
        </div>
      </div>
    </div>
  );
}
