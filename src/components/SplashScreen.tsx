interface SplashScreenProps {
  progress: number;
  visible: boolean;
}

export function SplashScreen({ progress, visible }: SplashScreenProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const stageLabel =
    clamped < 12
      ? 'Initializing anatomical manifest'
      : clamped < 85
      ? 'Streaming 2,234 full-body 3D structures'
      : 'Compiling PBR & X-Ray WebGL shaders';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Loading Human Anatomy 3D: ${clamped}%`}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#ecefed] text-[#18212b] transition-opacity duration-400 ${
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex flex-col items-center max-w-xs w-full px-6 text-center">
        {/* Clean Geometric Emblem (single splash loader, no redundant spinner) */}
        <div className="w-16 h-16 flex items-center justify-center mb-5">
          <svg
            viewBox="0 0 64 64"
            fill="none"
            className="w-14 h-14 shadow-[0_8px_24px_rgba(24,33,43,0.14)] rounded-2xl"
            aria-hidden="true"
          >
            <rect width="64" height="64" rx="16" fill="#18212b" />
            <ellipse
              cx="32"
              cy="34"
              rx="17"
              ry="6.5"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeOpacity="0.9"
            />
            <circle cx="32" cy="15.5" r="4.8" fill="#f8fafc" />
            <path d="M32 21.5V47.5" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />
            <path
              d="M23 26.5C25.6 24.5 28.8 23.8 32 23.8C35.2 23.8 38.4 24.5 41 26.5"
              stroke="#f8fafc"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M26.5 48.5L32 42.5L37.5 48.5"
              stroke="#f8fafc"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="font-display text-[22px] font-bold tracking-tight text-[#18212b]">
          Human Anatomy 3D
        </h1>
        <p className="text-[12.5px] text-[#5e6c7a] mt-1">{stageLabel}</p>

        {/* Precision Linear Progress Track */}
        <div className="w-full mt-5">
          <div className="h-1.5 w-full rounded-full bg-[#18212b]/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#0284c7] transition-[width] duration-200 ease-out"
              style={{ width: `${Math.max(4, clamped)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono-num text-[#667482] mt-2">
            <span>15 Organ Systems</span>
            <span>{clamped}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
