import React from 'react';

// 统一的线性图标集，stroke 跟随 currentColor，保证风格一致、缩小仍清晰。
const PATHS = {
  home: <path d="M3.5 10.6 12 3.8l8.5 6.8M5.8 9.4V20a1 1 0 0 0 1 1h10.4a1 1 0 0 0 1-1V9.4" />,
  heart: <path d="M12 20.4 4.7 13.2a4.7 4.7 0 0 1 6.6-6.7l.7.7.7-.7a4.7 4.7 0 0 1 6.6 6.7Z" />,
  box: (
    <>
      <rect x="3" y="7.6" width="18" height="12.8" rx="2.6" />
      <path d="M3 12.4h18M8.2 7.6V6.2a2 2 0 0 1 2-2h3.6a2 2 0 0 1 2 2v1.4" />
    </>
  ),
  card: (
    <>
      <rect x="2.6" y="5" width="18.8" height="14" rx="3" />
      <path d="M2.6 10h18.8M6.6 15h3.6" />
    </>
  ),
  gear: (
    <>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
      <path d="M1 14h6M9 8h6M17 16h6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  gift: (
    <>
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M12 9v12M3 13h18M12 9c-3.5 0-5.5-1.2-5.5-3S9 3.5 12 6c3-2.5 5.5-2.2 5.5-.4S15.5 9 12 9Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 6" />
      <path d="M20 5v6h-6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 5h16l1.5 11H2.5Z" />
      <path d="M2.5 16v3h19v-3" />
    </>
  ),
  arrowRight: <path d="M4 12h16m-6-6 6 6-6 6" />,
};

export function Icon({ name, size = 20, className = '', strokeWidth = 1.9 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name] || PATHS.home}
    </svg>
  );
}
