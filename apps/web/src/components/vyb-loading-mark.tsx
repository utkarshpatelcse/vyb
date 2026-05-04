import type { ReactNode } from "react";

type VybLoadingMarkProps = {
  className?: string;
  title?: string;
};

type VybLoadingStateProps = {
  background?: ReactNode;
  className?: string;
  label?: string;
};

export function VybLoadingMark({ className = "", title = "Loading Vyb" }: VybLoadingMarkProps) {
  return (
    <svg
      className={`vyb-loading-mark ${className}`.trim()}
      viewBox="0 0 320 260"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="vybLoaderGlow" x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.20 0 0 0 0 0.78 0 0 0 0 1 0 0 0 0.7 0"
          />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="vybLoaderSoftShadow" x="-30%" y="-40%" width="160%" height="190%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#02081a" floodOpacity="0.52" />
        </filter>
        <mask id="vybLoaderTealCut" maskUnits="userSpaceOnUse">
          <rect x="0" y="0" width="320" height="260" fill="white" />
          <path className="vyb-loader-teal-cut-mask" d="M165 158L184 184L158 184Z" fill="black" />
        </mask>
      </defs>

      <g className="vyb-loader-color-fall" filter="url(#vybLoaderGlow)" aria-hidden="true">
        <path
          className="vyb-loader-stream vyb-loader-stream-left"
          d="M100 96V138"
          fill="none"
          pathLength="1"
        />
        <path
          className="vyb-loader-stream vyb-loader-stream-right"
          d="M220 96V138"
          fill="none"
          pathLength="1"
        />
      </g>

      <g className="vyb-loader-logo-form" filter="url(#vybLoaderSoftShadow)">
        <path
          className="vyb-loader-arm vyb-loader-arm-right"
          d="M212 148L160 214"
          fill="none"
          mask="url(#vybLoaderTealCut)"
          pathLength="1"
        />
        <path
          className="vyb-loader-arm vyb-loader-arm-left"
          d="M108 148L160 214"
          fill="none"
          pathLength="1"
        />
      </g>

      <g className="vyb-loader-dots" filter="url(#vybLoaderGlow)" aria-hidden="true">
        <circle className="vyb-loader-dot vyb-loader-dot-left" cx="100" cy="96" r="20" />
        <circle className="vyb-loader-dot vyb-loader-dot-right" cx="220" cy="96" r="20" />
      </g>
    </svg>
  );
}

export function VybLoadingState({
  background,
  className = "",
  label = "Loading Vyb content"
}: VybLoadingStateProps) {
  return (
    <main className={`vyb-loading-page ${className}`.trim()} aria-busy="true" aria-live="polite">
      {background ? (
        <div className="vyb-loading-background" aria-hidden="true">
          {background}
        </div>
      ) : null}
      <section className="vyb-loading-panel" aria-label={label}>
        <VybLoadingMark />
        <span className="vyb-loading-status">Loading Vyb</span>
      </section>
    </main>
  );
}
