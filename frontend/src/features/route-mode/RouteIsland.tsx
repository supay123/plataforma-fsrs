import clsx from "clsx";
import { Check, Lock, Play } from "lucide-react";
import type { RouteLessonStatus } from "./api";
import { PracticeMascot } from "../sessions/PracticeMascot";

const ICON = { locked: Lock, available: Play, completed: Check } as const;

// Cada estado pinta la cara superior, el costado y el aro de la isla con sus colores de tema.
const PALETTE = {
  locked: { top: "bg-sunken", side: "bg-line", ring: "border-line-strong", icon: "text-fg-faint" },
  available: { top: "bg-primary", side: "bg-primary-strong", ring: "border-on-primary/40", icon: "text-on-primary" },
  completed: { top: "bg-success", side: "bg-success-strong", ring: "border-on-success/40", icon: "text-on-success" },
} as const;

// Las islas desbloqueadas brillan (luz bajo ellas y un reflejo arriba); las bloqueadas se ven apagadas.
const GLOW = { locked: "bg-black/30", available: "bg-primary/60", completed: "bg-success/50" } as const;

/**
 * Isla 2.5D de una lección: un disco con grosor armado con elipses. La isla `selected` flota
 * suavemente y lleva la mascota encima; las demás quedan quietas.
 */
export function RouteIsland({ status, selected }: { status: RouteLessonStatus; selected: boolean }) {
  const palette = PALETTE[status];
  const Icon = ICON[status];
  return <span aria-hidden className={clsx("relative block h-[70px] w-28 shrink-0", selected && "motion-safe:animate-island-float", status === "locked" && "opacity-60")}>
    <span className={clsx("absolute -bottom-2 inset-x-1 h-7 rounded-[50%] blur-md", GLOW[status])} />
    <span className={clsx("absolute inset-x-0 top-7 h-3.5", palette.side)} />
    <span className={clsx("absolute inset-x-0 bottom-0 h-14 rounded-[50%]", palette.side)} />
    <span className={clsx("absolute inset-x-0 top-0 h-14 rounded-[50%]", palette.top)}>
      {status !== "locked" && <span className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-white/30 to-transparent" />}
    </span>
    <span className={clsx("absolute inset-x-5 top-3 h-8 rounded-[50%] border-2", palette.ring)} />
    <span className={clsx("absolute inset-x-0 top-0 grid h-14 place-items-center", palette.icon)}><Icon size={22} className="scale-y-75" /></span>
    {selected && <PracticeMascot size={64} className="absolute bottom-9 left-1/2 -translate-x-1/2" />}
  </span>;
}
