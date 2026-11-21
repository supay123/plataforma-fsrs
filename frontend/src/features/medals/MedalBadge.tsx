import { useId, type ReactNode } from "react";
import type { MedalCode } from "./api";
import { MEDAL_NAMES, medalFamily } from "./medals";

interface Metal { light: string; base: string; dark: string; ink: string }

/** Colores fijos (no siguen el tema de la institución): cada familia se reconoce por su metal. */
const METAL_BY_FAMILY: Record<string, Metal> = {
  "Postulante": { light: "#e9b184", base: "#b9703a", dark: "#7a4219", ink: "#4a2610" },
  "Pre-Universitario": { light: "#f1f5f9", base: "#a8b3c2", dark: "#667386", ink: "#2d3643" },
  "Candidato": { light: "#6ee7b7", base: "#10b981", dark: "#047857", ink: "#053d2c" },
  "Pre-Ingresante": { light: "#c4b5fd", base: "#7c5cf0", dark: "#4a2fb0", ink: "#231566" },
  "Ingresante": { light: "#fde68a", base: "#e0a526", dark: "#a8700c", ink: "#5c3b04" },
};

const STAR_PATH = "M0 -7 L2.1 -2.2 L7 -1.9 L3.2 1.4 L4.4 6.3 L0 3.6 L-4.4 6.3 L-3.2 1.4 L-7 -1.9 L-2.1 -2.2 Z";

function tierOf(code: MedalCode): 1 | 2 | 3 | null {
  const last = code.at(-1);
  return last === "1" ? 1 : last === "2" ? 2 : last === "3" ? 3 : null;
}

/** Cintas que cuelgan detrás del cuerpo de la medalla. */
function Ribbons({ metal }: { metal: Metal }) {
  return <g>
    <path d="M30 4 L46 40 L58 34 L42 4 Z" fill={metal.dark} />
    <path d="M66 4 L50 40 L38 34 L54 4 Z" fill={metal.base} />
  </g>;
}

interface BodyProps { metal: Metal; gradient: string }

/** Cada familia tiene su propia silueta y su propio símbolo central, para distinguirlas sin leer el nombre. */
const BODY_BY_FAMILY: Record<string, (props: BodyProps) => ReactNode> = {
  // Disco con un libro abierto: el primer paso.
  "Postulante": ({ metal, gradient }) => <>
    <Ribbons metal={metal} />
    <circle cx="48" cy="56" r="30" fill={metal.dark} />
    <circle cx="48" cy="54" r="29" fill={`url(#${gradient})`} stroke={metal.ink} strokeWidth="2" />
    <circle cx="48" cy="54" r="22" fill="none" stroke={metal.light} strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="2 3" />
    <path d="M48 62 V46 M48 46 C42 42 35 42 31 44 V60 C35 58 42 58 48 62 C54 58 61 58 65 60 V44 C61 42 54 42 48 46 Z" fill={metal.ink} fillOpacity="0.85" stroke={metal.ink} strokeWidth="1.5" strokeLinejoin="round" />
  </>,
  // Hexágono con barras ascendentes: se empieza a subir.
  "Pre-Universitario": ({ metal, gradient }) => <>
    <Ribbons metal={metal} />
    <path d="M48 24 L74 39 V69 L48 84 L22 69 V39 Z" fill={metal.dark} transform="translate(0 2)" />
    <path d="M48 24 L74 39 V69 L48 84 L22 69 V39 Z" fill={`url(#${gradient})`} stroke={metal.ink} strokeWidth="2" strokeLinejoin="round" />
    <path d="M48 31 L67 42 V66 L48 77 L29 66 V42 Z" fill="none" stroke={metal.light} strokeOpacity="0.8" strokeWidth="1.5" strokeLinejoin="round" />
    <g fill={metal.ink} fillOpacity="0.85">
      <rect x="35" y="58" width="7" height="9" rx="1.5" />
      <rect x="44.5" y="50" width="7" height="17" rx="1.5" />
      <rect x="54" y="42" width="7" height="25" rx="1.5" />
    </g>
  </>,
  // Escudo con una diana: ya apunta al examen.
  "Candidato": ({ metal, gradient }) => <>
    <Ribbons metal={metal} />
    <path d="M48 22 C58 28 68 28 76 27 V50 C76 66 62 78 48 86 C34 78 20 66 20 50 V27 C28 28 38 28 48 22 Z" fill={metal.dark} transform="translate(0 2)" />
    <path d="M48 22 C58 28 68 28 76 27 V50 C76 66 62 78 48 86 C34 78 20 66 20 50 V27 C28 28 38 28 48 22 Z" fill={`url(#${gradient})`} stroke={metal.ink} strokeWidth="2" strokeLinejoin="round" />
    <circle cx="48" cy="50" r="15" fill="none" stroke={metal.ink} strokeOpacity="0.85" strokeWidth="3" />
    <circle cx="48" cy="50" r="7" fill={metal.ink} fillOpacity="0.85" />
    <path d="M48 50 L62 36 M58 35 L63 35 L63 40" fill="none" stroke={metal.light} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  // Roseta de 12 puntas con estrella: a un paso de ingresar.
  "Pre-Ingresante": ({ metal, gradient }) => <>
    <Ribbons metal={metal} />
    <path d={rosettePath(48, 54, 32, 27, 12)} fill={metal.dark} transform="translate(0 2)" />
    <path d={rosettePath(48, 54, 32, 27, 12)} fill={`url(#${gradient})`} stroke={metal.ink} strokeWidth="2" strokeLinejoin="round" />
    <circle cx="48" cy="54" r="19" fill="none" stroke={metal.light} strokeOpacity="0.8" strokeWidth="1.5" />
    <path d={STAR_PATH} transform="translate(48 54) scale(2.1)" fill={metal.ink} fillOpacity="0.85" stroke={metal.ink} strokeWidth="1" strokeLinejoin="round" />
  </>,
  // Corona de laurel con birrete y destellos: ingresó.
  "Ingresante": ({ metal, gradient }) => <>
    <Leaves side="left" metal={metal} />
    <Leaves side="right" metal={metal} />
    <circle cx="48" cy="50" r="27" fill={metal.dark} transform="translate(0 2)" />
    <circle cx="48" cy="50" r="27" fill={`url(#${gradient})`} stroke={metal.ink} strokeWidth="2" />
    <circle cx="48" cy="50" r="21" fill="none" stroke={metal.light} strokeOpacity="0.85" strokeWidth="1.5" />
    <path d="M48 36 L70 46 L48 56 L26 46 Z" fill={metal.ink} fillOpacity="0.9" stroke={metal.ink} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M36 52 V60 C42 65 54 65 60 60 V52 L48 57 Z" fill={metal.ink} fillOpacity="0.9" />
    <path d="M70 46 V58" stroke={metal.ink} strokeWidth="2" strokeLinecap="round" />
    <circle cx="70" cy="59" r="2" fill={metal.ink} />
    <g fill="#fff" fillOpacity="0.95">
      <path d="M82 8 L84 14 L90 16 L84 18 L82 24 L80 18 L74 16 L80 14 Z" />
      <path d="M12 10 L13.5 14 L17.5 15.5 L13.5 17 L12 21 L10.5 17 L6.5 15.5 L10.5 14 Z" />
    </g>
  </>,
};

