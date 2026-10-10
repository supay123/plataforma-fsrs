// Datos públicos del comercio.
export const BUSINESS = {
  brand: "Chancón",
  tradeName: "Chancón - entrenador preuniversitario",
  legalName: "Miguel Ángel Llacta Pereira",
  ruc: "10774172578",
  address: "Av. Carlos Ugarte Mza. B Lote. 62 Coripata Sur, Santiago, Cusco, Cusco",
  phone: "+51 942 722 127",
  whatsapp: "51942722127",
  email: "pesupay@gmail.com",
  complaintsBookCode: "001",
  social: [] as Array<{ label: string; url: string }>,
};

// El precio se cobra en soles con Yape, a través de Kuti.
export const PLAN = {
  name: "Plan Estudiante",
  priceSoles: 15,
  period: "mes",
  features: [
    "Acceso a todos los cursos y temas que tengas asignados",
    "Sesiones de práctica de hasta 20 preguntas por tema",
    "Repaso espaciado: las preguntas que fallas vuelven en el momento justo",
    "Explicación instantánea de cada pregunta al responder",
    "Revisión detallada de cada sesión completada",
    "Progreso y porcentaje de acierto por curso y por tema",
    "Materiales de estudio de cada tema",
  ],
};

// Días mínimos de aviso antes de un cambio de precio.
export const PRICE_CHANGE_NOTICE_DAYS = 10;

export function formatSoles(amount: number) {
  return `S/ ${amount.toFixed(2)}`;
}
