export interface ValidateStudentBody {
  teacher_id?: unknown;
  given_names?: unknown;
  family_names?: unknown;
  email?: unknown;
  phone?: unknown;
  identity_document_type?: unknown;
  identity_document_number?: unknown;
  password?: unknown;
  accepted_terms?: unknown;
  replaces_registration_id?: unknown;
}

export interface RequestCodeBody {
  registration_id?: unknown;
}

export interface ValidateCodeBody {
  registration_id?: unknown;
  code?: unknown;
}

export interface CreatePaymentBody {
  registration_id?: unknown;
  plan?: unknown;
  /** Token de un solo uso que genera el SDK de Mercado Pago con el OTP de Yape. */
  token?: unknown;
  /** Celular de Yape con el que se generó el token. */
  phone?: unknown;
  /** Identificador de dispositivo de Mercado Pago (opcional, para el antifraude). */
  device_session_id?: unknown;
}