function rosettePath(centerX: number, centerY: number, outerRadius: number, innerRadius: number, points: number): string {
  const commands: string[] = [];
  for (let index = 0; index < points * 2; index += 1) {
    const angle = (Math.PI * index) / points - Math.PI / 2;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    commands.push(`${index === 0 ? "M" : "L"}${(centerX + radius * Math.cos(angle)).toFixed(2)} ${(centerY + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `${commands.join(" ")} Z`;
}

/** Hojas de laurel repartidas en arco a un lado de la medalla central. */
function Leaves({ side, metal }: { side: "left" | "right"; metal: Metal }) {
  const mirror = side === "right" ? "translate(96 0) scale(-1 1)" : undefined;
  const leafAngles = [100, 124, 148, 172, 196, 220];
  return <g transform={mirror} fill={metal.base} stroke={metal.ink} strokeWidth="1.2">
    {leafAngles.map((angle) => {
      const radians = (angle * Math.PI) / 180;
      const x = 48 + 37 * Math.cos(radians);
      const y = 50 + 37 * Math.sin(radians);
      return <path key={angle} d="M0 -9 C6 -5 6 5 0 9 C-6 5 -6 -5 0 -9 Z" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle - 180 + 10})`} />;
    })}
  </g>;
}

/** Medalla ilustrada de cada código (13 en total). Las estrellas de abajo indican el escalón (1, 2 o 3) de la familia. */
export function MedalBadge({ code, size = 96, locked = false, glow = false, title }: { code: MedalCode; size?: number; locked?: boolean; glow?: boolean; title?: string }) {
  const family = medalFamily(code);
  const metal = METAL_BY_FAMILY[family]!;
  const tier = tierOf(code);
  const gradient = useId();
  const name = title ?? MEDAL_NAMES[code];
  const Body = BODY_BY_FAMILY[family]!;
  return <svg role="img" aria-label={name} viewBox="0 0 96 96" width={size} height={size} className="shrink-0" style={locked ? { filter: "grayscale(1) brightness(0.55)", opacity: 0.7 } : glow ? { filter: `drop-shadow(0 0 6px ${metal.base})` } : undefined}>
    <defs>
      <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={metal.light} />
        <stop offset="0.55" stopColor={metal.base} />
        <stop offset="1" stopColor={metal.dark} />
      </linearGradient>
    </defs>
    {Body({ metal, gradient })}
    {tier !== null && <g aria-hidden>
      {Array.from({ length: tier }, (_, index) => <path key={index} d={STAR_PATH} transform={`translate(${48 + (index - (tier - 1) / 2) * 14} 88) scale(0.95)`} fill="#fde68a" stroke={metal.ink} strokeWidth="1.2" strokeLinejoin="round" />)}
    </g>}
  </svg>;
}
