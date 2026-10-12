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
