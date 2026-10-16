#!/usr/bin/env bash
#
# Exécute le cycle Supabase local dans une seule session WSL.
#
# Ce contrôle ne vérifie que le schéma local : il démarre donc PostgreSQL seul,
# puis rejoue les migrations, le lint et leur historique. Démarrer tous les
# services Supabase demanderait au moins 7 Gio de RAM et rendrait ce contrôle
# inutilement instable sur un poste qui exécute d'autres conteneurs. La pile
# HTTP complète reste bien couverte séparément par le contrôle MC-D.

set -uo pipefail

db_container="supabase_db_ecodis-app"
started=0
logs="$(mktemp -d -t ecodis-supabase-cycle-XXXXXX)"

run_required() {
  local label="$1"
  shift
  local log_file="$logs/${label}.log"

  "$@" >"$log_file" 2>&1
  local exit_code=$?
  cat "$log_file"
  if [ "$exit_code" -ne 0 ]; then
    printf 'La commande %s a échoué (code %s). Dernières lignes :\n' "$label" "$exit_code" >&2
    tail -n 120 "$log_file" >&2
    return "$exit_code"
  fi
}

wait_for_postgres() {
  local phase="$1"
  local ready=0
  local elapsed=0

  printf '==> Attente PostgreSQL Supabase (%s)\n' "$phase"
  for delay in 5 5 5 5 10 10 15 15 15 15; do
    sleep "$delay"
    elapsed=$((elapsed + delay))
    health="$(docker inspect --format '{{.State.Health.Status}}' "$db_container" 2>/dev/null || true)"
    if [ "$health" = "healthy" ]; then
      ready=1
      break
    fi
  done

  if [ "$ready" -ne 1 ]; then
    printf 'PostgreSQL Supabase (%s) n est pas healthy après %s s (%s).\n' "$db_container" "$elapsed" "${health:-absent}" >&2
    docker logs --tail 120 "$db_container" >&2 || true
    return 1
  fi
  printf 'PostgreSQL Supabase healthy après %s s.\n' "$elapsed"
}

cleanup() {
  local status=$?

  if [ "$started" -eq 1 ]; then
    printf '\n==> Supabase local stop\n'
    # Un échec de prune après l'arrêt des conteneurs ne doit pas masquer le
    # résultat des contrôles exécutés juste avant. Le message reste visible.
    supabase stop --no-backup || printf 'Avertissement : arrêt Supabase terminé avec un nettoyage Docker incomplet.\n' >&2
  fi

  printf 'Logs du cycle Supabase : %s\n' "$logs"
  return "$status"
}

trap cleanup EXIT

printf '==> PostgreSQL Supabase local start\n'
started=1
# Avec la version actuelle du CLI sous WSL, le code de sortie du démarrage peut
# être transitoirement non nul. La disponibilité est vérifiée immédiatement par
# le healthcheck Docker, puis par db reset.
start_log="$logs/db-start.log"
supabase db start >"$start_log" 2>&1
start_exit_code=$?
cat "$start_log"
if [ "$start_exit_code" -ne 0 ]; then
  printf 'Supabase db start a rendu la main avant sa disponibilité ; attente de PostgreSQL.\n' >&2
fi

wait_for_postgres 'après start' || exit 1

printf '==> Supabase reset local\n'
run_required 'db-reset' supabase db reset --local || exit 1

# Le CLI peut confirmer le reset alors que le conteneur PostgreSQL termine son
# redémarrage. Attendre son healthcheck évite que lint ou migration list ne
# commencent sur une connexion encore transitoire.
wait_for_postgres 'après reset' || exit 1

printf '==> Supabase lint SQL local\n'
run_required 'db-lint' supabase db lint --local || exit 1

printf '==> Historique des migrations local\n'
run_required 'migration-list' supabase migration list --local || exit 1
