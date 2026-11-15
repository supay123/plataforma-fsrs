// Guía de estilo (solo desarrollo): estilo elegido para el portal del estudiante. Mezcla Brilliant
// (botones y tarjetas con borde 3D, camino de temas, mascota que reacciona) con la identidad de
// Chancón (oscuro, jade y dorado, rombos, números romanos). Colores en palette.ts: dos fondos,
// `bg-base` y `bg-blocks`, cada uno con su texto (`text-on-base`, `text-on-blocks`) en blanco o negro.
// Tipografías gratuitas (OFL): Archivo (títulos y cifras) y Plus Jakarta Sans (cuerpo), cargadas en
// index.html. Utilidades de styles.css: `type-display` (ancho 125 %) para títulos de página y
// cifras grandes; `type-heading` (110 %) para títulos dentro de tarjetas.
// Referencia ligera: solo la sección "Mi aprendizaje". Escritorio: menú lateral; móvil: barra
// inferior de iconos (con una sola sección por ahora).
//
// Reglas de layout (evitan desbordes horizontales):
// - El marco es una cuadrícula `16rem | minmax(0,1fr)`: el menú ocupa su columna (sticky), sin
//   `fixed` ni márgenes calculados a mano.
// - Toda cuadrícula declara columnas con `minmax(0, …)` (`grid-cols-1` ya lo es), para que un texto
//   largo se recorte con "…" en vez de ensanchar la página.
// - Las columnas de contenido responden al ancho del contenedor (`@container`, variantes `@xl:`),
//   no al de la ventana: con o sin menú lateral, cada tarjeta tiene sitio.
import clsx from "clsx";
import { ArrowLeft, Check, ChevronRight, Flame, GraduationCap, Lock, LogOut, Palette, RotateCcw, Search, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Logo } from "../../components/layout/Logo";
import { PracticeMascot } from "../../features/sessions/PracticeMascot";
import { MathText } from "../../lib/math";
import { courses, formatPercentage, gradeOf, question, student, topics, totalGrade, totalScore, useDemo, XP_PER_CORRECT, type DemoOption } from "./demo";
import { answerXp, streakLabel } from "../../features/xp/xp";
import type { XpRules } from "../../types/contracts";
import { blackOrWhite, DEFAULT_PALETTES, paletteVars, STATUS, type BasePalette } from "../../lib/theme/palette";

const display = "type-display";
const heading = "type-heading";
const body = "type-body";
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
// Reglas de xp de la demo (las reales vienen del servidor).
const XP_RULES: XpRules = { xp_per_correct: XP_PER_CORRECT, streak_3_bonus: 15, streak_7_bonus: 42, streak_20_bonus: 137, level: 0, xp: 0, xp_to_next: 100 };

type Demo = ReturnType<typeof useDemo>;
type Course = (typeof courses)[number];
const current = topics.find((topic) => topic.percentage === null && !topic.blocked)!;

// ── Piezas ───────────────────────────────────────────────────────────────────────────────

type ButtonKind = "primary" | "secondary" | "success" | "danger";

