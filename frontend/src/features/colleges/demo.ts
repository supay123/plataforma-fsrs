/** Código reservado de la institución demo que alimenta el modo gratuito (igual que en la base de datos). */
export const DEMO_COLLEGE_CODE = "CHANCON-DEMO";

export const isDemoCollege = (code: string) => code.trim().toLowerCase() === DEMO_COLLEGE_CODE.toLowerCase();
