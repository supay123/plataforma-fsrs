import { z } from "zod";
import { studentFields } from "../registration/fields";

/** Datos del interesado: mismas reglas del registro (nombres, correo y celular de Perú). */
export const leadSchema = z.object({
  given_names: studentFields.given_names,
  family_names: studentFields.family_names,
  email: studentFields.email,
  phone: studentFields.phone,
  accepted_data_policy: z.boolean().refine((value) => value, "Debes autorizar el contacto para continuar."),
  website: z.string(),
});
export type LeadValues = z.infer<typeof leadSchema>;