function Button({ kind = "primary", children, onClick, disabled, className }: { kind?: ButtonKind; children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  const tone = {
    primary: "bg-(--c-primary) text-(--c-on-primary) [--edge:var(--c-primary-strong)] hover:brightness-105",
    secondary: "border-2 border-(--c-line-strong) bg-blocks text-on-blocks [--edge:var(--c-line-strong)] hover:brightness-110",
    success: "bg-(--c-success) text-(--c-on-success) [--edge:var(--c-success-strong)]",
    danger: "bg-(--c-danger) text-(--c-on-danger) [--edge:var(--c-danger-strong)]",
  }[kind];
  return <button type="button" onClick={onClick} disabled={disabled} className={clsx(
    "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold shadow-[0_4px_0_var(--edge)] transition-[transform,box-shadow,filter,background-color] duration-100 enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-40",
    tone, className,
  )}>{children}</button>;
}

function Card({ children, className, onClick, label }: { children: ReactNode; className?: string; onClick?: () => void; label?: string }) {
  const Tag = onClick ? "button" : "div";
  return <Tag type={onClick ? "button" : undefined} onClick={onClick} aria-label={label} className={clsx(
    "block w-full rounded-2xl border-2 border-(--c-line) bg-blocks text-left text-on-blocks shadow-[0_4px_0_var(--c-line)]",
    onClick && "transition hover:border-(--c-primary) active:translate-y-0.5",
    className,
  )}>{children}</Tag>;
}

function Bar({ value, tone = "primary", size = "md" }: { value: number; tone?: "primary" | "success"; size?: "sm" | "md" }) {
  return <div className={clsx("w-full overflow-hidden rounded-full bg-(--c-sunken)", size === "sm" ? "h-1.5" : "h-3")}>
    <div className={clsx("h-full rounded-full transition-[width] duration-500", tone === "primary" ? "bg-(--c-primary)" : "bg-(--c-success)")} style={{ width: `${Math.min(100, value)}%` }} />
  </div>;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase">
    <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-(--c-secondary)" />{children}
  </p>;
}

function PageTitle({ eyebrow, children, description }: { eyebrow?: string; children: ReactNode; description?: string }) {
  return <header>
    {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
    <h1 className={clsx("mt-1 text-3xl sm:text-4xl", display)}>{children}</h1>
    {description && <p className="mt-1 text-muted">{description}</p>}
  </header>;
}

type Mood = "idle" | "happy" | "sad" | "thinking";

/** Cabeza de la mascota (la misma de la práctica: 3D animada, con la cabeza PNG de respaldo). */
function Mascot({ mood = "idle", size = 72, className }: { mood?: Mood; size?: number; className?: string }) {
  return <PracticeMascot mood={mood} size={size} className={className} />;
}

// ── Inicio ───────────────────────────────────────────────────────────────────────────────

/** La nota de siempre. Con 15–30 cursos no se listan todos: solo el más fuerte y el más débil. */
function GradeCard() {
  const practiced = courses.filter((course) => course.percentage !== null).sort((a, b) => b.percentage! - a.percentage!);
  const best = practiced[0];
  const weakest = practiced[practiced.length - 1];
  return <Card className="p-5 sm:p-6">
    <Eyebrow>Tu nota</Eyebrow>
    <div className="mt-2 flex items-end justify-between gap-4">
      <p className={clsx("text-5xl leading-none tabular-nums [font-variant-numeric:lining-nums_tabular-nums]", display)}>{totalGrade}<span className={clsx("ml-1 text-base", body, "text-faint")}>/ 20</span></p>
      <p className="text-right text-sm text-muted"><span className="font-semibold text-on-blocks tabular-nums">{formatPercentage(totalScore)}</span> de acierto</p>
    </div>
    <div className="mt-4"><Bar value={totalScore} /></div>
    {best && weakest && best !== weakest && <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-(--c-line) pt-3 text-sm">
      <div className="min-w-0"><dt className="text-xs text-faint">Más fuerte</dt><dd className="flex justify-between gap-2 text-muted"><span className="truncate">{best.name}</span><span className="text-on-blocks tabular-nums">{gradeOf(best.percentage!)}</span></dd></div>
      <div className="min-w-0"><dt className="text-xs text-faint">Por reforzar</dt><dd className="flex justify-between gap-2 text-muted"><span className="truncate">{weakest.name}</span><span className="text-on-blocks tabular-nums">{gradeOf(weakest.percentage!)}</span></dd></div>
    </dl>}
  </Card>;
}

function CourseRow({ course, index, onOpen }: { course: Course; index: number; onOpen: () => void }) {
  const practiced = course.percentage !== null;
  return <Card onClick={onOpen} className="p-4" label={course.name}>
    <div className="flex items-center gap-3">
      <span className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg", heading, index % 2 ? "bg-(--c-secondary-soft) text-(--c-secondary-text)" : "bg-(--c-primary-soft) text-(--c-primary-text)")}>{course.name[0]}</span>
      <div className="min-w-0 flex-1">
        <p className={clsx("truncate text-lg", heading)}>{course.name}</p>
        <p className="text-sm text-muted">{practiced ? `${formatPercentage(course.percentage!)} de acierto` : "Sin practicar"}</p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-faint" />
    </div>
    <div className="mt-3"><Bar value={course.percentage ?? 0} size="sm" /></div>
  </Card>;
}

function PanelView({ demo, openCourse }: { demo: Demo; openCourse: (course: Course) => void }) {
  return <div className="grid grid-cols-1 gap-8">
    <header className="flex items-center gap-4">
      <Mascot size={56} />
      <div>
        <h1 className={clsx("text-3xl sm:text-4xl", display)}>Hola, {student.name.split(" ")[0]}</h1>
        <p className="mt-1 text-muted">Sigue con tu próximo tema.</p>
      </div>
    </header>

    <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card className="relative overflow-hidden p-5 sm:p-6">
        <Eyebrow>Continúa donde lo dejaste</Eyebrow>
        <p className={clsx("mt-2 text-2xl sm:text-3xl", heading)}>{current.name}</p>
        <p className="mt-1 text-sm text-muted">{courses[0]!.name} · 20 preguntas · ~10 min</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={demo.startPractice}>Practicar</Button>
          <span className="text-sm font-semibold text-(--c-secondary-text)">+{XP_PER_CORRECT} xp por acierto</span>
        </div>
        <Mascot size={110} className="pointer-events-none absolute -right-3 -bottom-4 hidden @xl:block" />
      </Card>
      <GradeCard />
    </div>

    <CourseList openCourse={openCourse} />
  </div>;
}

// ── Cursos ───────────────────────────────────────────────────────────────────────────────

/** Todos los cursos con buscador y cuadrícula compacta (un colegio tiene 15–30 cursos). */
function CourseList({ openCourse }: { openCourse: (course: Course) => void }) {
  const [query, setQuery] = useState("");
  const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const visible = courses.filter((course) => normalize(course.name).includes(normalize(query.trim())));
  return <section className="grid grid-cols-1 gap-4">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h2 className={clsx("text-2xl", display)}>Mis cursos <span className={clsx("text-base text-faint", body)}>({courses.length})</span></h2>
      <label className="relative block w-full @xl:max-w-xs">
        <span className="sr-only">Buscar curso</span>
        <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar curso"
          className="w-full rounded-xl border-2 border-(--c-base-line) bg-base py-2.5 pr-4 pl-11 text-on-base placeholder:text-faint focus:border-(--c-primary) focus:outline-none" />
      </label>
    </div>
    {visible.length ? <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @5xl:grid-cols-3">
      {visible.map((course) => <CourseRow key={course.id} course={course} index={courses.indexOf(course)} onOpen={() => openCourse(course)} />)}
    </div> : <p className="text-muted">Ningún curso coincide con «{query}».</p>}
  </section>;
}

/** Temas del curso en cuadrícula: el estudiante elige cualquiera, sin orden obligatorio. Solo un
 * tema bloqueado por el profesor queda sin acceso. */
function CourseView({ demo, course, back }: { demo: Demo; course: Course; back: () => void }) {
  return <div className="grid grid-cols-1 gap-8">
    <button type="button" onClick={back} className="flex w-fit items-center gap-1 text-sm font-semibold text-muted hover:text-on-base"><ArrowLeft size={16} />Mi aprendizaje</button>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-4">
        <Mascot size={56} />
        <PageTitle eyebrow="Curso" description={course.description || undefined}>{course.name}</PageTitle>
      </div>
      <div className="w-full max-w-xs">
        <div className="mb-1 flex justify-between text-sm"><span className="text-muted">Acierto del curso</span><strong className="text-on-base tabular-nums">{course.percentage === null ? "—" : formatPercentage(course.percentage)}</strong></div>
        <Bar value={course.percentage ?? 0} />
      </div>
    </div>
    <section className="grid grid-cols-1 gap-4">
      <h2 className={clsx("text-2xl", display)}>Temas <span className={clsx("text-base text-faint", body)}>({topics.length})</span></h2>
      <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
        {topics.map((topic, i) => <TopicTile key={topic.id} topic={topic} numeral={ROMAN[i] ?? String(i + 1)} onPractice={demo.startPractice} />)}
      </div>
    </section>
  </div>;
}

type Topic = (typeof topics)[number];

/** Tema como tarjeta: número romano, nombre y su avance. Toda la tarjeta abre la práctica. */
function TopicTile({ topic, numeral, onPractice }: { topic: Topic; numeral: string; onPractice: () => void }) {
  const practiced = topic.percentage !== null;
  const content = <div className="flex h-full min-h-40 flex-col gap-4 p-5">
    <div className="flex items-start justify-between gap-3">
      <span className={clsx("text-3xl leading-none text-(--c-secondary-text)", display)}>{numeral}</span>
      {topic.blocked ? <span className="inline-flex items-center gap-1 rounded-lg bg-(--c-sunken) px-2 py-1 text-xs font-semibold text-muted"><Lock size={12} />Bloqueado</span>
        : practiced ? <span className="grid h-7 w-7 place-items-center rounded-full bg-(--c-success) text-(--c-on-success)" aria-label="Practicado"><Check size={16} strokeWidth={3} /></span>
        : <span className="rounded-lg bg-(--c-primary-soft) px-2 py-1 text-xs font-semibold text-(--c-primary-text)">Nuevo</span>}
    </div>
    <p className={clsx("mt-auto text-lg leading-snug", heading)}>{topic.name}</p>
    <div>
      <Bar value={topic.percentage ?? 0} size="sm" />
      <p className="mt-2 text-sm text-muted">{topic.blocked ? "Tu profesor bloqueó este tema" : practiced ? `${formatPercentage(topic.percentage!)} de acierto · ${topic.sessions} ${topic.sessions === 1 ? "sesión" : "sesiones"}` : "Sin practicar"}</p>
    </div>
  </div>;
  return topic.blocked ? <Card className="opacity-55">{content}</Card> : <Card onClick={onPractice} label={`Practicar ${topic.name}`}>{content}</Card>;
}

// ── Práctica ─────────────────────────────────────────────────────────────────────────────

function PracticeView({ demo, exit }: { demo: Demo; exit: () => void }) {
  const [streak, setStreak] = useState(2);
  // Xp ganado en la última respuesta; `id` reinicia la animación en cada acierto.
  const [gain, setGain] = useState<(ReturnType<typeof answerXp> & { id: number }) | null>(null);
  const confirm = () => {
    demo.confirm();
    if (demo.selected === question.correct) {
      const next = streak + 1;
      setStreak(next);
      setGain({ ...answerXp(next, XP_RULES), id: Date.now() });
    } else {
      setStreak(0);
      setGain(null);
    }
  };
  const next = () => { setGain(null); demo.next(); };
  const mood: Mood = demo.feedback ? (demo.feedback.isCorrect ? "happy" : "sad") : "idle";

  // Excepción aprobada: la carga de las 20 preguntas conserva su indicador propio (no Skeleton).
  if (demo.loading) return <div className="grid min-h-[60vh] place-items-center text-center" role="status">
    <div><Mascot mood="thinking" size={120} className="mx-auto" /><p className={clsx("mt-4 text-2xl", heading)}>Preparando tus 20 preguntas…</p></div>
  </div>;

  const optionClass = (key: DemoOption) => {
    const fb = demo.feedback;
    return clsx(
      "flex w-full items-center gap-4 rounded-xl border-2 px-4 py-3.5 text-left shadow-[0_4px_0_var(--edge)] transition-[transform,box-shadow,background-color,border-color] duration-100 enabled:active:translate-y-1 enabled:active:shadow-none sm:px-5 sm:py-4",
      fb && key === question.correct ? "border-(--c-success) bg-(--c-success-soft) [--edge:var(--c-success)]"
        : fb && fb.chosen === key ? "border-(--c-danger) bg-(--c-danger-soft) [--edge:var(--c-danger)]"
        : demo.selected === key ? "border-(--c-primary) bg-(--c-primary-soft) [--edge:var(--c-primary)]"
        : "border-(--c-base-line) bg-base [--edge:var(--c-base-line)] enabled:hover:bg-blocks",
      fb && "cursor-default",
    );
  };

  return <div className="mx-auto grid max-w-2xl gap-6 pb-44">
    <div className="flex items-center gap-4">
      <button type="button" onClick={exit} aria-label="Salir de la práctica" className="text-faint hover:text-on-base"><X size={24} /></button>
      <div className="flex-1"><Bar value={((demo.index + (demo.feedback ? 1 : 0)) / question.total) * 100} tone="success" /></div>
      <span className={clsx("inline-flex items-center gap-1 text-sm font-bold tabular-nums", streak > 0 ? "text-(--c-warning-text)" : "text-faint")}><Flame size={18} className={streak > 0 ? "fill-current" : ""} />{streak}</span>
    </div>

    <div className="flex items-end gap-3 sm:gap-4">
      <Mascot mood={mood} size={56} key={mood} className="shrink-0 sm:h-[72px]! sm:w-[72px]!" />
      <div className="flex-1 rounded-2xl border-2 border-(--c-line) bg-blocks p-4 text-on-blocks sm:p-6">
        <Eyebrow>Pregunta {demo.index + 1} de {question.total}</Eyebrow>
        <div className="mt-2 text-xl sm:text-2xl"><MathText>{question.statement}</MathText></div>
      </div>
    </div>

    <div className="relative grid gap-3" role="radiogroup" aria-label="Opciones">
      {question.options.map(([key, text]) => <button key={key} type="button" role="radio" aria-checked={demo.selected === key} disabled={!!demo.feedback} onClick={() => demo.setSelected(key)} className={optionClass(key)}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 border-(--c-line-strong) text-sm font-bold text-muted">{key}</span>
        <span className="text-lg"><MathText>{text}</MathText></span>
      </button>)}
      {gain && <XpFloat key={gain.id} base={gain.base} bonus={gain.bonus} streak={gain.streak} />}
    </div>

    <footer className={clsx("fixed inset-x-0 bottom-0 z-20 border-t-2 transition-colors", demo.feedback ? (demo.feedback.isCorrect ? "border-(--c-success) bg-(--c-success-soft)" : "border-(--c-danger) bg-(--c-danger-soft)") : "border-(--c-line) bg-blocks text-on-blocks")}>
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-4 px-4 py-5">
        {demo.feedback ? <div className="min-w-0 flex-1">
          <p className={clsx("text-xl", heading, demo.feedback.isCorrect ? "text-(--c-success-text)" : "text-(--c-danger-text)")}>{demo.feedback.isCorrect ? "¡Correcto!" : "Casi. Revisa la explicación"}</p>
          <p className="mt-1 text-sm"><MathText>{question.explanation}</MathText></p>
        </div> : <p className="text-sm text-muted">Elige una opción y compruébala.</p>}
        {demo.feedback ? <Button kind={demo.feedback.isCorrect ? "success" : "danger"} onClick={next} className="w-full sm:w-auto">Continuar</Button>
          : <Button onClick={confirm} disabled={!demo.selected} className="w-full sm:w-auto">Comprobar</Button>}
      </div>
    </footer>
  </div>;
}

/** Xp flotante, como en la práctica real (animaciones xp-float y xp-bonus de styles.css): sube
 * sobre las opciones y se desvanece; el bono de racha sale aparte. No captura clics. */
function XpFloat({ base, bonus, streak }: { base: number; bonus: number; streak: number }) {
  return <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-start gap-2 px-4 pb-2 sm:px-6">
    <p className={clsx("text-4xl text-(--c-primary) tabular-nums [text-shadow:0_0_18px_var(--c-primary)] motion-safe:animate-xp-float", display)}>+{base} xp</p>
    {bonus > 0 && <div className="rounded-xl border-2 border-(--c-secondary) bg-blocks px-3 py-1.5 text-on-blocks shadow-[0_0_28px_-6px_var(--c-secondary)] motion-safe:animate-xp-bonus">
      <p className={clsx("text-xl tabular-nums", heading)}>{streakLabel(streak)}: <span className="text-(--c-secondary-text)">+{bonus} xp</span></p>
    </div>}
  </div>;
}

// ── Navegación ───────────────────────────────────────────────────────────────────────────

// Por ahora solo hay una sección; las demás se añaden aquí y aparecen en ambos menús.
type Section = "panel";
const SECTIONS: { id: Section; label: string; Icon: typeof GraduationCap }[] = [
  { id: "panel", label: "Mi aprendizaje", Icon: GraduationCap },
];

/** Escritorio: menú lateral con un gris algo más claro que el contenido. */
function SideNav({ active, go, lightNav }: { active: Section; go: (view: Section) => void; lightNav: boolean }) {
  return <aside className="sticky top-0 hidden h-dvh flex-col border-r-2 border-(--c-line) bg-blocks text-on-blocks md:flex">
    <div className="flex h-16 items-center border-b-2 border-(--c-line) px-5"><Logo className="h-7" onLight={lightNav} /></div>
    <nav className="grid gap-1 p-3" aria-label="Principal">
      {SECTIONS.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => go(id)} aria-current={active === id ? "page" : undefined} className={clsx(
        "flex w-full items-center gap-3 rounded-xl px-4 py-3 font-medium transition",
        active === id ? "bg-(--c-primary-soft) text-(--c-primary-text)" : "text-muted hover:bg-(--c-line) hover:text-on-blocks",
      )}><Icon size={20} />{label}{active === id && <span aria-hidden className="ml-auto h-1.5 w-1.5 rotate-45 bg-(--c-secondary)" />}</button>)}
    </nav>
    <div className="mt-auto border-t-2 border-(--c-line) p-4">
      <p className="truncate text-sm font-semibold">{student.name}</p>
      <p className="text-xs text-muted">{student.role}</p>
      <button type="button" className="mt-3 flex items-center gap-2 text-sm text-muted hover:text-on-blocks"><LogOut size={16} />Salir</button>
    </div>
  </aside>;
}

