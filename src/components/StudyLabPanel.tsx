import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Focus,
  GraduationCap,
  Play,
  RotateCcw,
  Tag,
  X,
  XCircle,
} from 'lucide-react';
import { CLINICAL_TRACKS, type ClinicalTrack } from '../data/fullBodyAnatomy.ts';
import {
  SPECIALTY_LABS,
  type GuidedTourStep,
  type PhysiologicalMotion,
  type StudyQuizQuestion,
} from '../data/studyCurriculum.ts';
import type { StudyQuizSession } from '../utils/fullBodyLogic.ts';

export type StudyLabMode = 'tour' | 'quiz';

interface StudyLabPanelProps {
  open: boolean;
  collapsed: boolean;
  mode: StudyLabMode;
  track: ClinicalTrack;
  tourIndex: number;
  quizSession: StudyQuizSession;
  activeMotion: PhysiologicalMotion;
  isolated: boolean;
  hasHighlights: boolean;
  showTourLabels: boolean;
  isDark: boolean;
  onToggleCollapse: () => void;
  onToggleIsolate: () => void;
  onToggleTourLabels: () => void;
  onSelectTrack: (track: ClinicalTrack) => void;
  onChangeMode: (mode: StudyLabMode) => void;
  onSelectTourStep: (index: number) => void;
  onToggleMotion: (motion: PhysiologicalMotion) => void;
  onSubmitAnswer: (option: string) => void;
  onNextQuestion: () => void;
  onRestartQuiz: () => void;
  onClose: () => void;
}

