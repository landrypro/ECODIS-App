#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

deno check --config supabase/functions/server/deno.json supabase/functions/server/index.ts
deno test --config supabase/functions/server/deno.json --allow-env --allow-net supabase/functions/server
