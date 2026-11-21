import type { MascotEvent } from "../../components/ui/use-mascot-animation";
import type { MascotAdviceTone } from "./MascotAdvice";

/** Mensaje de la mascota con su ánimo; lo comparten el profesor y el administrador. */
export interface Advice {
  text: string;
  event: MascotEvent;
  tone: MascotAdviceTone;
}
