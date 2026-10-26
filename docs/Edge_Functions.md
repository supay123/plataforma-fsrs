# Supabase Edge Functions

The backend exposes twelve Edge Functions. Shared authentication, validation,
error handling, CSV, XLSX, session serialization, and FSRS scheduling live in
`supabase/functions/_shared`.

Endpoints accept `POST` unless noted (`GET public/colleges`, `GET public/teachers`). Except for the
public ones (`login-with-code`, `recover-password`, `complaints`,
`public`, and `registration`), callers must send a valid user access token in
`Authorization: Bearer <token>`. Public endpoints require the project's
publishable key. A function can expose several endpoints as sub-paths
(`/functions/v1/<function>/<path>`), dispatched by `_shared/router.ts`. Service-role credentials are never
accepted from, or returned to, a client.

## Code organization

Each function is bundled independently by Supabase, but its module graph may
import source files from `supabase/functions/_shared`. Endpoint-specific
request contracts live beside the handler:

```text
admin-renew-access/
├── deno.json
├── deno.lock
├── index.ts
└── interfaces.ts
```

Shared domain contracts use named `*.interfaces.ts` modules under `_shared/interfaces`.
Database table, view, and RPC names are centralized in
`_shared/database.constants.ts`; schema-derived Supabase types live in
`_shared/database.types.ts`.

Every endpoint has its own pinned `deno.json` and lockfile so a function can be
checked and deployed without inheriting dependencies that it does not use.
Regenerate database types after schema changes with:

```sh
pnpm exec supabase gen types --local --schema public \
  > supabase/functions/_shared/database.types.ts
```

## Function catalog

| Function | Allowed role | Purpose |
| --- | --- | --- |
| `login-with-code` | Public | Authenticates an active admin, teacher, or in-range student using the application code and password. |
| `admin-create-user` | Admin | Creates a teacher or student in Auth and `profiles`, optionally generates a temporary password, and records an audit event. |
| `admin-update-user` | Admin | Changes a teacher/student code, name, college, or active status and records the changed fields. |
| `admin-reset-user-credentials` | Admin | Changes a teacher/student code and password, optionally generating the password, with rollback of the code if the Auth update fails. |
| `admin-renew-access` | Admin | Replaces a student's inclusive access-date range and optionally reactivates the profile. |
| `import-questions` | Admin, teacher | Validates or confirms an official-template XLSX/JSON question import. A teacher is restricted to their own courses. |
| `start-session` | Student | Atomically resumes the student's existing in-progress session for a topic or creates one with up to 20 due-first/new questions. |
| `get-session` | Student | Reloads an owned session. Answered questions include their `feedback`; pending questions never expose the correct answer or explanation. |
| `answer-question` | Student | Corrects an answer server-side, maps it to FSRS `Again` or `Good`, atomically persists the answer/card/review log, and returns immediate `feedback` for the stored answer. Safe to retry. |
| `complete-session` | Student | Closes an owned session only after all questions are answered and returns its summary. Repeated completion is safe. |
| `get-session-review` | Student, teacher, admin | Returns the completed result and detailed answers. Students see only their own sessions; teachers see only their courses. |
| `export-data` | Teacher, admin | Streams a paginated UTF-8 CSV. Teachers are restricted to their own data; admins may filter across the platform. |
| `complaints` | Public | `POST /complaints/sheets` receives a Libro de Reclamaciones sheet, numbers it from `private.complaint_sheet_number_seq`, renders the official sheet as a PDF (jsPDF) and emails it with the evidence through Gmail to the business, with a copy to the consumer. At most 2 numbered sheets per IP per day (Lima time); only the IP hash and sheet number are kept, for one day. Complaints themselves are never stored. |
| `public` | Public | Read-only public data. `GET /public/colleges` lists the active colleges; `GET /public/teachers` lists the groups (teachers) a new student can choose, with the college each group belongs to. |
| `registration` | Public | Student self sign-up, one endpoint per step: `POST /registration/student/validate` validates the form and stores a pending registration in `student_registrations` (password as a bcrypt hash only); `POST /registration/request-code` emails the 6-digit code; `POST /registration/validateCode` verifies it; `POST /registration/payment` creates the Kuti charge (QR, plus a bank code from S/ 50) of the chosen plan; `GET /registration/payment` reports its status and activates the account once Kuti confirms it. No account exists until the first payment is confirmed. |
| `kuti` | Kuti signature | `POST /kuti/webhook` receives Kuti payment events (`payment.succeeded`, `failed`, `expired`, `cancelled`), verifies `X-Kuti-Signature` with the signing secret stored in Vault, and applies the payment. Called by Kuti, never by the app. |
| `account` | Student | Profile of any student: `GET /account/profile`, `PUT /account/profile`, `POST /account/email-change`, `POST /account/email-change/confirm`, `POST /account/password-reset` (emails the reset link; `409 email_required` until the student adds a verified email), and `DELETE /account/password-reset` (voids a link sent by mistake). |
| `password-reset` | Public | `POST /password-reset/request-link` emails the link from the student login ("¿Olvidaste tu contraseña?"); `GET /password-reset?code=...` says whether it is still valid without using it; `POST /password-reset` uses it once, saves the new password, and closes every session of that user only. |
| `invitations` | Admin | Student invitations: `GET /invitations` lists the ones not accepted yet (pending or expired), `POST /invitations` invites a student by email with an optional group (teacher), `POST /invitations/resend` sends a new link, and `DELETE /invitations?id=...` cancels one. Students are no longer created directly from the admin screen. |
| `student-invitation` | Public | The invited student uses the emailed link: `GET /student-invitation?code=...` returns the fixed data (email, group, college, access period) and `POST /student-invitation` completes the profile, creates the account and enrolls the student in the group's courses. If the admin did not fix a group, the student chooses one and the college is derived from it. |

