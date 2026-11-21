import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../../components/ui";
import { LessonText } from "./LessonText";
import { pageCount } from "./page-count";

interface PaginatedTextProps {
  children: string;
  /** Se muestra en lugar de «Siguiente» en la última página (ej. «Ir a las preguntas»). */
  lastPageAction: ReactNode;
}

/**
 * Texto de una lección que nunca pasa de una pantalla: se reparte en páginas con
 * Anterior/Siguiente. El texto fluye en columnas del ancho de la página dentro de un
 * alto fijo (`dvh`) y solo se desplaza la columna visible, así una página se corta donde
 * se acaba el espacio, en móvil y en escritorio, sin medir cada párrafo.
 */
export function PaginatedText({ children, lastPageAction }: PaginatedTextProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const strip = stripRef.current;
    if (!viewport || !strip) return;
    setPageWidth(viewport.clientWidth);
    setPages(pageCount(strip.scrollWidth, viewport.clientWidth));
  }, []);

  useLayoutEffect(measure, [measure, children, pageWidth]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [measure]);

  const current = Math.min(page, pages - 1);
  const isLast = current === pages - 1;
  return <div>
    <div className="h-[calc(100dvh-22rem)] min-h-56 rounded-2xl border-2 border-line bg-blocks p-4 text-on-blocks sm:p-6">
      <div ref={viewportRef} className="h-full overflow-hidden">
      <div ref={stripRef} aria-live="polite" className="h-full transition-transform duration-300 [&_.katex-display]:break-inside-avoid [&_span.block]:break-inside-avoid"
        style={{ columnWidth: pageWidth || undefined, columnGap: 0, columnFill: "auto", transform: `translateX(-${current * pageWidth}px)` }}>
        <LessonText className="text-lg leading-relaxed">{children}</LessonText>
      </div>
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between gap-3">
      <Button variant="secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>Anterior</Button>
      <span className="text-sm text-fg-muted tabular-nums">Página {current + 1} de {pages}</span>
      {isLast ? lastPageAction : <Button onClick={() => setPage(current + 1)}>Siguiente</Button>}
    </div>
  </div>;
}
