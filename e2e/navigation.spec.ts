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

test("inscription : le lien vers la connexion fonctionne", async ({ page }) => {
  await page.goto("/signup");

  await expect(page.getByText("Inscription", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
