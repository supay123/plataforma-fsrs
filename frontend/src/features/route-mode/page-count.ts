/** Páginas que ocupa el contenido: cada una mide exactamente `pageWidth` de ancho. */
export function pageCount(contentWidth: number, pageWidth: number) {
  if (pageWidth <= 0) return 1;
  return Math.max(1, Math.round(contentWidth / pageWidth));
}
