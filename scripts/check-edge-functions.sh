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
  complaints
  export-data
  practice-session
  get-session-review
  import-questions
  questions
  route-mode
  login-with-code
  recover-password
  public
  registration
  account
  password-reset
  invitations
  student-invitation
  mercadopago
  medals
  free-mode
)

for function_dir in "${function_dirs[@]}"; do
  deno check \
    --config "supabase/functions/$function_dir/deno.json" \
    "supabase/functions/$function_dir/index.ts"
done

deno lint --config supabase/functions/deno.json supabase/functions