## Main request bodies

- `login-with-code`: `code`, `password`, optional `expected_role`. A `code`
  containing `@` is looked up as the email of a student (`profiles.email`);
  otherwise it is the application code.
- `admin-create-user`: `role`, `user_code`, `full_name`, `college_id`,
  optional `password`; students also require `access_valid_from` and
  `access_valid_until`.
- `admin-update-user`: `user_id` and at least one of `user_code`, `full_name`,
  `college_id`, `is_active`.
- `admin-reset-user-credentials`: `user_id`, optional `user_code`, optional
  `password`.
- `admin-renew-access`: `user_id`, `access_valid_from`,
  `access_valid_until`, optional `reactivate`.
- `import-questions`: `action` (`validate` or `confirm`), `topic_id`,
  `filename`, and either `rows` or `file_base64`.
- `start-session`: `topic_id`.
- `get-session`, `complete-session`, `get-session-review`: `session_id`.
- `answer-question`: `session_question_id`, `selected_option` (`A`–`D`),
  `response_time_ms`. Responds with `status` (`accepted` or
  `already_answered`), `session_id`, the stored `selected_option`, and
  `feedback` (`is_correct`, `correct_option`, `explanation`). The answer is
  saved right after the response is sent; a retry once it is saved reports the
  stored answer, even if it sends a different option. `GET` only boots the
  function (the session page calls it on open).
- `export-data`: optional `college_id`, `teacher_id`, `course_id`,
  `student_id`, and `topic_id` filters.
- `POST complaints/sheets` (`multipart/form-data`): `data` (the sheet as
  JSON), optional `evidence` files (images or PDF, up to 10 and 5 MB in
  total), `test=true` for a test sheet (no number, no IP limit, emailed only to
  the business), and `sheet_number` to retry a send that failed. Responds with
  `sheet_number` (`null` for a test sheet), `submitted_at`, and `pdf` (base64).
  Errors: `429 complaint_daily_limit`, and `503 complaint_not_sent` with
  `details.sheet_number` so the retry reuses the number and leaves no gaps.
- `GET public/colleges`: no body. Responds with `colleges` (`id`, `name`).
  Creates `Chancón – Particular` once if no college is active.
- `GET public/teachers`: no body. Responds with `teachers` (`id`, `name`,
  `college_id`, `college_name`): active teachers of an active college with at
  least one non-archived course. The sign-up form, the admin invitation form
  and the invitation page show them as "Grupo"; a teacher without courses does
  not appear until they create one.
- `POST registration/student/validate`: `teacher_id` (the group; the college
  is taken from the teacher, `400 invalid_teacher` if it is not listed by
  `public/teachers`),
  `given_names`, `family_names`, `email`, `phone` (Peruvian mobile only: 9
  digits starting with 9, with or without `+51`; stored without the prefix),
  `identity_document_type`
  (`DNI`, `CE`, `PASAPORTE`, `RUC`), `identity_document_number`, `password`
  (6+ characters with upper, lower, and digit; no PIN),
  `accepted_terms: true`, and optional `replaces_registration_id` (the
  previous registration of the same browser, sent when the user goes back to
  fix the data). Stores the pending registration and responds `201` with
  `registration_id` and the masked `email`. It does not send the code. Field
  errors carry `details.field`; an email that already has an account returns
  `409 email_taken`. When the payment activates the account, the student is
  enrolled in every non-archived course of that teacher, and later courses of
  the teacher are added automatically (`sync_new_course_enrollments`).
- `POST registration/request-code`: `registration_id`. Sends the first code
  and every resend: at most 5 codes, 60 seconds apart. Responds with the
  masked `email`, `code_expires_at`, and `resend_available_at`.
