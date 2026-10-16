#!/usr/bin/env bash
# MC-D — Edge Function HTTP integration against a disposable Supabase local stack.
# This script never targets the linked/remote project. It resets the local DB.
set -euo pipefail

if [[ "${MC_D_CONFIRM_LOCAL_RESET:-}" != "yes" ]]; then
  printf 'Refus : ce contrôle réinitialise Supabase local. Relancez avec MC_D_CONFIRM_LOCAL_RESET=yes.\n' >&2
  exit 2
fi

deno_bin="${DENO_INSTALL:-$HOME/.deno}/bin"
if [[ -x "$deno_bin/deno" ]]; then
  export PATH="$deno_bin:$PATH"
fi
command -v deno >/dev/null || { printf 'Deno est requis.\n' >&2; exit 1; }
command -v docker >/dev/null || { printf 'Docker est requis.\n' >&2; exit 1; }

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

db_container="supabase_db_ecodis-app"
logs="$(mktemp -d -t ecodis-mcd-http-XXXXXX)"
function_env="$(mktemp -t ecodis-mcd-function-XXXXXX.env)"
function_pid=""
started=0

cleanup() {
  local status=$?
  if [[ -n "$function_pid" ]]; then
    kill "$function_pid" 2>/dev/null || true
    wait "$function_pid" 2>/dev/null || true
  fi
  rm -f "$function_env"
  if [[ "$started" -eq 1 ]]; then
    printf '\n==> Supabase local stop\n'
    supabase stop --no-backup || printf 'Avertissement : nettoyage local Supabase incomplet.\n' >&2
  fi
  printf 'Logs MC-D HTTP : %s\n' "$logs"
  return "$status"
}
trap cleanup EXIT

printf '==> Supabase local start\n'
# A previous failed run may have left this project's local volumes around. The
# explicit confirmation at the top authorizes removing only this local project
# before start. `supabase start` then recreates the database and replays every
# migration, so a second `db reset` would only restart the auxiliary services.
supabase stop --no-backup >/dev/null 2>&1 || true
started=1
if ! supabase start --ignore-health-check; then
  printf 'Supabase start a rendu la main avant les healthchecks ; attente de PostgreSQL.\n' >&2
fi

ready=0
for delay in 5 5 5 5 10 10 15 15 15 15; do
  sleep "$delay"
  health="$(docker inspect --format '{{.State.Health.Status}}' "$db_container" 2>/dev/null || true)"
  if [[ "$health" == "healthy" ]]; then ready=1; break; fi
done
[[ "$ready" -eq 1 ]] || { printf 'PostgreSQL local n est pas healthy.\n' >&2; exit 1; }

if ! status_env="$(supabase status -o env 2>"$logs/status.err")"; then
  printf 'La lecture de l état Supabase local a échoué. Détail :\n' >&2
  cat "$logs/status.err" >&2
  exit 1
fi
read_status_value() {
  local key="$1"
  printf '%s\n' "$status_env" | awk -F= -v key="$key" '$1 == key { value=$0; sub(/^[^=]*=/,"",value); gsub(/^"|"$/,"",value); print value; exit }'
}
api_url="$(read_status_value API_URL)"
anon_key="$(read_status_value ANON_KEY)"
service_role_key="$(read_status_value SERVICE_ROLE_KEY)"
jwt_secret="$(read_status_value JWT_SECRET)"
[[ -n "$api_url" && -n "$anon_key" && -n "$service_role_key" && -n "$jwt_secret" ]] || { printf 'supabase status -o env ne fournit pas les clés locales attendues.\n' >&2; exit 1; }

# New local Supabase installations expose sb_secret_* gateway keys. Auth Admin
# and PostgREST additionally require a signed Bearer JWT carrying role
# service_role. Derive one from the stack's ephemeral JWT secret; do not log it.
service_role_jwt="$(MC_D_JWT_SECRET="$jwt_secret" deno eval '
const secret = Deno.env.get("MC_D_JWT_SECRET");
if (!secret) throw new Error("Missing local JWT secret");
const encode = (value) => btoa(typeof value === "string" ? value : JSON.stringify(value))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const now = Math.floor(Date.now() / 1000);
const header = encode({ alg: "HS256", typ: "JWT" });
const payload = encode({ role: "service_role", aud: "authenticated", iat: now, exp: now + 900 });
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`));
const bytes = String.fromCharCode(...new Uint8Array(signature));
console.log(`${header}.${payload}.${encode(bytes)}`);
')"
[[ -n "$service_role_jwt" ]] || { printf 'Impossible de générer le jeton service_role local.\n' >&2; exit 1; }

# The Edge Runtime is on the local Supabase Docker network; kong is its
# internal gateway name. This file is temporary and removed by cleanup.
printf '%s\n' \
  'SUPABASE_URL=http://kong:8000' \
  "SUPABASE_ANON_KEY=$anon_key" \
  "SUPABASE_SERVICE_ROLE_KEY=$service_role_jwt" \
  'APP_API_PREFIX=/server/api' \
  'APP_STORAGE_BUCKET_NAME=media' \
  'APP_ALLOWED_ORIGINS=http://localhost:5173' \
  'APP_AUTH_REDIRECT_URL=http://localhost:5173/reset-password' \
  'APP_REQUIRE_ADMIN_MFA=false' \
  'APP_COMMENT_REPORT_RATE_LIMIT_MAX=5' \
  'APP_COMMENT_ACTION_RATE_LIMIT_WINDOW_SECONDS=60' >"$function_env"

printf '==> Edge Function locale\n'
supabase functions serve --env-file "$function_env" >"$logs/functions.log" 2>&1 &
function_pid=$!

function_url="${api_url%/}/functions/v1/server/api"
function_ready=0
for attempt in $(seq 1 30); do
  status="$(curl --silent --output "$logs/health.json" --write-out '%{http_code}' \
    -H "apikey: $anon_key" -H "Authorization: Bearer $anon_key" "$function_url/health" || true)"
  if [[ "$status" == "200" ]]; then function_ready=1; break; fi
  sleep 1
done
if [[ "$function_ready" -ne 1 ]]; then
  printf 'L Edge Function locale ne répond pas au healthcheck.\n' >&2
  tail -n 120 "$logs/functions.log" >&2 || true
  exit 1
fi

printf '==> MC-D API HTTP et RPC réelles\n'
MC_D_SUPABASE_URL="$api_url" \
MC_D_FUNCTION_URL="$function_url" \
MC_D_ANON_KEY="$anon_key" \
MC_D_SERVICE_ROLE_JWT="$service_role_jwt" \
deno run --config supabase/functions/server/deno.json --allow-env --allow-net \
  supabase/tests/moderation/mc_d_api_http.ts | tee "$logs/mc-d-http.log"
