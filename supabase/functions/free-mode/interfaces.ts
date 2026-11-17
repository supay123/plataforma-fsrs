export interface FreeModeQuestion {
  id: string;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string | null;
}

export interface RegisterLeadBody {
  given_names?: unknown;
  family_names?: unknown;
  email?: unknown;
  phone?: unknown;
  /** Consentimiento de tratamiento de datos personales (Ley 29733). */
  accepted_data_policy?: unknown;
  /** Campo trampa: las personas no lo ven, los bots lo llenan. */
  website?: unknown;
}
