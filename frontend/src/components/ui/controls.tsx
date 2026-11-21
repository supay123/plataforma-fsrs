import type { ReactNode } from "react";

// El ícono va después del control para poder resaltarlo con `peer-focus`.
export const ControlIcon = ({ icon }: { icon: ReactNode }) =>
  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 grid w-11 place-items-center text-slate-500 peer-focus:text-indigo-600 dark:peer-focus:text-emerald-400 portal:peer-focus:text-primary-text">{icon}</span>;
