export interface UpdateStudentProfileBody {
  user_id?: unknown;
  given_names?: unknown;
  family_names?: unknown;
  phone?: unknown;
  identity_document_type?: unknown;
  identity_document_number?: unknown;
}

export interface StudentPasswordResetBody {
  user_id?: unknown;
}

export interface UpdateStudentEmailBody {
  user_id?: unknown;
  email?: unknown;
}

export interface UpdateStudentGroupBody {
  user_id?: unknown;
  teacher_id?: unknown;
}
