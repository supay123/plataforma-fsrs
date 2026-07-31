import { expect, test } from "@playwright/test";

const portals = [
  { role: "Administrador", login: "/admin/login", protected: "/admin/usuarios", label: "Contraseña" },
  { role: "Profesor", login: "/profesor/login", protected: "/profesor/cursos", label: "Contraseña" },
  { role: "Estudiante", login: "/estudiante/login", protected: "/estudiante", label: "Contraseña o PIN" },
] as const;

for (const portal of portals) {
  test(`${portal.role}: muestra su acceso y protege sus rutas`, async ({ page }) => {
    await page.goto(portal.login);
    await expect(page.getByRole("heading", { name: `Acceso de ${portal.role}` })).toBeVisible();
    await expect(page.getByLabel("Código")).toBeVisible();
    await expect(page.getByLabel(portal.label)).toBeVisible();

    await page.goto(portal.protected);
    await expect(page).toHaveURL(new RegExp(`${portal.login.replaceAll("/", "\\/")}$`));
  });
}

test("la portada permite escoger cualquiera de los tres portales", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Administrador/ })).toHaveAttribute("href", "/admin/login");
  await expect(page.getByRole("link", { name: /Profesor/ })).toHaveAttribute("href", "/profesor/login");
  await expect(page.getByRole("link", { name: /Estudiante/ })).toHaveAttribute("href", "/estudiante/login");
});

test("una ruta desconocida muestra la página 404", async ({ page }) => {
  await page.goto("/ruta-inexistente");
  await expect(page.getByText("Página no encontrada")).toBeVisible();
});
