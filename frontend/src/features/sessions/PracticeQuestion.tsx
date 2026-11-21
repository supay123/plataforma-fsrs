import clsx from "clsx";
import { Flame, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Card, Eyebrow, ProgressBar } from "../../components/ui";
import { useModal } from "../../components/ui/use-modal";
import type { MascotEvent } from "../../components/ui/use-mascot-animation";
import { MathText } from "../../lib/math";
import type { AnswerFeedback, AnswerOption } from "../../types/contracts";
import { PracticeMascot, type MascotMood } from "./PracticeMascot";

// Hacia dónde mira la mascota al elegir A, B, C o D (las opciones quedan debajo de ella).
const GAZE_BY_OPTION: Record<AnswerOption, { x: number; y: number }> = { A: { x: 0.5, y: -0.2 }, B: { x: 0.5, y: -0.5 }, C: { x: 0.5, y: -0.8 }, D: { x: 0.5, y: -1 } };

// Al corregir se colorea el fondo (opaco, mezclado con el fondo de bloques); los bordes quedan neutros.
const CORRECT_BACKGROUND = "bg-success-soft";
const WRONG_BACKGROUND = "bg-danger-soft";

function letterClass(answerOption: AnswerOption, feedback: AnswerFeedback | null, chosen: AnswerOption | null, selected: AnswerOption | null): string {
  if (feedback) {
    if (answerOption === feedback.correct_option) return "border-success text-success-text";
    if (answerOption === chosen) return "border-danger text-danger-text";
  // Selección neutra (sin color): el verde queda solo para "correcto" y el rojo para "incorrecto".
  } else if (selected === answerOption) return "border-fg text-fg";
  return "border-line-strong text-fg-muted";
}

function optionClass(answerOption: AnswerOption, feedback: AnswerFeedback | null, chosen: AnswerOption | null, selected: AnswerOption | null): string {
  if (feedback) {
    if (answerOption === feedback.correct_option) return `flex border-line-strong ${CORRECT_BACKGROUND} [--edge:var(--c-line-strong)]`;
    if (answerOption === chosen) return `flex border-line-strong ${WRONG_BACKGROUND} [--edge:var(--c-line-strong)]`;
    return "flex opacity-40 [--edge:var(--c-line-strong)]";
  }
  return selected === answerOption ? "flex border-fg bg-sunken [--edge:var(--c-fg)]" : "flex border-line-strong bg-blocks [--edge:var(--c-line-strong)] hover:bg-sunken";
}

const PHONE_QUERY = "(max-width: 639px)";