/** Móvil: logo arriba y barra de iconos abajo; el activo lleva una línea debajo. */
function MobileNav({ active, go, lightNav }: { active: Section; go: (view: Section) => void; lightNav: boolean }) {
  return <>
    <header className="sticky top-0 z-20 flex h-14 items-center border-b-2 border-(--c-line) bg-blocks text-on-blocks px-4 md:hidden"><Logo className="h-6" onLight={lightNav} /></header>
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 grid auto-cols-fr grid-flow-col border-t-2 border-(--c-line) bg-blocks text-on-blocks pb-[env(safe-area-inset-bottom)] md:hidden">
      {SECTIONS.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => go(id)} aria-label={label} aria-current={active === id ? "page" : undefined}
        className={clsx("relative grid h-16 place-items-center transition", active === id ? "" : "text-faint hover:text-muted")}>
        <Icon size={24} strokeWidth={active === id ? 2.2 : 1.8} />
        {active === id && <span aria-hidden className="absolute bottom-1.5 h-[3px] w-10 rounded-full bg-current" />}
      </button>)}
    </nav>
  </>;
}

/** Editor de la paleta: prueba en vivo el color de cualquier institución. */
function PaletteEditor({ value, onChange, onReset }: { value: BasePalette; onChange: (next: BasePalette) => void; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const fields: [keyof BasePalette, string][] = [["primary", "Primario"], ["secondary", "Secundario"], ["base", "Fondo base"], ["blocks", "Fondo bloques"]];
  const derived = ["on-base", "on-blocks", "on-base-muted", "on-blocks-muted", "primary-strong", "primary-soft", "primary-text", "secondary-soft", "sunken", "line"];
  return <div className="fixed right-4 bottom-20 z-50 font-sans text-xs md:bottom-4">
    {open && <div className="mb-2 w-72 rounded-xl border border-white/15 bg-black/85 p-4 text-white shadow-2xl backdrop-blur">
      <p className="font-semibold">Base (editable por institución)</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {fields.map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="color" value={value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.value })} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent" />{label}</label>)}
      </div>
      <p className="mt-3 font-semibold">Fijos</p>
      <div className="mt-1 flex gap-2">{Object.entries(STATUS).map(([name, color]) => <span key={name} className="flex items-center gap-1"><span className="h-4 w-4 rounded" style={{ background: color }} />{name}</span>)}</div>
      <p className="mt-3 font-semibold">Calculados (texto en blanco o negro, y derivados)</p>
      <div className="mt-1 flex flex-wrap gap-1">{derived.map((name) => <span key={name} title={name} className="h-5 w-5 rounded border border-white/20" style={{ background: `var(--c-${name})` }} />)}</div>
      <button type="button" onClick={onReset} className="mt-3 flex items-center gap-1 text-white/70 hover:text-white"><RotateCcw size={12} />Restaurar</button>
    </div>}
    <button type="button" onClick={() => setOpen((o) => !o)} className="ml-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/80 px-3 py-2 font-semibold text-white shadow-2xl backdrop-blur"><Palette size={14} />Paleta</button>
  </div>;
}

