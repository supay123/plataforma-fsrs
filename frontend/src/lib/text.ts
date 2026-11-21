/** Minúsculas y sin tildes: para buscar «historia» y encontrar «Historia del Perú». */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
