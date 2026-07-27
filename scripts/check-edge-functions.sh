#!/usr/bin/env bash
set -euo pipefail

function_dirs=(
  admin-create-user
  admin-renew-access
  admin-reset-user-credentials
  admin-update-user
  answer-question
  complete-session
  export-data
  get-session-review
  get-session
  import-questions
  login-with-code
  start-session
)

for function_dir in "${function_dirs[@]}"; do
  deno check \
    --config "supabase/functions/$function_dir/deno.json" \
    "supabase/functions/$function_dir/index.ts"
done

deno lint --config supabase/functions/deno.json supabase/functions
