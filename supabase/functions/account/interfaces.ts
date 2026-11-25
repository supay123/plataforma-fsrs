export interface UpdateProfileBody {
  given_names?: unknown;
  family_names?: unknown;
  phone?: unknown;
  identity_document_type?: unknown;
  identity_document_number?: unknown;
}

export interface RequestEmailChangeBody {
  email?: unknown;
}

export interface ConfirmEmailChangeBody {
  code?: unknown;
}

export interface CreatePaymentBody {
  plan?: unknown;
  /** Token de un solo uso que genera el SDK de Mercado Pago con el OTP de Yape. */
  token?: unknown;
  /** Celular de Yape con el que se generó el token. */
  phone?: unknown;
  /** Titular del Yape: `{ first_name, last_name, document }` con el DNI de 8 dígitos (opcional, para el antifraude). */
  payer?: unknown;
  /** Identificador de dispositivo de Mercado Pago (opcional, para el antifraude). */
  device_session_id?: unknown;
}
