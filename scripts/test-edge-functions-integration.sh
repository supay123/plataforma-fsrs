#!/usr/bin/env bash
set -euo pipefail

pnpm exec supabase start
if [[ "${SKIP_DB_RESET:-false}" != "true" ]]; then
  pnpm exec supabase db reset --local --yes
fi

status_env="$(pnpm exec supabase status -o env 2>/dev/null)"
eval "$status_env"

export SUPABASE_URL="$API_URL"
export SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY"
export SUPABASE_SECRET_KEY="$SECRET_KEY"

log_file="${TMPDIR:-/tmp}/fsrs-platform-edge-functions.log"
pnpm exec supabase functions serve >"$log_file" 2>&1 &
functions_pid=$!
functions_cli_pid=""

cleanup() {
  if [[ -n "$functions_cli_pid" ]]; then
    kill "$functions_cli_pid" >/dev/null 2>&1 || true
  fi
  kill "$functions_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# The npm wrapper starts the native Supabase CLI as a child process. Keep its
# PID so the test never leaves a second function server attached to the same
# local Edge Runtime.
for _ in $(seq 1 20); do
  functions_cli_pid="$(pgrep -P "$functions_pid" | head -n 1 || true)"
  if [[ -n "$functions_cli_pid" ]]; then
    break
  fi
  sleep 0.1
done

function_names=(
  login-with-code
  recover-password
  account-security
  admin-create-user
  admin-delete-college
  admin-delete-user
  admin-update-user
  admin-reset-user-credentials
  admin-renew-access
  import-questions
  start-session
  get-session
  answer-question
  complete-session
  get-session-review
  export-data
)

for function_name in "${function_names[@]}"; do
  ready_status="000"
  for _ in $(seq 1 120); do
    ready_status="$(
      curl --silent --output /dev/null --write-out '%{http_code}' \
        --header "apikey: $SUPABASE_PUBLISHABLE_KEY" \
        --header "Authorization: Bearer $SERVICE_ROLE_KEY" \
        "$SUPABASE_URL/functions/v1/$function_name" || true
    )"
    if [[ "$ready_status" != "000" && "$ready_status" != "502" &&
      "$ready_status" != "503" && "$ready_status" != "504" ]]; then
      break
    fi
    sleep 0.5
  done

  if [[ "$ready_status" == "000" || "$ready_status" == "502" ||
    "$ready_status" == "503" || "$ready_status" == "504" ]]; then
    tail -100 "$log_file"
    echo "Edge Function $function_name did not become ready." >&2
    exit 1
  fi
done

RUN_INTEGRATION_TESTS=true deno test \
  --allow-env \
  --allow-net=127.0.0.1,localhost \
  --config supabase/functions/deno.json \
  supabase/functions/tests/edge-functions.integration.test.ts
