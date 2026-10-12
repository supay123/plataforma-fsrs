export interface ValidateStudentBody {
  college_id?: unknown;
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
}

export interface SimulatePaymentBody {
  payment_id?: unknown;
  method?: unknown;
}
