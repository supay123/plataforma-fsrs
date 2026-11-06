#!/usr/bin/env bash
set -euo pipefail

function_dirs=(
  account-security
  admin-create-user
  admin-delete-college
  admin-delete-user
  admin-renew-access
  admin-reset-user-credentials
  admin-student-account
  admin-update-user
  answer-question
  complaints
  complete-session
  export-data
  get-session-review
  get-session
  import-questions
  questions
  login-with-code
  recover-password
  start-session
  public
  registration
  account
  password-reset
  invitations
  student-invitation
  mercadopago
)

for function_dir in "${function_dirs[@]}"; do
  deno check \
    --config "supabase/functions/$function_dir/deno.json" \
    "supabase/functions/$function_dir/index.ts"
done

deno lint --config supabase/functions/deno.json supabase/functions
