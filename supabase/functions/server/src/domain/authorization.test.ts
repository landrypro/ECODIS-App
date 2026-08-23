Deno.test("authorization - cumule les permissions des rôles", async () => {
  const { getPermissions, hasPermission } = await import("./authorization.ts");
  const roles = ["user", "content_editor", "moderator"] as const;
  if (!hasPermission([...roles], "content_create_own") || hasPermission([...roles], "content_publish")) {
    throw new Error("Les permissions d'un éditeur doivent être limitées à son périmètre");
  }
  if (!getPermissions([...roles]).includes("content_submit_review")) {
    throw new Error("La soumission en revue doit être permise à l'éditeur");
  }
  if (!hasPermission(["moderator"], "comments_moderate")) {
    throw new Error("Le modérateur doit pouvoir traiter les signalements");
  }
});

Deno.test("authorization - réserve les rôles sensibles au super-administrateur", async () => {
  const { canAssignRequestedRoles } = await import("./authorization.ts");
  if (!canAssignRequestedRoles(["admin"], ["user"], ["user", "content_editor"])) {
    throw new Error("Un administrateur doit pouvoir attribuer le rôle éditeur");
  }
  if (canAssignRequestedRoles(["admin"], ["user"], ["user", "admin"])) {
    throw new Error("Un administrateur ne doit pas pouvoir attribuer admin");
  }
  if (canAssignRequestedRoles(["super_admin"], ["user"], ["user", "super_admin"])) {
    throw new Error("Le rôle super_admin reste hors du flux applicatif");
  }
});
