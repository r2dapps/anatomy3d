import {
  Activity,
  CheckCircle2,
  Eye,
  EyeOff,
  Glasses,
  Play,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  CLINICAL_TRACKS,
  SYSTEMS,
  SYSTEM_BY_ID,
  type ClinicalTrack,
  type Part,
  type SystemId,
} from '../data/fullBodyAnatomy.ts';
import { SPECIALTY_LABS, type PhysiologicalMotion } from '../data/studyCurriculum.ts';
import type { QualityTier } from '../utils/fullBodyLogic.ts';
import type { WebXrCapability } from '../utils/xrAndLabelsLogic.ts';

interface LayersDrawerProps {
  open: boolean;
  tab: 'systems' | 'hidden';
  activeTrack: ClinicalTrack;
  activeMotion: PhysiologicalMotion;
  visibleSystems: SystemId[];
  systemCounts: Record<SystemId, number>;
  visiblePartCount: number;
  hiddenParts: Part[];
  exposure: number;
  qualityTier: QualityTier;
  vrCapability: WebXrCapability;
  vrActive: boolean;
  vrNotice: string | null;
  isDark: boolean;
  onChangeTab: (tab: 'systems' | 'hidden') => void;
  onSelectTrack: (track: ClinicalTrack) => void;
  onStartTour: () => void;
  onStartQuiz: () => void;
  onToggleMotion: (motion: PhysiologicalMotion) => void;
  onToggleSystem: (id: SystemId) => void;
  onSoloSystem: (id: SystemId) => void;
  onShowAllSystems: () => void;
  onHideAllSystems: () => void;
  onUnhidePart: (partId: string) => void;
  onUnhideAll: () => void;
  onChangeExposure: (val: number) => void;
  onChangeQuality: (tier: QualityTier) => void;
  onToggleVrMode: () => void;
  onClose: () => void;
}

