import { ChevronDown, ChevronRight, ChevronUp, Eye, EyeOff, Focus, X } from 'lucide-react';
import {
  SYSTEM_BY_ID,
  getStructureExplanation,
  type Concept,
  type Part,
} from '../data/fullBodyAnatomy.ts';

interface StructureSheetProps {
  open: boolean;
  collapsed: boolean;
  concept: Concept | null;
  selectedParts: Part[];
  hiddenPartIds: ReadonlySet<string>;
  isolated: boolean;
  isDark: boolean;
  onToggleCollapse: () => void;
  onToggleIsolate: () => void;
  onHideSelected: () => void;
  onUnhideSelected: () => void;
  onSelectPart: (partId: string) => void;
  onClearSelection: () => void;
}

export function StructureSheet({
  open,
  collapsed,
  concept,
  selectedParts,
  hiddenPartIds,
  isolated,
  isDark,
  onToggleCollapse,
  onToggleIsolate,
  onHideSelected,
  onUnhideSelected,
  onSelectPart,
  onClearSelection,
}: StructureSheetProps) {
  if (!open || !concept || selectedParts.length === 0) return null;

  const primary = selectedParts[0];
  const system = SYSTEM_BY_ID[primary.system];
  const info = getStructureExplanation(concept.name, primary.system);
  const allHidden = selectedParts.every((p) => hiddenPartIds.has(p.id));
  const anyHidden = selectedParts.some((p) => hiddenPartIds.has(p.id));
  const displayName = concept.name.charAt(0).toUpperCase() + concept.name.slice(1);

  const surfaceCls = isDark
    ? 'bg-[#0c1622]/96 border-[#7bc4e8]/18 text-[#e8f3fb]'
    : 'bg-white/96 border-[#18212b]/10 text-[#18212b] shadow-[0_14px_44px_rgba(24,33,43,0.11)]';
  const muted = isDark ? 'text-[#89a9c2]' : 'text-[#667482]';
  const divider = isDark ? 'border-[#7bc4e8]/12' : 'border-[#18212b]/10';
  const secondaryBtn = isDark
    ? 'bg-[#122234] hover:bg-[#1a314a] border-[#7bc4e8]/18 text-[#e8f3fb]'
    : 'bg-[#f4f6f5] hover:bg-[#e8edeb] border-[#18212b]/10 text-[#18212b]';

  return (
    <aside
      aria-label="Selected anatomical structure details"
      className={`pointer-events-auto w-full lg:absolute lg:top-16 lg:left-16 lg:bottom-24 lg:w-[312px] lg:max-h-none z-30 rounded-2xl border flex flex-col overflow-hidden ${
        collapsed ? 'max-h-none' : 'max-h-[42vh]'
      } ${surfaceCls}`}
    >
      {/* Mobile Collapsed Compact Bar (keeps selection & isolation active while freeing 3D viewport) */}
      {collapsed && (
        <div className="flex lg:hidden items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
            aria-label={`Expand ${displayName} details`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: system?.color ?? '#94a3b8' }}
              aria-hidden="true"
            />
            <span className="font-display text-[13.5px] font-bold truncate">{displayName}</span>
            {isolated && (
              <span className="px-1.5 py-0.5 rounded-md bg-[#0284c7]/15 text-[#0284c7] text-[10px] font-semibold uppercase tracking-wide shrink-0">
                Isolated
              </span>
            )}
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onToggleIsolate}
              title={isolated ? 'Show surrounding anatomy' : 'Isolate structure'}
              aria-label={isolated ? 'Show surrounding anatomy' : 'Isolate structure'}
              className={`h-7 px-2 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                isolated
                  ? 'bg-[#0284c7] text-white'
                  : isDark
                  ? 'bg-[#17314a] text-white'
                  : 'bg-[#1d2733] text-white'
              }`}
            >
              <Focus className="w-3.5 h-3.5" />
              <span>{isolated ? 'All' : 'Isolate'}</span>
            </button>

            <button
              type="button"
              onClick={allHidden ? onUnhideSelected : onHideSelected}
              title={allHidden ? 'Unhide structure' : 'Hide structure'}
              aria-label={allHidden ? 'Unhide structure' : 'Hide structure'}
              className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer ${secondaryBtn}`}
            >
              {allHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expand structure details"
              aria-label="Expand structure details"
              className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer ${secondaryBtn}`}
            >
              <ChevronUp className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClearSelection}
              title="Clear selection"
              aria-label="Clear structure selection"
              className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${muted} hover:opacity-100`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Full Sheet Content (always shown on desktop lg+, shown on mobile when not collapsed) */}
      <div className={`${collapsed ? 'hidden lg:flex' : 'flex'} flex-col flex-1 min-h-0`}>
        {/* Header */}
        <div className={`px-3.5 sm:px-4 pt-3 sm:pt-4 pb-2.5 sm:pb-3 border-b ${divider}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-wider">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: system?.color ?? '#94a3b8' }}
                  aria-hidden="true"
                />
                <span className={`truncate ${muted}`}>
                  {info.discipline}
                  {system && info.discipline !== system.name ? ` · ${system.name}` : ''}
                </span>
              </div>
              <h2 className="font-display text-[16px] sm:text-[18px] font-bold tracking-tight leading-snug mt-0.5 sm:mt-1 truncate">
                {displayName}
              </h2>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onToggleCollapse}
                className={`lg:hidden p-1.5 rounded-lg border cursor-pointer ${secondaryBtn}`}
                title="Collapse card to inspect 3D model"
                aria-label="Collapse structure details"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                className={`p-1.5 rounded-lg cursor-pointer ${muted} hover:opacity-100`}
                aria-label="Close structure details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Explanation & Sub-pieces */}
        <div
          className={`flex-1 overflow-y-auto px-3.5 sm:px-4 py-2.5 sm:py-3.5 space-y-2.5 sm:space-y-3.5 atlas-scroll ${
            isDark ? 'atlas-scroll-dark' : ''
          }`}
        >
          <p className="text-[12.5px] sm:text-[13px] leading-relaxed">{info.text}</p>

          <div className={`flex items-center justify-between text-[11px] sm:text-[11.5px] font-mono-num pt-2 border-t ${divider} ${muted}`}>
            <span>FMA {concept.id}</span>
            <span>
              {selectedParts.length.toLocaleString()}{' '}
              {selectedParts.length === 1 ? 'mesh' : 'meshes'}
            </span>
          </div>

          {selectedParts.length > 1 && (
            <div className={`pt-2 border-t ${divider}`}>
              <p className={`text-[10.5px] font-semibold uppercase tracking-wider mb-1.5 ${muted}`}>
                Included Structures
              </p>
              <div className="space-y-0.5">
                {selectedParts.slice(0, 30).map((part) => {
                  const isPartHidden = hiddenPartIds.has(part.id);
                  return (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() => onSelectPart(part.id)}
                      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left text-[12px] cursor-pointer transition-colors ${
                        isDark ? 'hover:bg-white/5' : 'hover:bg-[#f4f6f5]'
                      }`}
                    >
                      <span className={`truncate ${isPartHidden ? `${muted} line-through` : ''}`}>
                        {part.name.charAt(0).toUpperCase() + part.name.slice(1)}
                      </span>
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${muted}`} />
                    </button>
                  );
                })}
                {selectedParts.length > 30 && (
                  <p className={`text-[11px] px-2 pt-1 ${muted}`}>
                    +{selectedParts.length - 30} more modeled pieces
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Clean Action Footer: Isolate + Hide / Unhide */}
        <div className={`p-2.5 sm:p-3 border-t space-y-1.5 sm:space-y-2 ${divider}`}>
          <button
            type="button"
            onClick={onToggleIsolate}
            className={`w-full py-2 sm:py-2.5 px-3 rounded-xl text-[12px] sm:text-[12.5px] font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              isolated
                ? 'bg-[#0284c7] hover:bg-[#0369a1] text-white'
                : isDark
                ? 'bg-[#17314a] hover:bg-[#1f4264] text-white'
                : 'bg-[#1d2733] hover:bg-[#2a3848] text-white'
            }`}
          >
            <Focus className="w-4 h-4" />
            <span>{isolated ? 'Show surrounding anatomy' : 'Isolate structure'}</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            {allHidden ? (
              <button
                type="button"
                onClick={onUnhideSelected}
                className="py-1.5 sm:py-2 px-3 rounded-xl text-[12px] font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Unhide</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onHideSelected}
                className={`py-1.5 sm:py-2 px-3 rounded-xl text-[12px] font-medium border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${secondaryBtn}`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>{anyHidden ? 'Hide rest' : 'Hide'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClearSelection}
              className={`py-1.5 sm:py-2 px-3 rounded-xl text-[12px] font-medium border cursor-pointer transition-colors ${secondaryBtn}`}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

