/* global console, fetch, File, FormData, process, URL, setTimeout */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";

if (!process.argv.includes("--confirm-staging-write")) {
  console.error("Refus de lancer la recette : ajoutez --confirm-staging-write.");
  process.exit(2);
}

function readEnvironment() {
  const values = {};
  const content = readFileSync(".env", "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

function requireValue(values, key) {
  const value = values[key];
  if (!value) throw new Error(`Variable d'environnement manquante : ${key}`);
  return value;
}

function makeApiUrl(apiBaseUrl, path) {
  const base = apiBaseUrl.replace(/\/+$/, "");
  if (/[<>]/.test(base)) {
    throw new Error(
      "RECETTE_API_BASE_URL contient encore un placeholder. Utilisez l'URL réelle et complète de l'API staging.",
    );
  }

  try {
    new URL(base);
  } catch {
    throw new Error("RECETTE_API_BASE_URL n'est pas une URL valide.");
  }

  return `${base}${path}`;
}

async function request(label, url, init = {}, expectedStatuses = [200, 201]) {
  let response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    const networkCode = error?.cause?.code ?? error?.code ?? "FETCH_ERROR";
    throw new Error(`${label} inaccessible (${networkCode})`);
  }
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!expectedStatuses.includes(response.status)) {
    const message = typeof data?.error === "string" ? `: ${data.error}` : "";
    throw new Error(`${label} a échoué (HTTP ${response.status})${message}`);
  }

  return data;
}

