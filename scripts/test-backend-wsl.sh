#!/usr/bin/env bash
set -euo pipefail

# Deno is commonly installed under ~/.deno/bin and login shells add it to
# PATH.  This script is also invoked non-interactively by the quality gate.
deno_bin="${DENO_INSTALL:-$HOME/.deno}/bin"
if [[ -x "$deno_bin/deno" ]]; then
  export PATH="$deno_bin:$PATH"
fi

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

deno check --config supabase/functions/server/deno.json supabase/functions/server/index.ts
deno test --config supabase/functions/server/deno.json --allow-env --allow-net supabase/functions/server
