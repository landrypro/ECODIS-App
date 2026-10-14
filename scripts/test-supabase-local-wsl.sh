#!/usr/bin/env bash
#
# Exécute le cycle Supabase local dans une seule session WSL.
#
# Le CLI Supabase peut rendre la main avant la fin des healthchecks Docker
# sous WSL. Lancer `start` puis `db reset` depuis deux processus WSL séparés
# crée une course : le second processus ne retrouve alors pas forcément le
# démarrage initié par le premier. Ce script garde tout le cycle dans le même
# shell et fait du reset le contrôle réel de disponibilité de la base.

set -u

db_container="supabase_db_ecodis-app"
started=0

cleanup() {
  local status=$?

  if [ "$started" -eq 1 ]; then
    printf '\n==> Supabase local stop\n'
    # Un échec de prune après l'arrêt des conteneurs ne doit pas masquer le
    # résultat des contrôles exécutés juste avant. Le message reste visible.
    supabase stop --no-backup || printf 'Avertissement : arrêt Supabase terminé avec un nettoyage Docker incomplet.\n' >&2
  fi

  return "$status"
}

trap cleanup EXIT

printf '==> Supabase local start\n'
started=1
# Avec la version actuelle du CLI sous WSL, le code de sortie de start n'est
# pas fiable pendant l'initialisation. La disponibilité est vérifiée juste
# après par l'état Docker, puis surtout par db reset.
if ! supabase start --ignore-health-check; then
  printf 'Supabase start a rendu la main avant sa disponibilité ; attente de PostgreSQL.\n' >&2
fi

printf '==> Attente PostgreSQL Supabase\n'
ready=0
elapsed=0
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
  printf 'PostgreSQL Supabase (%s) n est pas healthy après %s s.\n' "$db_container" "$elapsed" >&2
  exit 1
fi
printf 'PostgreSQL Supabase healthy après %s s.\n' "$elapsed"

printf '==> Supabase reset local\n'
if ! supabase db reset --local; then
  exit 1
fi

printf '==> Supabase lint SQL local\n'
if ! supabase db lint --local; then
  exit 1
fi

printf '==> Historique des migrations local\n'
if ! supabase migration list --local; then
  exit 1
fi
