import { Star } from "lucide-react";

const SLOTS = [1, 2, 3];

/** Hueco de 3 estrellas de un tema: llenas hasta su mejor marca, vacías el resto. */
export function StarSlots({ best, size = 18 }: { best: number; size?: number }) {
  return <span role="img" aria-label={`${best} de 3 estrellas`} className="inline-flex items-center gap-0.5">
    {SLOTS.map((slot) => <Star key={slot} aria-hidden size={size} strokeWidth={2.25}
      className={slot <= best ? "fill-secondary text-secondary" : "text-fg-faint"} />)}
  </span>;
}