- `POST registration/validateCode`: `registration_id`, `code`. Codes last 10
  minutes and allow 5 wrong attempts. Responds with `status: "verified"`.
- `POST registration/payment`: `registration_id`, `plan` (`mensual` or
  `semestral`). Requires a verified email. The amount comes from
  `_shared/plans.ts`, never from the request. Creates a Kuti charge that
  expires in 30 minutes and stores it in `plan_payments`; responds with
  `payment_id`, `plan`, `amount`, `qr_payload` (EMVCo text the page draws as a
  QR), `bank_code` (service-payment code at KUTI; only for amounts of S/ 50 or
  more, null otherwise), `checkout_url`, `expires_at` and `livemode` (`false`
  with a `kuti_test_` key). A still-valid QR of the same plan is returned again; a QR
  of another plan is cancelled in Kuti. Without `KUTI_SECRET_KEY` it returns
  `503 payments_unavailable` and the page falls back to WhatsApp. The first
  charge on a deployed project (HTTPS) also registers the Kuti webhook and
  saves its signing secret in Vault.
- `GET registration/payment?payment_id=…`: responds with `status`:
  `pending`, `processing` (paid, account being created), `paid` (account
  created; access runs from the payment day for the plan's months),
  `failed`, `expired`, `cancelled`, or `needs_support` (paid after the
  registration was deleted; listed to the administrator). While pending it
  asks Kuti directly, so payments are confirmed even without the webhook
  (local development). A registration with a charge from the last 24 hours is
  not purged.
- `POST registration/payment/simulate` and `POST account/payment/simulate`:
  `payment_id`, `method` (`qr` or `code`). Test mode only: Kuti marks the
  charge as paid without real money and it is applied at once, like a real
  payment. Responds like the `GET` status endpoints; a live charge returns
  `403 test_mode_only` (Kuti also refuses to simulate with a live key).
- `POST account/payment`: `plan`. Signed-in student, with the plan active or
  expired (expired students can sign in, but the app only shows the renewal
  page). Same response as `registration/payment`. Once paid, the months are
  added after the current end date or, if the plan already expired, start on
  the payment day (`edge_apply_renewal_payment`).
- `GET account/payment?payment_id=…`: same statuses as
  `registration/payment`, only for the student's own payments.
- `GET account/profile`: no body. Responds with `profile` (`given_names`,
  `family_names`, `email`, `phone`, `identity_document_type`,
  `identity_document_number`, `college_id`, `college_name`, `group_name`: name of the teacher of their active courses, comma-separated if several, or `null`). Fields the
  student has not filled yet are null (for example, `email` in accounts
  created by an administrator).
- `PUT account/profile`: `given_names`, `family_names`, `phone`,
  `identity_document_type`, `identity_document_number` (same rules as the
  sign-up). The college is read-only for the student (only an administrator
  changes it). Responds with the updated `profile`; `full_name` is recomposed
  by the profiles trigger.
- `POST account/email-change`: `email`. Emails a 6-digit code to the new
  address (10 minutes, 5 wrong attempts, at most 5 codes per day, 60 seconds
  apart). The account email does not change yet. A student without email
  adds one the same way; they keep signing in with their code too. `409 email_taken` if another
  account or verified registration uses it.
- `POST account/email-change/confirm`: `code`. Deletes the request (single
  use), then updates `profiles.email` and the Auth email together. Responds
  with `email`.
- `POST account/password-reset`: no body. Emails a link to
  `<site>/estudiante/reset?code=...` that lasts 1 hour; a new link (at most
  one per minute) invalidates the previous one. The site is the request
  origin when it is in `_shared/app-url.ts`, otherwise production. Responds
  with the masked `email`, `expires_at`, and `resend_available_at`.
- `DELETE account/password-reset`: no body. Deletes the student's pending
  link so it stops working; another one can be requested right away.
  Responds with `status: "cancelled"`.
- `POST password-reset/request-link`: `email`. Sends the reset link to an
  active student (same 1-hour link, at most one per minute; a repeated request
  within that minute still answers `200`). Responds `200 { status: "requested" }`,
  `404 email_not_found` if no student account uses the email, or
  `403 account_inactive` if the account is deactivated.
- `POST invitations`: `email`, `access_valid_from`, `access_valid_until`
  (the end cannot be in the past) and an optional `teacher_id` (group), which
  must be one of the groups listed by `GET public/teachers`; otherwise
  `400 invalid_teacher`. The college is always derived from the group. Without a group, the student
  chooses one while accepting. Legacy clients may still send `college_id`
  instead, which limits the groups the student can choose. Emails a link to
  `<site>/estudiante/invitacion?code=...` that lasts 7 days, never beyond the
  last day of access. Inviting the same email again replaces the previous
  invitation. `409 email_taken` if the email already has an account. Responds
  `201` with `invitation`.
- `POST invitations/resend`: `invitation_id`. New link and validity; the old
  link stops working. `409 invitation_access_ended` if the access period
  already ended.
- `DELETE invitations?id=...`: deletes the invitation (its link stops working).
- `GET student-invitation?code=...`: responds with `invitation` (`email`,
  `teacher_id`, `teacher_name`, `college_id`, `college_name`,
  `access_valid_from`, `access_valid_until`, `expires_at`) or
  `404 invalid_invitation`. A null `teacher_id` means the student must choose
  a group.
- `POST student-invitation`: `code`, optional `teacher_id` (required when the
  invitation has no fixed group), `given_names`, `family_names`, `phone`,
  `identity_document_type`, `identity_document_number`, `password` (sign-up
  rules) and `accepted_terms: true`. Invalid data does not spend the link.
  Creates the student with the invitation's email and access period, derives
  the college from the group, enrolls the student in the group's courses (the
  email is already proven by the link), deletes the invitation, and responds
  `201 { status: "accepted" }`.
