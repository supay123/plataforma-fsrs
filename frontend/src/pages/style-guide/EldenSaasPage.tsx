// Guía de estilo (solo desarrollo): nivel 3 de la propuesta Elden Ring (SaaS). Interfaz de producto
// sobria con la paleta de la marca; del estilo Elden Ring solo quedan Cinzel en
// el título de cada página y el rombo dorado del menú.
import clsx from "clsx";
import { ChevronLeft, ExternalLink, GraduationCap, Lock, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "../../components/layout/Logo";
import { MathText } from "../../lib/math";
import { courses, formatPercentage, question, student, topics, totalGrade, totalScore, useDemo, useGoogleFonts } from "./demo";
import { TextureSwitcher } from "./TextureSwitcher";

const JADE = "#3fb97c";
const JADE_LIGHT = "#9fe3bf";
const GOLD = "#c9a961";
const display = { fontFamily: "Cinzel, Georgia, serif" };
const numbers = { fontVariantNumeric: "tabular-nums" as const };

function Card({ children, className, interactive = false }: { children: ReactNode; className?: string; interactive?: boolean }) {
  return <div className={clsx("rounded-xl border border-white/[0.07] bg-[#0f1620] transition duration-150", interactive && "hover:border-[#3fb97c]/35 hover:bg-[#111a25]", className)}>{children}</div>;
}

function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="rounded-lg bg-[#3fb97c] px-4 py-2.5 text-sm font-semibold text-[#06140d] transition hover:bg-[#4cc98a] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-[#3fb97c]">{children}</button>;
}

function Bar({ value }: { value: number }) {
  return <div className="h-1.5 w-full rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${value}%`, background: JADE }} /></div>;
}

function PageTitle({ title, description }: { title: string; description: string }) {
  return <header className="mb-8">
    <h1 className="text-3xl font-semibold text-slate-50" style={display}>{title}</h1>
    <p className="mt-1 text-slate-400">{description}</p>
  </header>;
}