/** ¿Pantalla de celular? La mascota se monta en un solo sitio (junto a la pregunta o en el pie) para no duplicar la escena 3D. */
function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(() => typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setIsPhone(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isPhone;
}

export interface PracticeQuestionProps {
  /** Texto accesible de la barra de avance. */
  progressLabel: string;
  /** Avance de 0 a 100. */
  progressValue: number;
  streak: number;
  /** Evento de la mascota (racha, sueño…); sin él reacciona solo a la corrección. */
  mascotEvent?: MascotEvent;
  eyebrow: string;
  eyebrowNote?: string;
  statement: string;
  options: ReadonlyArray<readonly [AnswerOption, string]>;
  selected: AnswerOption | null;
  /** Opción que el estudiante ya confirmó. */
  chosen: AnswerOption | null;
  /** Corrección de la pregunta; `null` mientras no se confirma. */
  feedback: AnswerFeedback | null;
  optionsDisabled?: boolean;
  onSelect: (option: AnswerOption) => void;
  /** Se dibuja sobre las opciones (p. ej. el xp flotante). */
  optionsOverlay?: ReactNode;
  /** Aviso bajo la explicación (p. ej. un error al guardar). */
  notice?: ReactNode;
  /** Botón o botones del pie fijo. */
  actions: ReactNode;
  /** En celular no hay cabecera: la X a la izquierda de la barra de avance es la salida. */
  onExit?: () => void;
}

/**
 * Pantalla de una pregunta de práctica: avance y racha, mascota, enunciado, opciones con corrección
 * al instante, explicación y pie fijo con el resultado y las acciones. La usan la práctica del
 * estudiante y el modo gratuito, así que un cambio de aspecto aquí se ve en ambos. Quien la usa
 * guarda el estado y decide qué hacen los botones; el pie deja libre el menú lateral (`--menu-w`).
 * En celular la mascota va en el pie junto a los botones (al corregir sube sobre el pie) y la X de salida reemplaza a la cabecera.
 * La explicación se abre en un modal con «Ver explicación» (si falló) o «¿Por qué?» (si acertó), alineada al final del pie en escritorio. Teclado: A–D eligen la opción, las flechas se mueven entre opciones y Enter pulsa el botón del pie.
 */
export function PracticeQuestion({ progressLabel, progressValue, streak, mascotEvent, eyebrow, eyebrowNote, statement, options, selected, chosen, feedback, optionsDisabled = false, onSelect, optionsOverlay, notice, actions, onExit }: PracticeQuestionProps) {
  const isPhone = useIsPhone();
  const modal = useModal();
  const explanation = feedback?.explanation ?? null;
  const openExplanation = () => modal.info({ title: "Explicación", body: <MathText>{explanation ?? ""}</MathText>, confirmLabel: "Entendido" });
  // Fallar ofrece «Ver explicación»; acertar, «¿Por qué?».
  const explanationLabel = explanation && feedback ? (feedback.is_correct ? "¿Por qué?" : "Ver explicación") : null;
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;

      if (event.key === "Enter") {
        // Sin `repeat`: mantener Enter apretado no debe saltar varias preguntas. Se evita el clic nativo del botón enfocado.
        event.preventDefault();
        if (!event.repeat) actionsRef.current?.querySelector("button")?.click();
        return;
      }
      if (feedback || optionsDisabled) return;

      const letter = event.key.toUpperCase();
      const letterOption = options.find(([answerOption]) => answerOption === letter);
      if (event.key.length === 1 && letterOption) {
        event.preventDefault();
        onSelect(letterOption[0]);
        return;
      }
      const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
      if (step === 0 || options.length === 0) return;
      event.preventDefault();
      const current = options.findIndex(([answerOption]) => answerOption === selected);
      // Sin selección, la primera flecha va a A (hacia abajo) o a la última opción (hacia arriba).
      const nextIndex = current < 0 ? (step > 0 ? 0 : options.length - 1) : Math.min(options.length - 1, Math.max(0, current + step));
      onSelect(options[nextIndex]![0]);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [feedback, optionsDisabled, options, selected, onSelect]);

  const mood: MascotMood = !feedback ? "idle" : feedback.is_correct ? "happy" : "sad";
  const resultText = feedback ? (feedback.is_correct ? "Muy bien. Respuesta correcta" : `Mal. La respuesta era la ${feedback.correct_option}`) : "";

  const mascot = <PracticeMascot mood={mood} event={mascotEvent} gaze={selected && !feedback ? GAZE_BY_OPTION[selected] : null} size={isPhone ? 48 : 56} className={clsx("sm:h-[72px]! sm:w-[72px]!", isPhone && feedback && "absolute -top-9 left-4")} />;

  return <div className="mx-auto grid max-w-4xl gap-4 pb-4 text-left sm:gap-6 sm:pb-22">
    <h1 className="sr-only">Práctica</h1>
    <div className="flex items-center gap-3 sm:gap-4">
      {onExit && <button type="button" aria-label="Salir de la práctica" onClick={onExit} className="-ml-1 rounded-xl p-1 text-fg-muted transition hover:bg-line hover:text-fg md:hidden"><X size={24} /></button>}
      <div className="flex-1"><ProgressBar value={progressValue} label={progressLabel} /></div>
      <span className={`inline-flex items-center gap-1 text-sm font-bold tabular-nums ${streak > 0 ? "text-warning-text" : "text-fg-faint"}`} aria-label={`${streak} aciertos seguidos`}><Flame size={18} className={streak > 0 ? "fill-current" : undefined} />{streak}</span>
    </div>

    <div className="flex items-end gap-3 sm:gap-4">
      {!isPhone && mascot}
      <Card className="min-w-0 flex-1 p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <Eyebrow>{eyebrow}</Eyebrow>
          {eyebrowNote && <p className="text-xs text-fg-faint">{eyebrowNote}</p>}
        </div>
        <h2 className="mt-2 text-base sm:text-xl"><MathText>{statement}</MathText></h2>
      </Card>
    </div>

    {/* Al corregir en celular la mascota sobresale del pie: deja sitio para que no tape la última opción. */}
    <div className={clsx("relative grid gap-3", isPhone && feedback && "mb-10")}>
      {options.map(([answerOption, text]) => <button
        key={answerOption}
        disabled={Boolean(feedback) || optionsDisabled}
        onClick={() => onSelect(answerOption)}
        className={`min-h-14 items-center gap-3 rounded-xl border-2 px-2 py-2 text-left shadow-[0_4px_0_var(--edge)] transition duration-100 enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-default sm:gap-4 sm:px-3 ${
          optionClass(answerOption, feedback, chosen, selected)
        }`}
      >
        <strong className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 text-sm ${letterClass(answerOption, feedback, chosen, selected)}`}>{answerOption}</strong>
        <span className="min-w-0 flex-1 text-sm sm:text-base"><MathText>{text}</MathText></span>
        {feedback && answerOption === feedback.correct_option &&
          <span className="text-xs font-semibold text-success-text">Respuesta correcta</span>}
        {feedback && !feedback.is_correct && answerOption === chosen &&
          <span className="text-xs font-semibold text-danger-text">Tu respuesta</span>}
      </button>)}
      {optionsOverlay}
    </div>

    {notice}

    <div className={`fixed inset-x-0 bottom-0 z-20 border-t-2 border-line text-on-blocks transition-colors md:left-[var(--menu-w,0px)] ${
      !feedback ? "bg-blocks" : feedback.is_correct ? CORRECT_BACKGROUND : WRONG_BACKGROUND
    }`}>
      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:py-4">
        {feedback
          ? <p role="status" className="type-heading text-base sm:text-lg ">{resultText}</p>
          : <p className="text-sm text-fg-muted">Elige una opción y confírmala.</p>}
        {/* En escritorio los botones quedan al final de la fila; en celular el botón de explicación toma solo el ancho de su texto y la acción el resto. */}
        <div className="flex items-center gap-3 sm:justify-end">
          {isPhone && mascot}
          {explanationLabel && <Button variant="secondary" className="h-12 shrink-0 whitespace-nowrap px-4 sm:h-auto" onClick={openExplanation}>{explanationLabel}</Button>}
          <div ref={actionsRef} className="flex flex-1 sm:flex-none">{actions}</div>
        </div>
      </div>
    </div>
  </div>;
}