- `GET password-reset?code=...`: responds `200 { status: "valid", expires_at }`
  or `404 invalid_reset_code`.
- `POST password-reset`: `code`, `password` (sign-up password rule). The
  password is validated before the link is used, so a weak password does not
  spend it. Responds with `status: "password_updated"`.

  Every code (registration, email change, password reset) is stored only as a
  SHA-256 hash and deleted when used; expired rows are removed by the hourly
  pg_cron jobs `purge-expired-student-registrations` and
  `purge-expired-account-codes`. Expired invitations stay listed so they can be
  resent and are purged 30 days after expiring
  (`purge-expired-student-invitations`).

  Unknown paths return `404 not_found`; a known path with another method
  returns `405 method_not_allowed` (`_shared/router.ts`).

  Secrets: `EMAIL_FROM` and `EMAIL_DELIVERY`:
  `gmail` (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`;
  scope `gmail.send` only), `resend` (`RESEND_API_KEY`), or, locally only,
  `log`. See `supabase/functions/.env.example`.

The XLSX importer reads the first worksheet, has a 5 MB limit, and expects:
`pregunta`, `respuesta_a`, `respuesta_b`, `respuesta_c`, `respuesta_d`,
`respuesta_correcta`, and `explicacion`. The `explicacion` column remains part
of the official structure, but its cell value may be empty and is then stored
as `NULL`.

## FSRS and transaction boundaries

`ts-fsrs` is pinned to `5.4.1`, and the active database configuration stores
the same version. Correct answers use `Rating.Good`; incorrect answers use
`Rating.Again`.

The FSRS calculation runs in TypeScript. Critical multi-table writes are
performed by service-role-only PostgreSQL RPCs:

- `edge_start_session`
- `edge_apply_answer`
- `edge_complete_session`
- `edge_import_questions`

These functions lock the relevant rows and enforce ownership, state, limits,
and retry safety inside the same transaction.

The indexed `edge_find_profile_by_code` and `edge_find_profile_by_email`
helpers are also restricted to the service role and prevent the public login
flow from retrieving the profile table.

Student self-registration uses the service-role-only RPCs
`edge_registration_colleges`, `edge_taken_user_codes`,
`edge_create_student_registration`, and
`edge_activate_student_registration`. A pending registration reserves its
email for 24 hours and is replaced when the same person submits again, and an
hourly `pg_cron` job deletes expired rows. Self-registered students sign in
with their email; when the first payment is confirmed,
`_shared/registration-activation.ts` generates a free application code from
the email (admins and teachers still identify students by code), creates the
Auth user from the stored bcrypt hash and the profile, with access from that
day until the next charge date plus `RENEWAL_GRACE_DAYS`
(`_shared/subscription.ts`). A cancelled subscription ends on the last paid
day instead.

## Implemented behavioral assumptions

- Application codes are unique and case-insensitive.
- Student access dates are inclusive and evaluated using Lima calendar dates.
- A student has at most one in-progress session per topic; starting again
  resumes it.
- Every session question must be answered before completion.
- Imports accept every valid, non-duplicate row and preserve rejected-row
  issues in the batch report; the entire file is not rejected because one row
  is invalid.
- A duplicate is the same normalized question statement within a topic,
  ignoring case and repeated whitespace.
- Correct answers and explanations are unavailable until a session is
  completed.
- Sessions do not expire automatically because the requirements do not define
  an inactivity timeout. No `abandon-expired-sessions` function is created
  until that product rule is agreed.

## Local verification

```sh
pnpm check:functions
pnpm test:unit
pnpm test:integration
```

The integration command resets the local Supabase database, starts a temporary
Edge Function server, and exercises authentication, all admin operations,
question validation/import, session start/resume/reload, answer retries,
completion retries, review authorization, CSV export, and final FSRS records.