export function EldenSaasPage() {
  useGoogleFonts("family=Cinzel:wght@600&family=Inter:wght@400;500;600;700");
  const demo = useDemo();
  const compact = demo.view === "practica";
  const navItem = (active: boolean, label: string, Icon: typeof Settings, onClick?: () => void) => <button type="button" onClick={onClick} title={compact ? label : undefined} className={clsx("relative flex w-full items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition", compact ? "justify-center" : "px-3", active ? "bg-white/[0.06] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100")}>
    <Icon size={17} style={active ? { color: JADE } : undefined} />{!compact && label}
    {active && !compact && <span aria-hidden className="ml-auto h-1.5 w-1.5 rotate-45" style={{ background: GOLD }} />}
  </button>;

  return <div className="min-h-screen bg-[#0a0f16] text-slate-300" style={{ fontFamily: "Inter, ui-sans-serif, sans-serif" }}>
    <aside className={clsx("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/[0.06] bg-[#080c12] transition-[width] duration-200 md:flex", compact ? "w-[4.5rem]" : "w-64")}>
      <div className={clsx("flex h-16 items-center border-b border-white/[0.06]", compact ? "justify-center" : "px-5")}>{compact ? <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#3fb97c]/15 text-lg font-semibold" style={{ color: JADE_LIGHT, ...display }}>C</span> : <Logo className="h-7" />}</div>
      <nav className="grid gap-1 p-3">
        {navItem(demo.view !== "practica", "Mi aprendizaje", GraduationCap, () => demo.setView("panel"))}
        <div className="my-2 border-t border-white/[0.06]" />
        {navItem(false, "Configuración", Settings)}
      </nav>
      <div className={clsx("mt-auto border-t border-white/[0.06]", compact ? "p-3" : "p-4")}>
        {!compact && <><p className="truncate text-sm font-semibold text-slate-100">{student.name}</p><p className="text-xs text-slate-500">{student.role}</p></>}
        <button type="button" className={clsx("mt-3 flex w-full items-center gap-2 rounded-lg py-2 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-100", compact ? "justify-center" : "px-2")}><LogOut size={16} />{!compact && "Salir"}</button>
      </div>
    </aside>

    <main className={clsx("p-4 pb-24 transition-[margin] duration-200 md:p-10", compact ? "md:ml-[4.5rem]" : "md:ml-64")}>
      <div className="mx-auto max-w-6xl">
        {demo.view === "panel" && <>
          <PageTitle title="Mi aprendizaje" description="Cursos activos y progreso observado." />

          <Card className="relative overflow-hidden p-6">
            <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${JADE}99, transparent)` }} />
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-sm font-medium text-slate-400">Acierto total</p>
                <strong className="mt-2 block text-5xl font-bold leading-none text-slate-50" style={numbers}>{formatPercentage(totalScore)}</strong>
                <p className="mt-3 text-sm text-slate-500">Promedio de los cursos con sesiones completadas.</p>
              </div>
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-5 py-3 text-right">
                <p className="text-xs font-medium text-slate-400">Nota</p>
                <p className="mt-1 text-2xl font-bold text-slate-50" style={numbers}>{totalGrade}<span className="text-sm font-medium text-slate-500"> / 20</span></p>
              </div>
            </div>
            <div className="mt-6"><Bar value={totalScore} /></div>
          </Card>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => <button key={course.id} type="button" onClick={() => demo.setView("curso")} className="text-left">
              <Card interactive className="flex h-full flex-col p-5">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: JADE }}>Curso</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-50">{course.name}</h2>
                <p className="mt-1 min-h-5 text-sm text-slate-400">{course.description}</p>
                <div className="mt-6 flex items-end justify-between">
                  <strong className="text-3xl font-bold leading-none text-slate-50" style={numbers}>{formatPercentage(course.percentage)}</strong>
                  <span className="text-xs text-slate-500">{course.sessions} sesiones</span>
                </div>
                <div className="mt-3"><Bar value={course.percentage} /></div>
              </Card>
            </button>)}
          </div>
        </>}

        {demo.view === "curso" && <>
          <button type="button" onClick={() => demo.setView("panel")} className="mb-4 flex items-center gap-1 text-sm text-slate-400 transition hover:text-slate-100"><ChevronLeft size={16} />Mi aprendizaje</button>
          <PageTitle title={courses[0].name} description="Temas, materiales y sesiones disponibles." />
          <div className="grid gap-3">
            {topics.map((topic) => <Card key={topic.id} interactive={!topic.blocked} className={clsx("flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center", topic.blocked && "opacity-55")}>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-50">{topic.name}</h2>
                  {topic.blocked && <span className="flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-300"><Lock size={11} />Bloqueado</span>}
                </div>
                <p className="mt-1 text-sm text-slate-400">{topic.percentage !== null ? <><span className="font-semibold text-slate-200" style={numbers}>{formatPercentage(topic.percentage)}</span> · {topic.sessions} sesiones</> : "Sin datos"}</p>
                {topic.material && <a className="mt-1 inline-flex items-center gap-1 text-sm font-medium hover:underline" style={{ color: JADE_LIGHT }} href="#material" onClick={(event) => event.preventDefault()}>Material <ExternalLink size={13} /></a>}
              </div>
              <PrimaryButton disabled={topic.blocked} onClick={demo.startPractice}>{topic.percentage !== null ? "Continuar práctica" : "Iniciar práctica"}</PrimaryButton>
            </Card>)}
          </div>
        </>}

        {demo.view === "practica" && (demo.loading
          ? <div role="status" className="mx-auto mt-20 max-w-md">
            <Card className="grid justify-items-center gap-4 p-8 text-center">
              <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/10" style={{ borderTopColor: JADE }} />
              <div>
                <p className="font-semibold text-slate-50">Preparando tu práctica…</p>
                <p className="mt-1 text-sm text-slate-400">Estamos cargando tus preguntas. En un momento empiezas y cada respuesta se corregirá al instante.</p>
              </div>
            </Card>
          </div>
          : <div className="mx-auto max-w-3xl">
            <header className="mb-5 flex items-end justify-between gap-4">
              <h1 className="text-2xl font-semibold text-slate-50" style={display}>Pregunta {demo.index + 1} de {question.total}</h1>
              <p className="text-sm text-slate-400">{demo.index + (demo.feedback ? 1 : 0)} respondidas</p>
            </header>
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-50"><MathText>{question.statement}</MathText></h2>
              <div className="mt-6 grid gap-3">
                {question.options.map(([option, text]) => {
                  const isCorrect = demo.feedback && option === question.correct;
                  const isWrong = demo.feedback && !demo.feedback.isCorrect && option === demo.feedback.chosen;
                  const isSelected = !demo.feedback && demo.selected === option;
                  return <button key={option} type="button" disabled={Boolean(demo.feedback)} onClick={() => demo.setSelected(option)} className={clsx(
                    "flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left transition duration-150",
                    isCorrect ? "border-[#3fb97c] bg-[#3fb97c]/10" : isWrong ? "border-rose-500 bg-rose-500/10" : isSelected ? "border-[#3fb97c]/70 bg-[#3fb97c]/[0.06]" : "border-white/[0.08] hover:border-white/20 hover:bg-white/[0.02]",
                    demo.feedback && !isCorrect && !isWrong && "opacity-40",
                  )}>
                    <strong className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm", isCorrect ? "bg-[#3fb97c] text-[#06140d]" : isWrong ? "bg-rose-500 text-white" : isSelected ? "bg-[#3fb97c]/20 text-[#9fe3bf]" : "bg-white/[0.06] text-slate-300")}>{option}</strong>
                    <span className="flex-1 text-slate-100"><MathText>{text}</MathText></span>
                    {isCorrect && <span className="text-xs font-semibold" style={{ color: JADE_LIGHT }}>Respuesta correcta</span>}
                    {isWrong && <span className="text-xs font-semibold text-rose-300">Tu respuesta</span>}
                  </button>;
                })}
              </div>
              {demo.feedback && <div className="mt-6 grid gap-3">
                <p className={clsx("rounded-lg px-4 py-3 text-sm font-semibold", demo.feedback.isCorrect ? "bg-[#3fb97c]/10 text-[#9fe3bf]" : "bg-rose-500/10 text-rose-300")}>
                  {demo.feedback.isCorrect ? "¡Correcto!" : `Incorrecto. La respuesta correcta es la ${question.correct}.`}
                </p>
                <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                  <h3 className="text-sm font-semibold text-slate-300">Explicación</h3>
                  <div className="mt-2 text-slate-200"><MathText>{question.explanation}</MathText></div>
                </div>
              </div>}
              <div className="mt-6 flex justify-end">
                {demo.feedback ? <PrimaryButton onClick={demo.next}>Siguiente</PrimaryButton> : <PrimaryButton disabled={!demo.selected} onClick={demo.confirm}>Confirmar respuesta</PrimaryButton>}
              </div>
            </Card>
          </div>)}
      </div>
    </main>
    <TextureSwitcher />
  </div>;
}
