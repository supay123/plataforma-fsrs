import katex from "katex";

export function MathText({ children }: { children: string }) {
  const parts = children.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
  return <>{parts.map((part, index) => {
    const display = part.startsWith("$$") && part.endsWith("$$");
    const inline = part.startsWith("$") && part.endsWith("$");
    if (!display && !inline) return <span key={index}>{part}</span>;
    try {
      const source = part.slice(display ? 2 : 1, display ? -2 : -1);
      return <span key={index} className={display ? "my-3 block overflow-x-auto" : "inline-block"} dangerouslySetInnerHTML={{ __html: katex.renderToString(source, { displayMode: display, throwOnError: true, strict: "warn" }) }} />;
    } catch { return <code key={index} className="rounded bg-slate-100 px-1 text-rose-700">{part}</code>; }
  })}</>;
}
