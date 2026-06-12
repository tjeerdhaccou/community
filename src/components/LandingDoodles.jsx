// Handgetekende SVG-doodles voor de landing page.
// Stroke-based en kleur via currentColor. Elk path heeft pathLength="1"
// zodat CSS een teken-animatie kan doen met stroke-dasharray/-dashoffset
// (zie .lp-reveal in landing.css).

const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
}

export function UnderlineDoodle({ className = '', strokeWidth = 5, stretch = false }) {
  return (
    <svg
      {...base}
      viewBox="0 0 240 26"
      className={`doodle ${className}`}
      strokeWidth={strokeWidth}
      preserveAspectRatio={stretch ? 'none' : 'xMidYMid meet'}
    >
      <path pathLength="1" d="M5 15 C45 7 85 20 125 12 C160 5 200 17 235 9" />
      <path pathLength="1" d="M40 21 C90 15 150 23 205 16" />
    </svg>
  )
}

export function CircleDoodle({ className = '', strokeWidth = 4 }) {
  return (
    <svg
      {...base}
      viewBox="0 0 260 110"
      className={`doodle ${className}`}
      strokeWidth={strokeWidth}
      preserveAspectRatio="none"
    >
      <path
        pathLength="1"
        d="M150 14 C80 4 16 28 13 55 C10 86 72 103 140 100 C208 97 250 76 247 50 C244 22 192 6 118 11 C96 13 76 17 62 23"
      />
    </svg>
  )
}

export function ArrowDoodle({ className = '', strokeWidth = 5 }) {
  return (
    <svg {...base} viewBox="0 0 120 110" className={`doodle ${className}`} strokeWidth={strokeWidth}>
      <path pathLength="1" d="M16 8 C20 48 44 82 94 92" />
      <path pathLength="1" d="M94 92 C84 86 77 82 70 79" />
      <path pathLength="1" d="M94 92 C87 96 81 101 77 107" />
    </svg>
  )
}

export function SparkleDoodle({ className = '', strokeWidth = 3.5 }) {
  return (
    <svg {...base} viewBox="0 0 44 44" className={`doodle ${className}`} strokeWidth={strokeWidth}>
      <path
        pathLength="1"
        d="M22 4 C23 14 30 21 40 22 C30 23 23 30 22 40 C21 30 14 23 4 22 C14 21 21 14 22 4 Z"
      />
    </svg>
  )
}

export function SunDoodle({ className = '', strokeWidth = 4 }) {
  return (
    <svg {...base} viewBox="0 0 72 72" className={`doodle ${className}`} strokeWidth={strokeWidth}>
      <path pathLength="1" d="M36 22 a14 14 0 1 0 0.1 0" />
      <path pathLength="1" d="M36 4 L36 12" />
      <path pathLength="1" d="M36 60 L36 68" />
      <path pathLength="1" d="M4 36 L12 36" />
      <path pathLength="1" d="M60 36 L68 36" />
      <path pathLength="1" d="M13 13 L19 19" />
      <path pathLength="1" d="M53 53 L59 59" />
      <path pathLength="1" d="M59 13 L53 19" />
      <path pathLength="1" d="M19 53 L13 59" />
    </svg>
  )
}

export function HeartDoodle({ className = '', strokeWidth = 4 }) {
  return (
    <svg {...base} viewBox="0 0 48 44" className={`doodle ${className}`} strokeWidth={strokeWidth}>
      <path
        pathLength="1"
        d="M24 38 C10 28 4 18 9 11 C14 5 22 8 24 15 C26 8 34 5 39 11 C44 18 38 28 24 38 Z"
      />
    </svg>
  )
}

export function SquiggleDoodle({ className = '', strokeWidth = 4 }) {
  return (
    <svg
      {...base}
      viewBox="0 0 240 24"
      className={`doodle ${className}`}
      strokeWidth={strokeWidth}
      preserveAspectRatio="none"
    >
      <path
        pathLength="1"
        vectorEffect="non-scaling-stroke"
        d="M4 12 Q16 2 28 12 T52 12 T76 12 T100 12 T124 12 T148 12 T172 12 T196 12 T220 12 T236 12"
      />
    </svg>
  )
}

export function AsteriskDoodle({ className = '', strokeWidth = 4 }) {
  return (
    <svg {...base} viewBox="0 0 40 40" className={`doodle ${className}`} strokeWidth={strokeWidth}>
      <path pathLength="1" d="M20 4 L20 36" />
      <path pathLength="1" d="M6 11 L34 29" />
      <path pathLength="1" d="M34 11 L6 29" />
    </svg>
  )
}

export function SmileyDoodle({ className = '', strokeWidth = 4 }) {
  return (
    <svg {...base} viewBox="0 0 56 56" className={`doodle ${className}`} strokeWidth={strokeWidth}>
      <path pathLength="1" d="M28 6 a22 22 0 1 0 0.1 0" />
      <path pathLength="1" d="M20 22 L20 27" />
      <path pathLength="1" d="M36 22 L36 27" />
      <path pathLength="1" d="M18 34 C22 41 34 41 38 34" />
    </svg>
  )
}

export function HouseDoodle({ className = '', strokeWidth = 4 }) {
  return (
    <svg {...base} viewBox="0 0 72 64" className={`doodle ${className}`} strokeWidth={strokeWidth}>
      <path pathLength="1" d="M8 32 L36 8 L64 32" />
      <path pathLength="1" d="M16 28 L16 56 L56 56 L56 28" />
      <path pathLength="1" d="M30 56 L30 42 C30 39 42 39 42 42 L42 56" />
      <path pathLength="1" d="M50 16 L50 10" />
    </svg>
  )
}
