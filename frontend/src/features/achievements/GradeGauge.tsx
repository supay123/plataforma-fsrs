import type { ReactNode } from "react";

const MAX_GRADE = 20;

/** Medidor semicircular de 0 a 20; el arco se llena hasta la nota y `children` (la cifra) va dentro. */
export function GradeGauge({ grade, children }: { grade: number | null; children: ReactNode }) {
  const filled = grade === null ? 0 : Math.max(0, Math.min(1, grade / MAX_GRADE)) * 100;
  return <div className="relative w-48 max-w-full">
    <svg aria-hidden viewBox="0 0 100 54" className="block w-full" fill="none" strokeLinecap="round">
      <path d="M8 50 A42 42 0 0 1 92 50" pathLength={100} className="stroke-sunken" strokeWidth="9" />
      <path d="M8 50 A42 42 0 0 1 92 50" pathLength={100} className="stroke-primary transition-[stroke-dasharray] duration-700 ease-out" strokeWidth="9" strokeDasharray={`${filled} 100`} />
    </svg>
    <span aria-hidden className="absolute bottom-0 left-1 text-[0.65rem] tabular-nums text-fg-faint">0</span>
    <span aria-hidden className="absolute bottom-0 right-0 text-[0.65rem] tabular-nums text-fg-faint">{MAX_GRADE}</span>
    <div className="absolute inset-x-0 bottom-0 text-center">{children}</div>
  </div>;
}
