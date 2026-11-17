/** Código reservado de la institución demo que alimenta el modo gratuito (igual que en la base de datos). */
export const DEMO_COLLEGE_CODE = "CHANCON-DEMO";

export const isDemoCollege = (code: string) => code.trim().toLowerCase() === DEMO_COLLEGE_CODE.toLowerCase();

/** Id fijo del profesor demo, dueño del banco de preguntas del modo gratuito (igual que en la migración). */
export const DEMO_TEACHER_ID = "5c1f4a9e-7d2b-4c3a-9e68-0d1c4a5b7e01";

export const isDemoTeacher = (userId: string) => userId === DEMO_TEACHER_ID;