async function requestCleanupWithRetry(label, url, init, expectedStatuses = [200]) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await request(label, url, init, expectedStatuses);
    } catch (error) {
      lastError = error;
      if (!String(error?.message ?? error).includes("HTTP 409") || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function run() {
  const env = readEnvironment();
  const supabaseUrl = requireValue(env, "SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = requireValue(env, "SUPABASE_ANON_KEY");
  const serviceRoleKey = requireValue(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY contient une clé publishable. Utilisez la clé secret/service_role du projet staging.",
    );
  }
  // La recette peut viser le déploiement staging sans modifier le .env local de développement.
  // Cette valeur représente l'URL finale de l'API, préfixe métier inclus.
  const apiBaseUrl = process.env.RECETTE_API_BASE_URL
    ?? requireValue(env, "VITE_SUPABASE_FUNCTIONS_BASE_URL");
  const normalizedApiBaseUrl = makeApiUrl(apiBaseUrl, "");
  const apiUrl = (path) => `${normalizedApiBaseUrl}${path}`;
  const runId = `RECETTE-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const password = `Recette${randomUUID().replace(/-/g, "").slice(0, 18)}9`;
  const state = {
    admin: null,
    user: null,
    adminToken: null,
    userToken: null,
    messageId: null,
    mediaMessageId: null,
    seriesId: null,
    commentId: null,
    clientErrorId: null,
    favoriteActive: false,
  };
  const results = [];
  const serviceHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  async function forceDeleteRecipeMessage(messageId) {
    const relatedResources = [
      `series_messages?message_id=eq.${messageId}`,
      `series_progress?message_id=eq.${messageId}`,
      `favorites?message_id=eq.${messageId}`,
      `comments?message_id=eq.${messageId}`,
    ];
    for (const resource of relatedResources) {
      await request(`Nettoyage REST ${resource.split("?")[0]}`, `${supabaseUrl}/rest/v1/${resource}`, {
        method: "DELETE",
        headers: { ...serviceHeaders, Prefer: "return=minimal" },
      }, [200, 204]);
    }
    await request("Suppression REST du contenu de recette", `${supabaseUrl}/rest/v1/messages?id=eq.${messageId}`, {
      method: "DELETE",
      headers: { ...serviceHeaders, Prefer: "return=minimal" },
    }, [200, 204]);
  }

  const record = (name) => results.push(name);

  async function transitionEditorial(kind, id, status) {
    return request(
      `Transition ${kind} vers ${status}`,
      apiUrl(`/${kind}/${id}/transitions`),
      {
        method: "POST",
        headers: { ...authHeaders(state.adminToken), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
      [200],
    );
  }

  async function createUser(kind, role) {
    const email = `${kind.toLowerCase()}-${runId.toLowerCase()}@example.invalid`;
    const data = await request(
      `Création du compte ${kind}`,
      `${supabaseUrl}/auth/v1/admin/users`,
      {
        method: "POST",
        headers: serviceHeaders,
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: `${kind} ${runId}` },
        }),
      },
      [200, 201],
    );
    const id = data?.user?.id ?? data?.id;
    if (!id) throw new Error(`Création du compte ${kind} : identifiant absent`);

    await request(
      `Attribution du rôle ${role}`,
      `${supabaseUrl}/rest/v1/users_roles?on_conflict=user_id`,
      {
        method: "POST",
        headers: { ...serviceHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: id, email, name: `${kind} ${runId}`, role }),
      },
      [201],
    );

    const session = await request(
      `Connexion du compte ${kind}`,
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: { apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
      [200],
    );
    if (!session?.access_token) throw new Error(`Connexion du compte ${kind} : jeton absent`);
    return { id, email, token: session.access_token };
  }

  async function cleanup() {
    const cleanupErrors = [];
    const attempt = async (label, operation) => {
      try {
        await operation();
      } catch (error) {
        cleanupErrors.push(`${label} (${error instanceof Error ? error.message : String(error)})`);
      }
    };

    if (state.commentId && state.messageId && state.userToken) {
      await attempt("suppression du commentaire", () => request(
        "Suppression du commentaire de recette",
        apiUrl(`/comments/${state.messageId}/${state.commentId}`),
        { method: "DELETE", headers: authHeaders(state.userToken) },
        [200],
      ));
    }
    if (state.favoriteActive && state.userToken && state.messageId) {
      await attempt("suppression du favori", () => request(
        "Retrait du favori de recette",
        apiUrl("/favorites/toggle"),
        {
          method: "POST",
          headers: { ...authHeaders(state.userToken), "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: state.messageId }),
        },
        [200],
      ));
    }
    if (state.user?.id && state.seriesId) {
      await attempt("suppression de la progression", () => request(
        "Suppression de la progression de recette",
        `${supabaseUrl}/rest/v1/series_progress?user_id=eq.${state.user.id}&series_id=eq.${state.seriesId}`,
        { method: "DELETE", headers: serviceHeaders },
        [204],
      ));
    }
    if (state.seriesId && state.adminToken) {
      await attempt("retour de la série au brouillon", () => transitionEditorial("series", state.seriesId, "draft"));
      await attempt("suppression de la série", () => request(
        "Suppression de la série de recette",
        apiUrl(`/series/${state.seriesId}`),
        { method: "DELETE", headers: authHeaders(state.adminToken) },
        [200],
      ));
    }
    if (state.messageId && state.adminToken) {
      await attempt("retour du contenu au brouillon", () => transitionEditorial("messages", state.messageId, "draft"));
      await attempt("suppression du contenu", async () => {
        try {
          await requestCleanupWithRetry(
            "Suppression du contenu de recette",
            apiUrl(`/messages/${state.messageId}`),
            { method: "DELETE", headers: authHeaders(state.adminToken) },
            [200],
          );
        } catch (error) {
          if (!String(error?.message ?? error).includes("HTTP 409")) throw error;
          await forceDeleteRecipeMessage(state.messageId);
        }
      });
    }
    if (state.mediaMessageId && state.adminToken) {
      await attempt("retour du média au brouillon", () => transitionEditorial("messages", state.mediaMessageId, "draft"));
      await attempt("suppression du média", () => request(
        "Suppression du média de recette",
        apiUrl(`/messages/${state.mediaMessageId}`),
        { method: "DELETE", headers: authHeaders(state.adminToken) },
        [200],
      ));
    }
    if (state.clientErrorId) {
      await attempt("suppression de l'erreur frontend", () => request(
        "Suppression de l'erreur frontend de recette",
        `${supabaseUrl}/rest/v1/client_error_logs?id=eq.${state.clientErrorId}`,
        { method: "DELETE", headers: serviceHeaders },
        [204],
      ));
    }
    for (const account of [state.admin, state.user]) {
      if (account?.id) {
        await attempt("suppression des logs d'audit", () => request(
          "Suppression des audits de recette",
          `${supabaseUrl}/rest/v1/audit_logs?user_id=eq.${account.id}`,
          { method: "DELETE", headers: serviceHeaders },
          [204],
        ));
        await attempt("suppression du compte", () => request(
          "Suppression du compte de recette",
          `${supabaseUrl}/auth/v1/admin/users/${account.id}`,
          { method: "DELETE", headers: serviceHeaders },
          [200, 204],
        ));
      }
    }

    if (cleanupErrors.length > 0) {
      throw new Error(`Nettoyage incomplet : ${cleanupErrors.join(" ; ")}`);
    }
  }

  try {
    const health = await request("Health check", apiUrl("/health"), {
      headers: { Authorization: `Bearer ${anonKey}` },
    });
    if (health?.status !== "ok") throw new Error("Health check : statut inattendu");
    record("API health");

    state.admin = await createUser("Admin", "admin");
    state.user = await createUser("Utilisateur", "user");
    state.adminToken = state.admin.token;
    state.userToken = state.user.token;
    record("DB-01 comptes et rôles");

    const adminRole = await request("Contrôle du rôle admin", apiUrl("/users/me/role"), { headers: authHeaders(state.adminToken) });
    const userRole = await request("Contrôle du rôle utilisateur", apiUrl("/users/me/role"), { headers: authHeaders(state.userToken) });
    if (adminRole?.role !== "admin" || userRole?.role !== "user") throw new Error("Rôles de recette incohérents");
    record("Contrôle des rôles");

    const form = new FormData();
    form.set("title", `${runId} contenu texte`);
    form.set("type", "text");
    form.set("author", `Recette ${runId}`);
    form.set("category", "Recette");
    form.set("description", `Contenu créé pour la campagne ${runId}`);
    form.set("duration", "");
    form.set("thumbnail", "");
    const createdMessage = await request(
      "Création du contenu de recette",
      apiUrl("/messages"),
      { method: "POST", headers: authHeaders(state.adminToken), body: form },
      [200, 201],
    );
    state.messageId = createdMessage?.message?.id;
    if (!state.messageId) throw new Error("Création du contenu : identifiant absent");
    if (createdMessage?.message?.status !== "draft") throw new Error("Le contenu doit etre cree en brouillon");
    const draftRead = await fetch(apiUrl(`/messages/${state.messageId}`), { headers: authHeaders(state.userToken) });
    if (draftRead.status !== 403) throw new Error(`Un brouillon est accessible a un utilisateur standard (HTTP ${draftRead.status})`);
    record("Brouillon non accessible publiquement");
    await transitionEditorial("messages", state.messageId, "in_review");
    await transitionEditorial("messages", state.messageId, "published");
    record("Workflow éditorial contenu");
    record("DB-05 contenu admin");

    const createdSeries = await request(
      "Création de la série de recette",
      apiUrl("/series"),
      {
        method: "POST",
        headers: { ...authHeaders(state.adminToken), "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${runId} série`,
          description: "Série de recette temporaire",
          author: `Recette ${runId}`,
          category: "Recette",
          messageIds: [state.messageId],
        }),
      },
      [200, 201],
    );
    state.seriesId = createdSeries?.series?.id;
    if (!state.seriesId) throw new Error("Création de la série : identifiant absent");
    if (createdSeries?.series?.status !== "draft") throw new Error("La série doit etre creee en brouillon");
    await transitionEditorial("series", state.seriesId, "in_review");
    await transitionEditorial("series", state.seriesId, "published");
    record("Workflow éditorial série");
    record("DB-06 série admin");

    const favorite = await request(
      "Ajout du favori",
      apiUrl("/favorites/toggle"),
      {
        method: "POST",
        headers: { ...authHeaders(state.userToken), "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: state.messageId }),
      },
      [200],
    );
    if (favorite?.favorited !== true) throw new Error("Le favori n'a pas été créé");
    state.favoriteActive = true;
    const favorites = await request("Lecture des favoris", apiUrl("/favorites"), { headers: authHeaders(state.userToken) });
    if (!favorites?.favorites?.includes(state.messageId)) throw new Error("Favori absent après écriture");
    record("DB-02 favori");

    const createdComment = await request(
      "Création du commentaire",
      apiUrl(`/messages/${state.messageId}/comments`),
      {
        method: "POST",
        headers: { ...authHeaders(state.userToken), "Content-Type": "application/json" },
        body: JSON.stringify({ text: `${runId} commentaire` }),
      },
      [200, 201],
    );
    state.commentId = createdComment?.comment?.id;
    if (!state.commentId) throw new Error("Création du commentaire : identifiant absent");
    record("DB-03 commentaire");

    const progress = await request(
      "Enregistrement de la progression",
      apiUrl(`/series/${state.seriesId}/progress`),
      {
        method: "POST",
        headers: { ...authHeaders(state.userToken), "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: state.messageId }),
      },
      [200],
    );
    if (!progress?.progress?.completedMessageIds?.includes(state.messageId)) {
      throw new Error("Progression absente après écriture");
    }
    record("DB-04 progression");

    const unauthorizedAdminWrite = await fetch(apiUrl("/messages"), {
      method: "POST",
      headers: authHeaders(state.userToken),
    });
    if (unauthorizedAdminWrite.status !== 403) {
      throw new Error(`Écriture admin par utilisateur standard acceptée (HTTP ${unauthorizedAdminWrite.status})`);
    }
    record("Refus d'écriture admin non autorisée");

    const audit = await request("Lecture de l'audit", apiUrl("/admin/audit-log"), { headers: authHeaders(state.adminToken) });
    const hasCreateMessageAudit = audit?.logs?.some((log) => log.action === "create_message" && log.metadata?.messageId === state.messageId);
    if (!hasCreateMessageAudit) throw new Error("Audit de création du contenu introuvable");
    record("Audit de création");

    const invalidMediaForm = new FormData();
    invalidMediaForm.set("title", `${runId} média invalide`);
    invalidMediaForm.set("type", "audio");
    invalidMediaForm.set("author", `Recette ${runId}`);
    invalidMediaForm.set("category", "Recette");
    invalidMediaForm.set("media", new File(["image"], "image.mp3", { type: "image/png" }));
    const rejectedMedia = await request(
      "Refus du média MIME invalide",
      apiUrl("/messages"),
      { method: "POST", headers: authHeaders(state.adminToken), body: invalidMediaForm },
      [400],
    );
    if (!rejectedMedia?.error) throw new Error("Le média MIME invalide n'a pas été refusé explicitement");
    record("Refus upload extension/MIME incohérent");

    const validMediaForm = new FormData();
    validMediaForm.set("title", `${runId} média signé`);
    validMediaForm.set("type", "audio");
    validMediaForm.set("author", `Recette ${runId}`);
    validMediaForm.set("category", "Recette");
    validMediaForm.set("media", new File([new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00])], "message.mp3", { type: "audio/mpeg" }));
    const createdMedia = await request(
      "Création du média signé",
      apiUrl("/messages"),
      { method: "POST", headers: authHeaders(state.adminToken), body: validMediaForm },
      [200, 201],
    );
    state.mediaMessageId = createdMedia?.message?.id;
    if (!state.mediaMessageId) throw new Error("Création du média : identifiant absent");
    await transitionEditorial("messages", state.mediaMessageId, "in_review");
    await transitionEditorial("messages", state.mediaMessageId, "published");
    const mediaDetail = await request("Lecture du média signé", apiUrl(`/messages/${state.mediaMessageId}`), {
      headers: authHeaders(state.userToken),
    });
    const signedUrl = mediaDetail?.message?.mediaUrl;
    if (!signedUrl) throw new Error("URL signée absente");
    const signedResponse = await fetch(signedUrl);
    if (!signedResponse.ok) throw new Error(`URL signée inaccessible (HTTP ${signedResponse.status})`);
    const signedToken = new URL(signedUrl).searchParams.get("token");
    if (!signedToken) throw new Error("Jeton de l'URL signée absent");
    const payloadSegment = signedToken.split(".")[1];
    const signedPayload = payloadSegment
      ? JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"))
      : null;
    const remainingTtl = Number(signedPayload?.exp) - Math.floor(Date.now() / 1000);
    if (!Number.isFinite(remainingTtl) || remainingTtl < 30 || remainingTtl > 330) {
      throw new Error(`Durée de l'URL signée inattendue (${remainingTtl}s)`);
    }
    record("URL média signée courte durée");

    const clientErrorMarker = `${runId} erreur frontend`;
    const clientError = await request(
      "Collecte de l'erreur frontend",
      apiUrl("/observability/client-errors"),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: clientErrorMarker, source: "recette.staging", path: "/recette" }),
      },
      [202],
    );
    if (!clientError?.requestId) throw new Error("Identifiant de corrélation absent sur l'erreur frontend");
    const clientErrors = await request(
      "Lecture de l'erreur frontend",
      `${supabaseUrl}/rest/v1/client_error_logs?message=eq.${encodeURIComponent(clientErrorMarker)}&select=id,message`,
      { headers: serviceHeaders },
      [200],
    );
    state.clientErrorId = clientErrors?.[0]?.id;
    if (!state.clientErrorId) throw new Error("Erreur frontend collectée mais introuvable en base");
    record("Collecte erreur frontend et corrélation");

    let rateLimitObserved = false;
    for (let attemptIndex = 0; attemptIndex < 15; attemptIndex += 1) {
      const limitedResponse = await fetch(apiUrl("/auth/signup"), {
        method: "POST",
        headers: { Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
        body: "{}",
      });
      if (limitedResponse.status === 429) {
        if (!limitedResponse.headers.get("retry-after")) throw new Error("Réponse 429 sans Retry-After");
        rateLimitObserved = true;
        break;
      }
      if (limitedResponse.status !== 400) {
        throw new Error(`Réponse inattendue pendant le test rate limiting (HTTP ${limitedResponse.status})`);
      }
    }
    if (!rateLimitObserved) throw new Error("Rate limiting non déclenché après 15 tentatives");
    record("Rate limiting HTTP 429");

    console.log(`Recette staging réussie (${runId}) : ${results.join(", ")}`);
  } finally {
    await cleanup();
    console.log(`Nettoyage de recette terminé (${runId}).`);
  }
}

run().catch((error) => {
  console.error(`Recette staging en échec : ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