// ── Página ───────────────────────────────────────────────────────────────────────────────

export function ChanconStylePage() {
  const [palette, setPalette] = useState(DEFAULT_PALETTES.dark);
  const [course, setCourse] = useState<Course>(courses[0]!);
  const demo = useDemo();
  const vars = useMemo(() => ({ ...paletteVars(palette), fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif" }), [palette]);
  const focus = demo.view === "practica";
  // El logo es claro: sobre un menú claro necesita su fondo oscuro propio.
  const lightNav = blackOrWhite(palette.blocks) === "#000000";
  const section: Section = "panel";
  const openCourse = (next: Course) => { setCourse(next); demo.setView("curso"); };

  return <>
    {/* Marco: en escritorio, menú y contenido son las dos columnas de una cuadrícula. */}
    <div style={vars} className={clsx("min-h-dvh overflow-x-clip bg-base text-on-base antialiased", !focus && "md:grid md:grid-cols-[16rem_minmax(0,1fr)]")}>
      {!focus && <><SideNav active={section} go={demo.setView} lightNav={lightNav} /><MobileNav active={section} go={demo.setView} lightNav={lightNav} /></>}
      <main className={clsx("min-w-0 px-4 pt-6 sm:px-6 md:pt-10", focus ? "pb-10" : "pb-28 md:pb-16")}>
        <div className="@container mx-auto max-w-6xl">
          {demo.view === "panel" && <PanelView demo={demo} openCourse={openCourse} />}
          {demo.view === "curso" && <CourseView demo={demo} course={course} back={() => demo.setView("panel")} />}
          {demo.view === "practica" && <PracticeView demo={demo} exit={() => demo.setView("panel")} />}
        </div>
      </main>
    </div>
    <PaletteEditor value={palette} onChange={setPalette} onReset={() => setPalette(DEFAULT_PALETTES.dark)} />
  </>;
}

