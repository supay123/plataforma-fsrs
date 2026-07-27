# Supabase Edge Functions

The backend exposes twelve Edge Functions. Shared authentication, validation,
error handling, CSV, XLSX, session serialization, and FSRS scheduling live in
`supabase/functions/_shared`.

All endpoints accept `POST`. Except for `login-with-code`, callers must send a
valid user access token in `Authorization: Bearer <token>`. The login endpoint
requires the project's publishable key. Service-role credentials are never
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
| `get-session` | Student | Reloads an owned session without exposing correct answers or explanations before completion. |
| `answer-question` | Student | Corrects an answer server-side, maps it to FSRS `Again` or `Good`, atomically persists the answer/card/review log, and is safe to retry. |
| `complete-session` | Student | Closes an owned session only after all questions are answered and returns its summary. Repeated completion is safe. |
| `get-session-review` | Student, teacher, admin | Returns the completed result and detailed answers. Students see only their own sessions; teachers see only their courses. |
| `export-data` | Teacher, admin | Streams a paginated UTF-8 CSV. Teachers are restricted to their own data; admins may filter across the platform. |

## Main request bodies

- `login-with-code`: `code`, `password`, optional `expected_role`.
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
  `response_time_ms`.
- `export-data`: optional `college_id`, `teacher_id`, `course_id`,
  `student_id`, and `topic_id` filters.

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

The indexed `edge_find_profile_by_code` helper is also restricted to the
service role and prevents the public login flow from retrieving the profile
table.

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
