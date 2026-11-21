import { createContext } from "react";

/** Id de la etiqueta del `Field` que envuelve al control (lo usa `Select`, cuyo botón no es el primer elemento etiquetable). */
export const FieldLabelContext = createContext<string | undefined>(undefined);