export function LayersDrawer({
  open,
  tab,
  activeTrack,
  activeMotion,
  visibleSystems,
  systemCounts,
  visiblePartCount,
  hiddenParts,
  exposure,
  qualityTier,
  vrCapability,
  vrActive,
  vrNotice,
  isDark,
  onChangeTab,
  onSelectTrack,
  onStartTour,
  onStartQuiz,
  onToggleMotion,
  onToggleSystem,
  onSoloSystem,
  onShowAllSystems,
  onHideAllSystems,
  onUnhidePart,
  onUnhideAll,
  onChangeExposure,
  onChangeQuality,
  onToggleVrMode,
  onClose,
}: LayersDrawerProps) {
  if (!open) return null;

  const lab = SPECIALTY_LABS[activeTrack] ?? SPECIALTY_LABS.all;
  const surfaceCls = isDark
    ? 'bg-[#0c1622]/96 border-[#7bc4e8]/16 text-[#e8f3fb]'
    : 'bg-white/96 border-[#18212b]/10 text-[#18212b] shadow-[0_12px_40px_rgba(24,33,43,0.09)]';
  const muted = isDark ? 'text-[#89a9c2]' : 'text-[#667482]';
  const divider = isDark ? 'border-[#7bc4e8]/12' : 'border-[#18212b]/9';

  return (
    <aside
      aria-label="Anatomy systems and study controls"
      className={`fixed lg:absolute top-16 right-3 bottom-24 w-[calc(100vw-24px)] max-w-[292px] z-30 rounded-2xl border flex flex-col overflow-hidden ${surfaceCls}`}
    >
      {/* Top Tab Bar */}
      <div className={`flex items-center justify-between px-3.5 py-2.5 border-b ${divider}`}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeTab('systems')}
            className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer ${
              tab === 'systems'
                ? isDark
                  ? 'bg-[#17314a] text-white'
                  : 'bg-[#1d2733] text-white'
                : `${muted} hover:opacity-100`
            }`}
          >
            Systems
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('hidden')}
            className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              tab === 'hidden'
                ? isDark
                  ? 'bg-[#17314a] text-white'
                  : 'bg-[#1d2733] text-white'
                : `${muted} hover:opacity-100`
            }`}
          >
            <span>Hidden</span>
            <span className="font-mono-num text-[11px] opacity-80">{hiddenParts.length}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`p-1.5 rounded-lg cursor-pointer ${muted} hover:opacity-100`}
          aria-label="Close systems panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {tab === 'systems' ? (
        <>
          {/* Clinical Specialty Focus + Direct Interactive Tour / Quiz / Motion Triggers */}
          <div className={`px-3.5 py-2.5 border-b space-y-2 ${divider}`}>
            <p className={`text-[10.5px] font-semibold uppercase tracking-wider ${muted}`}>
              Clinical Study Focus
            </p>
            <div className="grid grid-cols-3 gap-1">
              {CLINICAL_TRACKS.map((track) => {
                const active = activeTrack === track.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => onSelectTrack(track.id)}
                    title={track.phaseNote}
                    className={`py-1 px-1.5 rounded-lg text-[11.5px] font-medium transition-colors cursor-pointer truncate ${
                      active
                        ? isDark
                          ? 'bg-[#0284c7] text-white'
                          : 'bg-[#1d2733] text-white'
                        : isDark
                        ? 'bg-[#112233] text-[#9ec0d8] hover:text-white'
                        : 'bg-[#f2f4f3] text-[#455360] hover:text-[#18212b]'
                    }`}
                  >
                    {track.shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Interactive Specialty Activity Bar (Tour, Quiz, Motion) */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={onStartTour}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11.5px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  isDark
                    ? 'bg-[#13293f] hover:bg-[#1a3a57] text-[#7dd3fc]'
                    : 'bg-[#eaf4fa] hover:bg-[#d9edf8] text-[#0369a1]'
                }`}
              >
                <Play className="w-3 h-3" />
                <span>Tour</span>
              </button>
              <button
                type="button"
                onClick={onStartQuiz}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11.5px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  isDark
                    ? 'bg-[#13293f] hover:bg-[#1a3a57] text-[#e8f3fb]'
                    : 'bg-[#f2f4f3] hover:bg-[#e5eae8] text-[#18212b]'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Quiz</span>
              </button>
              {lab.motionType !== 'none' && (
                <button
                  type="button"
                  onClick={() =>
                    onToggleMotion(activeMotion === lab.motionType ? 'none' : lab.motionType)
                  }
                  title={lab.motionLabel}
                  aria-label={lab.motionLabel ?? 'Toggle physiological motion'}
                  className={`py-1.5 px-2 rounded-lg text-[11.5px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                    activeMotion === lab.motionType
                      ? 'bg-[#0284c7] text-white'
                      : isDark
                      ? 'bg-[#13293f] text-[#9ec0d8]'
                      : 'bg-[#f2f4f3] text-[#455360]'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 15 Full-Body Anatomical Systems */}
          <div
            className={`flex-1 overflow-y-auto px-2 py-1 atlas-scroll ${
              isDark ? 'atlas-scroll-dark' : ''
            }`}
          >
            {SYSTEMS.map((sys) => {
              const checked = visibleSystems.includes(sys.id);
              const count = systemCounts[sys.id] ?? 0;
              return (
                <div
                  key={sys.id}
                  className={`flex items-center justify-between gap-2 px-2 py-1 rounded-xl transition-colors ${
                    isDark ? 'hover:bg-white/5' : 'hover:bg-[#f4f6f5]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSoloSystem(sys.id)}
                    title={`Show only ${sys.name.toLowerCase()}`}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer py-0.5"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: sys.color }}
                      aria-hidden="true"
                    />
                    <span
                      className={`text-[12.5px] truncate ${
                        checked ? 'font-medium' : `${muted} line-through opacity-75`
                      }`}
                    >
                      {sys.name}
                    </span>
                    <span className={`font-mono-num text-[10.5px] ml-auto pr-1 ${muted}`}>
                      {count}
                    </span>
                  </button>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSystem(sys.id)}
                      aria-label={`Toggle ${sys.name}`}
                      className="sr-only"
                    />
                    <span
                      className={`w-9 h-5 rounded-full transition-colors block ${
                        checked
                          ? isDark
                            ? 'bg-[#0284c7]'
                            : 'bg-[#1d2733]'
                          : isDark
                          ? 'bg-[#203347]'
                          : 'bg-[#d0d7da]'
                      }`}
                    >
                      <span
                        className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ml-0.5 ${
                          checked ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </span>
                  </label>
                </div>
              );
            })}
          </div>

          {/* Compact Footer: Exposure, GPU Tier & Show/Hide All */}
          <div className={`px-3.5 py-2.5 border-t space-y-2 ${divider}`}>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className={`w-3.5 h-3.5 shrink-0 ${muted}`} />
              <input
                type="range"
                aria-label="Shader exposure"
                min={0.6}
                max={1.6}
                step={0.05}
                value={exposure}
                onChange={(e) => onChangeExposure(Number(e.target.value))}
                className={`flex-1 atlas-slider ${isDark ? 'atlas-slider-dark' : ''}`}
              />
              <select
                aria-label="WebGL performance quality"
                value={qualityTier}
                onChange={(e) => onChangeQuality(e.target.value as QualityTier)}
                className={`rounded-lg px-2 py-1 text-[11px] font-medium border outline-none cursor-pointer ${
                  isDark
                    ? 'bg-[#071019] border-[#7bc4e8]/20 text-[#cfe7f8]'
                    : 'bg-[#f4f6f5] border-[#18212b]/10 text-[#455360]'
                }`}
              >
                <option value="auto" className="text-[#18212b]">
                  Auto GPU
                </option>
                <option value="high" className="text-[#18212b]">
                  High 2x
                </option>
                <option value="balanced" className="text-[#18212b]">
                  Tablet 1.5x
                </option>
                <option value="low" className="text-[#18212b]">
                  Eco 1x
                </option>
              </select>
            </div>

            {/* Quest 2 WebXR Spatial VR Mode Toggle */}
            <div className={`pt-2 border-t space-y-1.5 ${divider}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Glasses className={`w-4 h-4 shrink-0 ${vrActive ? 'text-[#0284c7]' : muted}`} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold leading-tight truncate">VR Mode</p>
                    <p className={`text-[10.5px] leading-tight truncate ${muted}`}>
                      {vrActive
                        ? 'Quest 2 session active'
                        : vrCapability === 'supported'
                        ? 'WebXR headset ready'
                        : vrCapability === 'insecure-context'
                        ? 'Requires HTTPS for Quest 2'
                        : 'Quest 2 WebXR spatial view'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={vrActive}
                  aria-label="VR Mode"
                  onClick={onToggleVrMode}
                  title="Initialize WebXR immersive-vr session for Meta Quest 2"
                  className={`relative inline-flex items-center w-9 h-5 rounded-full transition-colors shrink-0 cursor-pointer ${
                    vrActive
                      ? 'bg-[#0284c7]'
                      : isDark
                      ? 'bg-[#203347]'
                      : 'bg-[#d0d7da]'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ml-0.5 ${
                      vrActive ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {vrNotice && (
                <p
                  role="status"
                  className={`text-[11px] leading-snug rounded-lg px-2.5 py-1.5 border ${
                    isDark
                      ? 'bg-[#102032] border-[#7bc4e8]/18 text-[#cfe7f8]'
                      : 'bg-[#f4f6f5] border-[#18212b]/10 text-[#455360]'
                  }`}
                >
                  {vrNotice}
                </p>
              )}
            </div>

            <div className={`flex items-center justify-between pt-1.5 border-t text-[11.5px] ${divider}`}>
              <span className={`font-mono-num ${muted}`}>
                {visiblePartCount.toLocaleString()} visible
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onShowAllSystems}
                  className="font-medium hover:underline cursor-pointer"
                >
                  Show all
                </button>
                <button
                  type="button"
                  onClick={onHideAllSystems}
                  className={`${muted} hover:underline cursor-pointer`}
                >
                  Hide all
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Dedicated Hidden Structures Manager */
        <div className="flex-1 flex flex-col min-h-0">
          {hiddenParts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <EyeOff className={`w-6 h-6 mb-2 opacity-40 ${muted}`} />
              <p className="text-[13px] font-medium">No hidden structures</p>
              <p className={`text-[12px] mt-1 leading-relaxed ${muted}`}>
                Use Peel mode or Shift + Click any mesh to hide it instantly. Press U anytime to undo the last hide.
              </p>
            </div>
          ) : (
            <>
              <div className={`px-3.5 py-2.5 border-b flex items-center justify-between ${divider}`}>
                <span className={`text-[12px] ${muted}`}>
                  {hiddenParts.length} hidden {hiddenParts.length === 1 ? 'structure' : 'structures'}
                </span>
                <button
                  type="button"
                  onClick={onUnhideAll}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#0284c7] hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Unhide all</span>
                </button>
              </div>

              <div
                className={`flex-1 overflow-y-auto px-2 py-2 space-y-1 atlas-scroll ${
                  isDark ? 'atlas-scroll-dark' : ''
                }`}
              >
                {hiddenParts.map((part) => {
                  const sys = SYSTEM_BY_ID[part.system];
                  return (
                    <div
                      key={part.id}
                      className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl ${
                        isDark ? 'bg-white/5' : 'bg-[#f4f6f5]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium truncate">
                          {part.name.charAt(0).toUpperCase() + part.name.slice(1)}
                        </p>
                        <p className={`text-[11px] truncate ${muted}`}>{sys?.name ?? part.system}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUnhidePart(part.id)}
                        className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold cursor-pointer transition-colors ${
                          isDark
                            ? 'bg-[#17314a] hover:bg-[#1e4060] text-[#7dd3fc]'
                            : 'bg-white hover:bg-[#e8edeb] border border-[#18212b]/10 text-[#18212b]'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Unhide</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
