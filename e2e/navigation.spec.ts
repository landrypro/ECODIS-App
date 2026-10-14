import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/functions/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.includes("/messages")) return route.fulfill({ json: { messages: [] } });
    if (pathname.includes("/series")) return route.fulfill({ json: { series: [], messages: [] } });
    return route.fulfill({ json: {} });
  });
  await page.route("**/auth/v1/**", (route) => route.fulfill({ json: { user: null, session: null } }));
});

test("accueil : les categories dirigent vers les contenus", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByAltText("ECODIS").first()).toBeVisible();
  await page.getByText("Audio", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/audio$/);
});

test("connexion : le formulaire est accessible", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByText("Connexion", { exact: true }).first()).toBeVisible();
  await expect(page.getByPlaceholder("votre@email.com")).toBeVisible();
  await expect(page.getByPlaceholder("Votre mot de passe")).toBeVisible();
});

test("connexion : le lien de recuperation ouvre la demande de reinitialisation", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("link", { name: "Mot de passe oublie ?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByText("Mot de passe oublie", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Envoyer le lien" })).toBeVisible();
});

test("reinitialisation : un lien sans session est refuse", async ({ page }) => {
  await page.goto("/reset-password");

  await expect(page.getByText("Ce lien est invalide ou expire. Demandez un nouveau lien de reinitialisation.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Demander un nouveau lien" })).toBeVisible();
});

test("securite MFA : la page est accessible et protege un visiteur", async ({ page }) => {
  await page.goto("/security/mfa");

  await expect(page.getByText("Sécurité MFA", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
});

test("inscription : le lien vers la connexion fonctionne", async ({ page }) => {
  await page.goto("/signup");

  await expect(page.getByText("Inscription", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
