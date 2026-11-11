// Guía de estilo (solo desarrollo): nivel 1.5 de la propuesta Elden Ring. Textos e interiores de las
// tarjetas como el nivel 2 (intermedio); marcos como el nivel 1: esquinas
// doradas en todas las tarjetas, bordes rectos, brillo, grano tenue y
// separadores con rombo en el menú.
import clsx from "clsx";
import { ChevronLeft, ExternalLink, GraduationCap, Lock, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "../../components/layout/Logo";
import { MathText } from "../../lib/math";
import { courses, formatPercentage, question, student, topics, totalGrade, totalScore, useDemo, useGoogleFonts } from "./demo";
import { TextureSwitcher } from "./TextureSwitcher";

const JADE = "#3fb97c";
const JADE_LIGHT = "#9fe3bf";
const JADE_PALE = "#d5eee1";
const GOLD = "#c9a961";
const BLOOD_LIGHT = "#e58276";
const display = { fontFamily: "Cinzel, Georgia, serif" };
const numbers = { fontVariantNumeric: "tabular-nums" as const };

/** Línea con rombo al centro (menú lateral). */
function CenteredDivider({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("flex items-center gap-3", className)}>
    <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}66)` }} />
    <span className="h-1.5 w-1.5 rotate-45" style={{ background: GOLD }} />
    <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${GOLD}66, transparent)` }} />
  </div>;
}