export function StudyLabPanel({
  open,
  collapsed,
  mode,
  track,
  tourIndex,
  quizSession,
  activeMotion,
  isolated,
  hasHighlights,
  showTourLabels,
  isDark,
  onToggleCollapse,
  onToggleIsolate,
  onToggleTourLabels,
  onSelectTrack,
  onChangeMode,
  onSelectTourStep,
  onToggleMotion,
  onSubmitAnswer,
  onNextQuestion,
  onRestartQuiz,
  onClose,
}: StudyLabPanelProps) {
  if (!open) return null;

  const lab = SPECIALTY_LABS[track] ?? SPECIALTY_LABS.all;
  const currentStep: GuidedTourStep | undefined = lab.tourSteps[tourIndex] ?? lab.tourSteps[0];
  const currentQ: StudyQuizQuestion | undefined = lab.quiz[quizSession.currentIndex];

  const surfaceCls = isDark
    ? 'bg-[#0c1622]/96 border-[#7bc4e8]/18 text-[#e8f3fb]'
    : 'bg-white/96 border-[#18212b]/10 text-[#18212b] shadow-[0_14px_44px_rgba(24,33,43,0.11)]';
  const muted = isDark ? 'text-[#89a9c2]' : 'text-[#667482]';
  const divider = isDark ? 'border-[#7bc4e8]/12' : 'border-[#18212b]/10';
  const subtleBg = isDark ? 'bg-[#102032]' : 'bg-[#f4f6f5]';
  const secondaryBtn = isDark
    ? 'bg-[#122234] hover:bg-[#1a314a] border-[#7bc4e8]/18 text-[#e8f3fb]'
    : 'bg-[#f4f6f5] hover:bg-[#e8edeb] border-[#18212b]/10 text-[#18212b]';

  return (
    <section
      aria-label="Interactive Clinical Study Lab"
      className={`pointer-events-auto w-full lg:absolute lg:left-16 lg:top-16 lg:bottom-auto lg:w-[336px] lg:max-h-[calc(100vh-176px)] z-30 rounded-2xl border flex flex-col overflow-hidden ${
        collapsed ? 'max-h-none' : 'max-h-[46vh]'
      } ${surfaceCls}`}
    >
      {/* Mobile Collapsed Compact Tour / Quiz Control Bar */}
      {collapsed && (
        <div className="flex lg:hidden items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
            aria-label="Expand Study Lab"
          >
            <GraduationCap className="w-4 h-4 text-[#0284c7] shrink-0" />
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold truncate leading-tight">
                {mode === 'tour' && currentStep
                  ? `${tourIndex + 1}/${lab.tourSteps.length} · ${currentStep.title}`
                  : quizSession.completed
                  ? `Quiz Complete · ${quizSession.score}/${quizSession.total}`
                  : `Q${quizSession.currentIndex + 1}/${quizSession.total} · Score ${quizSession.score}`}
              </p>
              <p className={`text-[10.5px] truncate ${muted}`}>
                {mode === 'tour' ? lab.headline : 'Tap organ in 3D or expand'}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            {mode === 'tour' && (
              <>
                <button
                  type="button"
                  disabled={tourIndex <= 0}
                  onClick={() => onSelectTourStep(Math.max(0, tourIndex - 1))}
                  aria-label="Previous tour step"
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer disabled:opacity-35 ${secondaryBtn}`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTourStep((tourIndex + 1) % lab.tourSteps.length)}
                  aria-label="Next tour step"
                  className="w-7 h-7 rounded-lg bg-[#0284c7] text-white flex items-center justify-center cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expand Study Lab"
              aria-label="Expand Study Lab"
              className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer ${secondaryBtn}`}
            >
              <ChevronUp className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Close Study Lab"
              aria-label="Close Study Lab"
              className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${muted} hover:opacity-100`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Full Expanded Panel (always visible on desktop lg+, toggleable on mobile) */}
      <div className={`${collapsed ? 'hidden lg:flex' : 'flex'} flex-col flex-1 min-h-0`}>
        {/* Header */}
        <div className={`px-3.5 sm:px-4 py-2.5 sm:py-3 border-b flex items-center justify-between gap-2 ${divider}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-wider text-[#0284c7]">
              <GraduationCap className="w-3.5 h-3.5 shrink-0" />
              <span>Study Lab</span>
            </div>
            <h2 className="font-display text-[14.5px] sm:text-[15px] font-bold tracking-tight truncate mt-0.5">
              {lab.headline}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`lg:hidden p-1.5 rounded-lg border cursor-pointer ${secondaryBtn}`}
              title="Collapse Study Lab to view 3D model"
              aria-label="Collapse Study Lab"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg cursor-pointer ${muted} hover:opacity-100`}
              aria-label="Close study lab"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Quick Specialty Switcher Strip (scrolls cleanly horizontally on phones) */}
        <div className={`flex lg:hidden items-center gap-1 px-3 py-1.5 border-b overflow-x-auto ${divider}`}>
          {CLINICAL_TRACKS.map((t) => {
            const active = track === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTrack(t.id)}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#0284c7] text-white'
                    : isDark
                    ? 'bg-[#102032] text-[#a9c8df]'
                    : 'bg-[#f1f4f2] text-[#455360]'
                }`}
              >
                {t.shortLabel}
              </button>
            );
          })}
        </div>

        {/* Mode Switch: Guided Tour vs 3D Quiz */}
        <div className={`px-3 sm:px-3.5 py-1.5 sm:py-2 border-b flex items-center justify-between gap-2 ${divider}`}>
          <div className={`grid grid-cols-2 p-0.5 rounded-lg flex-1 ${isDark ? 'bg-[#071019]' : 'bg-[#eaeeec]'}`}>
            <button
              type="button"
              onClick={() => onChangeMode('tour')}
              className={`py-1.5 rounded-md text-[11.5px] sm:text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'tour'
                  ? isDark
                    ? 'bg-[#0284c7] text-white'
                    : 'bg-white text-[#18212b] shadow-sm'
                  : muted
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Guided Tour</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('quiz')}
              className={`py-1.5 rounded-md text-[11.5px] sm:text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'quiz'
                  ? isDark
                    ? 'bg-[#0284c7] text-white'
                    : 'bg-white text-[#18212b] shadow-sm'
                  : muted
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>3D Quiz</span>
            </button>
          </div>

          {mode === 'tour' && (
            <button
              type="button"
              aria-pressed={showTourLabels}
              aria-label="Toggle 3D Labels"
              onClick={onToggleTourLabels}
              title={showTourLabels ? 'Hide on-screen 3D labels' : 'Show on-screen 3D labels'}
              className={`px-2 py-1.5 rounded-lg text-[11.5px] font-semibold flex items-center gap-1 border cursor-pointer transition-colors shrink-0 ${
                showTourLabels
                  ? 'bg-[#0284c7] border-[#0284c7] text-white'
                  : isDark
                  ? 'bg-[#102032] border-[#7bc4e8]/20 text-[#cfe7f8]'
                  : 'bg-[#f4f6f5] border-[#18212b]/10 text-[#18212b]'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Labels</span>
            </button>
          )}

          {lab.motionType !== 'none' && lab.motionLabel && (
            <button
              type="button"
              onClick={() =>
                onToggleMotion(activeMotion === lab.motionType ? 'none' : lab.motionType)
              }
              title={lab.motionLabel}
              className={`px-2 py-1.5 rounded-lg text-[11.5px] font-semibold flex items-center gap-1 border cursor-pointer transition-colors shrink-0 ${
                activeMotion === lab.motionType
                  ? 'bg-[#0284c7] border-[#0284c7] text-white'
                  : isDark
                  ? 'bg-[#102032] border-[#7bc4e8]/20 text-[#cfe7f8]'
                  : 'bg-[#f4f6f5] border-[#18212b]/10 text-[#18212b]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{activeMotion === lab.motionType ? 'Live' : 'Motion'}</span>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 sm:space-y-3.5 atlas-scroll">
          {mode === 'tour' && currentStep ? (
            <>
              <div className="flex items-center justify-between text-[11px] font-mono-num">
                <span className={muted}>
                  Step {tourIndex + 1} of {lab.tourSteps.length}
                </span>
                <div className="flex items-center gap-1">
                  {lab.tourSteps.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectTourStep(idx)}
                      aria-label={`Tour step ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        idx === tourIndex
                          ? 'w-5 bg-[#0284c7]'
                          : isDark
                          ? 'w-1.5 bg-white/20'
                          : 'w-1.5 bg-[#18212b]/20'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-display text-[14.5px] sm:text-[15px] font-bold leading-snug">
                  {currentStep.title}
                </h3>
                <p className="text-[12px] sm:text-[12.5px] leading-relaxed mt-1">{currentStep.summary}</p>
              </div>

              <div className={`rounded-xl p-2.5 sm:p-3 text-[11.5px] sm:text-[12px] leading-relaxed ${subtleBg}`}>
                <span className="font-semibold text-[#0284c7]">Clinical note: </span>
                <span>{currentStep.clinicalPearl}</span>
              </div>
            </>
          ) : quizSession.completed ? (
            <div className="text-center py-2 sm:py-3 space-y-2.5 sm:space-y-3">
              <p className="font-mono-num text-[26px] sm:text-[28px] font-bold text-[#0284c7]">
                {quizSession.score} / {quizSession.total}
              </p>
              <p className="font-display text-[15px] font-bold">Specialty Quiz Complete</p>
              <p className={`text-[12px] sm:text-[12.5px] ${muted}`}>
                Accuracy: {quizSession.total > 0 ? Math.round((quizSession.score / quizSession.total) * 100) : 0}% across {lab.headline}.
              </p>
              <button
                type="button"
                onClick={onRestartQuiz}
                className="w-full py-2 sm:py-2.5 px-4 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-[12.5px] font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retry Quiz</span>
              </button>
            </div>
          ) : currentQ ? (
            <>
              <div className="flex items-center justify-between text-[11px] font-mono-num">
                <span className={muted}>
                  Question {quizSession.currentIndex + 1} / {quizSession.total}
                </span>
                <span className="text-[#0284c7] font-semibold">
                  Score {quizSession.score} · Streak {quizSession.streak}
                </span>
              </div>

              <p className="text-[12.5px] sm:text-[13px] font-medium leading-relaxed">{currentQ.prompt}</p>
              <p className={`text-[11px] sm:text-[11.5px] ${muted}`}>
                Hint: {currentQ.hint} (Choose below or tap directly on the 3D body)
              </p>

              <div className="grid grid-cols-2 gap-1.5">
                {currentQ.options.map((opt) => {
                  const answered = quizSession.answeredOption !== null;
                  const isPicked =
                    quizSession.answeredOption?.toLowerCase() === opt.toLowerCase();
                  const isTarget = opt.toLowerCase() === currentQ.targetConcept.toLowerCase();

                  let cls = isDark
                    ? 'bg-[#102032] border-[#7bc4e8]/18 text-[#e8f3fb] hover:bg-[#16304b]'
                    : 'bg-[#f4f6f5] border-[#18212b]/10 text-[#18212b] hover:bg-[#e9eeec]';

                  if (answered && isTarget) {
                    cls = 'bg-[#0f766e] border-[#0f766e] text-white';
                  } else if (answered && isPicked && !isTarget) {
                    cls = 'bg-[#be123c] border-[#be123c] text-white';
                  }

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={answered}
                      onClick={() => onSubmitAnswer(opt)}
                      className={`py-1.5 sm:py-2 px-2.5 rounded-xl border text-[11.5px] sm:text-[12px] font-semibold text-left transition-colors cursor-pointer disabled:cursor-default ${cls}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {quizSession.answeredOption !== null && (
                <div className={`rounded-xl p-2.5 sm:p-3 space-y-2 ${subtleBg}`}>
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                    {quizSession.lastCorrect ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[#0f766e]" />
                        <span>Correct — highlighted in 3D</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-[#be123c]" />
                        <span>
                          Target:{' '}
                          {currentQ.targetConcept.charAt(0).toUpperCase() +
                            currentQ.targetConcept.slice(1)}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-[11.5px] sm:text-[12px] leading-relaxed opacity-90">{currentQ.explanation}</p>
                  <button
                    type="button"
                    onClick={onNextQuestion}
                    className="w-full py-2 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-[12px] font-semibold cursor-pointer"
                  >
                    {quizSession.currentIndex + 1 < quizSession.total
                      ? 'Next Question'
                      : 'View Score'}
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Pinned Guided Tour Navigation & Topic Isolation Footer (never clipped on mobile) */}
        {mode === 'tour' && currentStep && (
          <div className={`px-3 sm:px-4 py-2 sm:py-2.5 border-t flex items-center justify-between gap-2 shrink-0 ${divider}`}>
            <button
              type="button"
              disabled={tourIndex <= 0}
              onClick={() => onSelectTourStep(Math.max(0, tourIndex - 1))}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[12px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-35 ${subtleBg}`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            {hasHighlights && (
              <button
                type="button"
                onClick={onToggleIsolate}
                title={isolated ? 'Show surrounding context' : 'Isolate key study parts'}
                className={`px-2.5 py-1.5 sm:py-2 rounded-xl text-[11.5px] font-semibold border flex items-center gap-1 cursor-pointer transition-colors ${
                  isolated
                    ? 'bg-[#0284c7] border-[#0284c7] text-white'
                    : secondaryBtn
                }`}
              >
                <Focus className="w-3.5 h-3.5" />
                <span>{isolated ? 'Context' : 'Isolate'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                onSelectTourStep((tourIndex + 1) % lab.tourSteps.length)
              }
              className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[12px] font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white flex items-center gap-1 cursor-pointer"
            >
              <span>{tourIndex + 1 < lab.tourSteps.length ? 'Next' : 'Replay'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

