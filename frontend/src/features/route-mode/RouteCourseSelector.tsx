import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RouteCourseProgress } from "./api";

const SCROLL_STEP_RATIO = 0.8;

interface RouteCourseSelectorProps {
  courses: RouteCourseProgress[];
  selectedCourseId: string | null;
  /** Agrega el nombre del profesor al curso cuando el estudiante tiene rutas de varios profesores. */
  showTeacherNames: boolean;
  onSelect: (courseId: string) => void;
}

function ScrollButton({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return <button type="button" onClick={onClick} aria-label={direction === "left" ? "Ver cursos anteriores" : "Ver cursos siguientes"}
    className={clsx("absolute top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full border-2 border-line-strong bg-blocks text-on-blocks shadow-lg transition hover:brightness-110", direction === "left" ? "left-0" : "right-0")}>
    <Icon size={18} aria-hidden />
  </button>;
}

/**
 * Cursos de la ruta en una sola línea. Los nombres largos se recortan con «…» y lo que no cabe
 * se recorre con las flechas `<` `>` o deslizando; al abrir, el curso elegido queda visible.
 */
export function RouteCourseSelector({ courses, selectedCourseId, showTeacherNames, onSelect }: RouteCourseSelectorProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    setCanScrollLeft(element.scrollLeft > 1);
    setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const selected = element.querySelector<HTMLElement>("[aria-pressed='true']");
    if (selected) element.scrollLeft = selected.offsetLeft - element.clientWidth / 2 + selected.offsetWidth / 2;
    updateArrows();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateArrows);
    observer.observe(element);
    return () => observer.disconnect();
  }, [updateArrows, selectedCourseId, courses.length]);

  const scrollByPage = (direction: -1 | 1) => scroller.current?.scrollBy({ left: direction * scroller.current.clientWidth * SCROLL_STEP_RATIO, behavior: "smooth" });

  return <div className="relative mb-4">
    <div ref={scroller} onScroll={updateArrows} role="group" aria-label="Cursos de la ruta" className="flex gap-2 scrollbar-hidden overflow-x-auto px-0.5 pb-1.5">
      {courses.map((course) => {
        const selected = course.id === selectedCourseId;
        const label = showTeacherNames && course.teacher_name ? `${course.name} · ${course.teacher_name}` : course.name;
        return <button key={course.id} type="button" aria-pressed={selected} title={label} onClick={() => onSelect(course.id)}
          className={clsx("max-w-[min(20rem,80vw)] shrink-0 truncate whitespace-nowrap rounded-xl border-2 border-b-4 px-4 py-2 text-sm font-semibold transition hover:brightness-110",
            selected ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-blocks text-on-blocks")}>{label}</button>;
      })}
    </div>
    {canScrollLeft && <ScrollButton direction="left" onClick={() => scrollByPage(-1)} />}
    {canScrollRight && <ScrollButton direction="right" onClick={() => scrollByPage(1)} />}
  </div>;
}
