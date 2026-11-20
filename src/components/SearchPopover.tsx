import { useEffect, useMemo, useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { Concept } from '../data/fullBodyAnatomy.ts';
import { searchConcepts } from '../utils/fullBodyLogic.ts';

interface SearchPopoverProps {
  open: boolean;
  query: string;
  concepts: readonly Concept[];
  isDark: boolean;
  onChangeQuery: (q: string) => void;
  onChooseConcept: (concept: Concept) => void;
  onClose: () => void;
}

export function SearchPopover({
  open,
  query,
  concepts,
  isDark,
  onChangeQuery,
  onChooseConcept,
  onClose,
}: SearchPopoverProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const results = useMemo(() => searchConcepts(concepts, query, 60), [concepts, query]);

  if (!open) return null;

  const surfaceCls = isDark
    ? 'bg-[#0c1622]/98 border-[#7bc4e8]/20 text-[#e8f3fb]'
    : 'bg-white/98 border-[#18212b]/12 text-[#18212b] shadow-[0_18px_54px_rgba(24,33,43,0.16)]';
  const muted = isDark ? 'text-[#89a9c2]' : 'text-[#667482]';
  const divider = isDark ? 'border-[#7bc4e8]/12' : 'border-[#18212b]/10';

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center pt-16 sm:pt-20 px-3 bg-[#09121c]/25"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Search full-body anatomical structures"
        className={`w-full max-w-[460px] rounded-2xl border overflow-hidden ${surfaceCls}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${divider}`}>
          <Search className={`w-4 h-4 shrink-0 ${muted}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            placeholder="Search 3,432 structures (heart, lung, femur, molar, deltoid…)"
            className="flex-1 bg-transparent border-0 outline-none text-[13.5px] placeholder:opacity-60"
          />
          {query && (
            <button
              type="button"
              onClick={() => onChangeQuery('')}
              className={`p-1 rounded-md cursor-pointer ${muted}`}
              aria-label="Clear search query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`font-mono-num text-[11px] px-1.5 py-0.5 rounded border cursor-pointer ${divider} ${muted}`}
          >
            Esc
          </button>
        </div>

        <div
          className={`max-h-[54vh] overflow-y-auto p-1.5 atlas-scroll ${
            isDark ? 'atlas-scroll-dark' : ''
          }`}
        >
          {results.length === 0 ? (
            <p className={`text-[12.5px] text-center py-8 ${muted}`}>
              No anatomical structures match “{query}”.
            </p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChooseConcept(c);
                  onClose();
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-white/6' : 'hover:bg-[#f2f5f4]'
                }`}
              >
                <span className="text-[13px] font-medium truncate">
                  {c.name.charAt(0).toUpperCase() + c.name.slice(1)}
                </span>
                <span className={`font-mono-num text-[11px] shrink-0 ${muted}`}>
                  {c.elements.length} {c.elements.length === 1 ? 'piece' : 'pieces'}
                </span>
              </button>
            ))
          )}
        </div>

        <div className={`px-4 py-2 border-t text-[11px] ${divider} ${muted}`}>
          {query
            ? `Showing up to 60 ranked matches across 3,432 FMA concepts`
            : `Featured organs & bones · Type to search all 3,432 structures`}
        </div>
      </div>
    </div>
  );
}
