import { MathText } from "../../lib/math";

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;

function Line({ line }: { line: string }) {
  const heading = HEADING.exec(line);
  if (heading) return <div className="type-heading mt-3 text-[1.15em] font-bold"><MathText>{heading[2]!}</MathText></div>;
  const bullet = BULLET.exec(line);
  if (bullet) return <div className="flex gap-2 pl-2"><span aria-hidden>•</span><span className="min-w-0"><MathText>{bullet[1]!}</MathText></span></div>;
  return <div className="whitespace-pre-wrap">{line === "" ? " " : <MathText>{line}</MathText>}</div>;
}

/**
 * Texto de una lección: respeta los saltos de línea que escribió el profesor, admite Markdown básico
 * (`**negrita**`, títulos con `#` y listas con `-`) y renderiza las fórmulas con KaTeX igual que las
 * preguntas ($...$ y $$...$$). Las fórmulas en bloque se separan antes para que puedan ocupar varias líneas.
 */
export function LessonText({ children, className }: { children: string; className?: string }) {
  return <div className={`break-words ${className ?? ""}`}>
    {children.split(/(\$\$[\s\S]+?\$\$)/g).map((chunk, index) => index % 2 === 1
      ? <MathText key={index}>{chunk}</MathText>
      : chunk.split("\n").map((line, lineIndex) => <Line key={`${index}-${lineIndex}`} line={line} />))}
  </div>;
}