/** Línea con rombo a la izquierda (bajo los encabezados de página). */
function Divider({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("flex items-center gap-2", className)}>
    <span className="h-1.5 w-1.5 rotate-45" style={{ background: GOLD }} />
    <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${GOLD}66, transparent)` }} />
  </div>;
}

/** Marco con esquinas doradas en todas las tarjetas. */
function Frame({ children, className, glow = false, interactive = false }: { children: ReactNode; className?: string; glow?: boolean; interactive?: boolean }) {
  const corner = "absolute h-2.5 w-2.5";
  return <div className={clsx("relative border bg-gradient-to-b from-[#0e1621] to-[#0a1019] transition-all duration-200", glow ? "border-[#3fb97c]/35 shadow-[0_0_50px_-34px_#3fb97c]" : "border-[#1e2a38]", interactive && "hover:border-[#3fb97c]/45 hover:shadow-[0_0_30px_-16px_#3fb97c88]", className)}>
    <span aria-hidden className={clsx(corner, "-left-px -top-px border-l border-t")} style={{ borderColor: GOLD }} />
    <span aria-hidden className={clsx(corner, "-right-px -top-px border-r border-t")} style={{ borderColor: GOLD }} />
    <span aria-hidden className={clsx(corner, "-bottom-px -left-px border-b border-l")} style={{ borderColor: GOLD }} />
    <span aria-hidden className={clsx(corner, "-bottom-px -right-px border-b border-r")} style={{ borderColor: GOLD }} />
    {children}
  </div>;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: `${GOLD}bb` }}>{children}</p>;
}

function JadeButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="border border-[#3fb97c]/60 bg-[#3fb97c]/10 px-5 py-2.5 text-sm font-semibold text-[#d5eee1] transition hover:bg-[#3fb97c]/20 hover:shadow-[0_0_20px_-8px_#3fb97c] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-[#3fb97c]/10 disabled:hover:shadow-none">{children}</button>;
}

function Bar({ value }: { value: number }) {
  return <div className="h-1 w-full rounded-full bg-[#1a2533]"><div className="h-full rounded-full" style={{ width: `${value}%`, background: `linear-gradient(90deg, ${JADE}, ${JADE_LIGHT})` }} /></div>;
}

function PageTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return <header className="mb-8">
    {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
    <h1 className="mt-2 text-3xl tracking-wide md:text-4xl" style={{ color: JADE_PALE, ...display }}>{title}</h1>
    <p className="mt-1 text-slate-400">{description}</p>
    <Divider className="mt-5 max-w-xs" />
  </header>;
}

export function EldenHalfPage() {
  useGoogleFonts("family=Cinzel:wght@400;600&family=Inter:wght@400;500;600");
  const demo = useDemo();
  const compact = demo.view === "practica";
  const navItem = (active: boolean, label: string, Icon: typeof Settings, onClick?: () => void) => <button type="button" onClick={onClick} title={compact ? label : undefined} className={clsx("relative flex w-full items-center gap-3 py-2.5 text-sm font-medium transition", compact ? "justify-center" : "px-5", active ? "bg-[#3fb97c]/10 text-[#d5eee1]" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100")}>
    {active && <span aria-hidden className="absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45" style={{ background: GOLD }} />}
    <Icon size={17} style={active ? { color: JADE_LIGHT } : undefined} />{!compact && label}
  </button>;

  return <div className="min-h-screen bg-[#070b12] text-slate-200" style={{ fontFamily: "Inter, ui-sans-serif, sans-serif" }}>
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ background: `radial-gradient(ellipse 65% 40% at 55% -5%, ${JADE}17, transparent 70%), radial-gradient(ellipse 55% 35% at 5% 105%, #14284b5c, transparent 70%), radial-gradient(ellipse at center, transparent 60%, #00000080 100%)` }} />
    {/* Grano tenue. */}
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 opacity-[0.035] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

    <aside className={clsx("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-[#18222f] bg-[#050810]/95 transition-[width] duration-200 md:flex", compact ? "w-[4.5rem]" : "w-64")}>
      <div className={clsx("flex h-16 items-center", compact ? "justify-center" : "px-5")}>{compact ? <span className="text-xl" style={{ color: JADE_LIGHT, ...display }}>C</span> : <Logo className="h-7" />}</div>
      <CenteredDivider className="px-4" />
      <nav className="grid gap-1 p-3">
        {navItem(demo.view !== "practica", "Mi aprendizaje", GraduationCap, () => demo.setView("panel"))}
        {navItem(false, "Configuración", Settings)}
      </nav>
      <div className="mt-auto">
        <CenteredDivider className="px-4" />
        <div className={clsx(compact ? "p-3" : "p-4")}>
          {!compact && <><p className="truncate text-sm font-semibold text-slate-100">{student.name}</p><p className="text-xs text-slate-500">{student.role}</p></>}
          <button type="button" className={clsx("mt-3 flex w-full items-center gap-2 py-2 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-100", compact ? "justify-center" : "px-2")}><LogOut size={16} />{!compact && "Salir"}</button>
        </div>
      </div>
    </aside>

    <main className={clsx("relative p-4 pb-24 transition-[margin] duration-200 md:p-10", compact ? "md:ml-[4.5rem]" : "md:ml-64")}>
      <div className="mx-auto max-w-6xl">
        {demo.view === "panel" && <>
          <PageTitle title="Mi aprendizaje" description="Cursos activos y progreso observado." />

          <Frame glow className="relative overflow-hidden p-6 md:p-8">
            <div aria-hidden className="absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: `${JADE}1a` }} />
            <div className="relative flex flex-wrap items-end justify-between gap-6">
              <div>
                <Eyebrow>Acierto total</Eyebrow>
                <strong className="mt-3 block text-5xl font-normal leading-none md:text-6xl" style={{ color: JADE_LIGHT, ...display }}>{formatPercentage(totalScore)}</strong>
                <p className="mt-3 text-sm text-slate-400">Promedio de los cursos con sesiones completadas.</p>
              </div>
              <div className="text-right">
                <Eyebrow>Nota</Eyebrow>
                <p className="mt-2 text-3xl" style={{ color: JADE_PALE, ...display }}>{totalGrade}<span className="text-base text-slate-500"> / 20</span></p>
              </div>
            </div>
            <div className="relative mt-6"><Bar value={totalScore} /></div>
          </Frame>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => <button key={course.id} type="button" onClick={() => demo.setView("curso")} className="text-left">
              <Frame interactive className="flex h-full flex-col p-5">
                <Eyebrow>Curso</Eyebrow>
                <h2 className="mt-2 text-xl tracking-wide" style={{ color: JADE_PALE, ...display }}>{course.name}</h2>
                <p className="mt-1 min-h-5 text-sm text-slate-400">{course.description}</p>
                <div className="mt-6 flex items-end justify-between">
                  <strong className="text-3xl font-semibold leading-none" style={{ color: JADE_LIGHT, ...numbers }}>{formatPercentage(course.percentage)}</strong>
                  <span className="text-xs text-slate-500">{course.sessions} sesiones</span>
                </div>
                <div className="mt-3"><Bar value={course.percentage} /></div>
              </Frame>
            </button>)}
          </div>
        </>}

        {demo.view === "curso" && <>
          <button type="button" onClick={() => demo.setView("panel")} className="mb-4 flex items-center gap-1 text-sm text-slate-400 transition hover:text-slate-100"><ChevronLeft size={16} />Mi aprendizaje</button>
          <PageTitle eyebrow="Curso" title={courses[0].name} description="Temas, materiales y sesiones disponibles." />
          <div className="grid gap-4">
            {topics.map((topic, index) => <Frame key={topic.id} interactive={!topic.blocked} className={clsx("flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center", topic.blocked && "opacity-55")}>
              <div className="flex items-center gap-5">
                <span className="hidden w-8 text-center text-xl sm:block" style={{ color: `${GOLD}77`, ...display }}>{["I", "II", "III"][index]}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-100">{topic.name}</h2>
                    {topic.blocked && <span className="flex items-center gap-1 border border-[#c4544a]/40 px-2 py-0.5 text-[11px] font-semibold" style={{ color: BLOOD_LIGHT }}><Lock size={11} />Bloqueado</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{topic.percentage !== null ? <><span className="font-semibold" style={{ color: JADE_LIGHT, ...numbers }}>{formatPercentage(topic.percentage)}</span> · {topic.sessions} sesiones</> : "Sin datos"}</p>
                  {topic.material && <a className="mt-1 inline-flex items-center gap-1 text-sm font-medium hover:underline" style={{ color: JADE_LIGHT }} href="#material" onClick={(event) => event.preventDefault()}>Material <ExternalLink size={13} /></a>}
                </div>
              </div>
              <JadeButton disabled={topic.blocked} onClick={demo.startPractice}>{topic.percentage !== null ? "Continuar práctica" : "Iniciar práctica"}</JadeButton>
            </Frame>)}
          </div>
        </>}

        {demo.view === "practica" && (demo.loading
          ? <div role="status" className="mx-auto mt-20 grid max-w-md justify-items-center gap-5 text-center">
            <div className="relative h-14 w-14">
              <span className="absolute inset-0 animate-spin rounded-full border-2 border-[#1d2937]" style={{ borderTopColor: JADE_LIGHT }} />
              <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45" style={{ background: GOLD }} />
            </div>
            <div>
              <p className="text-xl tracking-wide" style={{ color: JADE_PALE, ...display }}>Preparando tu práctica…</p>
              <p className="mt-1 text-sm text-slate-400">Estamos cargando tus preguntas. En un momento empiezas y cada respuesta se corregirá al instante.</p>
            </div>
          </div>
          : <div className="mx-auto max-w-3xl">
            <header className="mb-5 flex items-end justify-between gap-4">
              <div>
                <Eyebrow>{topics[0].name}</Eyebrow>
                <h1 className="mt-1 text-2xl tracking-wide" style={{ color: JADE_PALE, ...display }}>Pregunta {demo.index + 1} de {question.total}</h1>
              </div>
              <p className="text-sm text-slate-400">{demo.index + (demo.feedback ? 1 : 0)} respondidas</p>
            </header>
            <Frame glow className="p-6">
              <h2 className="text-xl font-semibold text-slate-50"><MathText>{question.statement}</MathText></h2>
              <div className="mt-6 grid gap-3">
                {question.options.map(([option, text]) => {
                  const isCorrect = demo.feedback && option === question.correct;
                  const isWrong = demo.feedback && !demo.feedback.isCorrect && option === demo.feedback.chosen;
                  const isSelected = !demo.feedback && demo.selected === option;
                  return <button key={option} type="button" disabled={Boolean(demo.feedback)} onClick={() => demo.setSelected(option)} className={clsx(
                    "flex min-h-14 items-center gap-4 border px-4 py-3 text-left transition duration-150",
                    isCorrect ? "border-[#3fb97c] bg-[#3fb97c]/10" : isWrong ? "border-[#c4544a] bg-[#c4544a]/10" : isSelected ? "border-[#3fb97c]/70 bg-[#3fb97c]/[0.06]" : "border-[#1d2937] hover:border-[#3fb97c]/40 hover:bg-white/[0.02]",
                    demo.feedback && !isCorrect && !isWrong && "opacity-40",
                  )}>
                    <span className={clsx("grid h-8 w-8 shrink-0 place-items-center border text-sm", isCorrect ? "border-[#3fb97c] text-[#9fe3bf]" : isWrong ? "border-[#c4544a] text-[#e58276]" : isSelected ? "border-[#3fb97c] text-[#9fe3bf]" : "border-[#2a3747] text-slate-300")} style={display}>{option}</span>
                    <span className="flex-1 text-lg text-slate-100"><MathText>{text}</MathText></span>
                    {isCorrect && <span className="text-xs font-semibold" style={{ color: JADE_LIGHT }}>Respuesta correcta</span>}
                    {isWrong && <span className="text-xs font-semibold" style={{ color: BLOOD_LIGHT }}>Tu respuesta</span>}
                  </button>;
                })}
              </div>
              {demo.feedback && <div className="mt-6 grid gap-3">
                <p className={clsx("border-l-2 px-4 py-2 font-semibold", demo.feedback.isCorrect ? "border-[#3fb97c] bg-[#3fb97c]/10" : "border-[#c4544a] bg-[#c4544a]/10")} style={{ color: demo.feedback.isCorrect ? JADE_LIGHT : BLOOD_LIGHT }}>
                  {demo.feedback.isCorrect ? "¡Correcto!" : `Incorrecto. La respuesta correcta es la ${question.correct}.`}
                </p>
                <div className="border border-[#1d2937] bg-[#0a111a] p-4">
                  <Eyebrow>Explicación</Eyebrow>
                  <div className="mt-2 text-slate-200"><MathText>{question.explanation}</MathText></div>
                </div>
              </div>}
              <div className="mt-6 flex justify-end">
                {demo.feedback ? <JadeButton onClick={demo.next}>Siguiente</JadeButton> : <JadeButton disabled={!demo.selected} onClick={demo.confirm}>Confirmar respuesta</JadeButton>}
              </div>
            </Frame>
          </div>)}
      </div>
    </main>
    <TextureSwitcher />
  </div>;
}
