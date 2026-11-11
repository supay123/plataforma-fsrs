/** Consejos cortos que la mascota muestra mientras se cargan las preguntas de la práctica. */
export const PRACTICE_TIPS: readonly string[] = [
  "Intenta responder sin mirar tus apuntes: recordar con esfuerzo es lo que más fija el tema.",
  "Lee la explicación aunque hayas acertado: a veces aprendes un matiz nuevo.",
  "Si fallas, no pasa nada. Equivocarte hoy es lo que te hace acertar mañana.",
  "Practica un poco cada día: 10 minutos diarios rinden más que una hora de golpe.",
  "Responde con calma, pero sin eternizarte: tu primera intuición suele ser valiosa.",
  "Descarta primero las opciones que sabes que son falsas.",
  "Lee el enunciado completo antes de mirar las alternativas.",
  "Tu repaso se programa solo: vuelve cuando la app te lo indique.",
  "Las preguntas que fallas volverán a aparecer, y eso es justo lo que quieres.",
  "No adivines a ciegas: si dudas, razona por qué las otras opciones no encajan.",
  "Antes de confirmar, relee tu respuesta una vez.",
  "Después de cada práctica, revisa en qué preguntas te equivocaste.",
  "Dormir bien ayuda a que lo practicado se quede en tu memoria.",
  "Practica en un lugar tranquilo y sin notificaciones.",
  "Cada respuesta se corrige al instante, aprovecha para aprender en el momento.",
  "Si una explicación no te queda clara, anota la duda y pregúntala a tu profesor.",
  "Repasar a intervalos crecientes funciona mejor que releer todo de una vez.",
  "Constancia antes que perfección: una práctica corta hoy suma más que ninguna.",
  "Explícate la respuesta correcta con tus propias palabras.",
  "Tus respuestas se guardan al finalizar, así que llega hasta el final.",
  "Haz pausas cortas entre prácticas para mantener la concentración.",
  "Un error con explicación vale más que un acierto por suerte.",
  "Relaciona cada tema con un ejemplo real para recordarlo mejor.",
  "Empieza por los temas que más te cuestan, cuando tu mente está fresca.",
];

/** Orden aleatorio (Fisher-Yates). Si se indica `avoidFirst`, ese consejo no queda primero. */
export function shuffleTips(tips: readonly string[] = PRACTICE_TIPS, avoidFirst?: string): string[] {
  const result = [...tips];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  if (avoidFirst !== undefined && result.length > 1 && result[0] === avoidFirst) {
    [result[0], result[1]] = [result[1], result[0]];
  }
  return result;
}
