import { test, expect } from "@playwright/test";

// Pre-launch smoke-test voor de community-app (buuur.nl).
// Doel: vang "wit scherm" / boot-fouten op de publieke routes na elke deploy.
// Geen credentials nodig.

test.describe("Community smoke", () => {
  test("landingspagina boot zonder JS-fout", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    const resp = await page.goto("/");
    expect(resp?.status(), `status ${resp?.status()}`).toBeLessThan(500);

    // De React-app moet daadwerkelijk in #root renderen (geen blank app-shell).
    await expect(page.locator("#root")).not.toBeEmpty();
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("loginpagina toont e-mailveld", async ({ page }) => {
    await page.goto("/login");
    const email = page.locator('input[type="email"], input[name="email"]');
    await expect(email.first()).toBeVisible();
  });

  test("publieke juridische pagina's laden", async ({ page }) => {
    for (const path of ["/privacy", "/voorwaarden"]) {
      const resp = await page.goto(path);
      expect(resp?.status(), `${path} → ${resp?.status()}`).toBeLessThan(500);
      await expect(page.locator("#root")).not.toBeEmpty();
    }
  });
});

// --- OPTIONEEL: ingelogde + RLS-regressietest ------------------------------
// Sterke aanvulling op de RLS-fix: een geautomatiseerde test die bevestigt dat
// een anonieme client GEEN profielen kan dumpen. Vereist VITE_SUPABASE_* env.
//
// import { createClient } from '@supabase/supabase-js';
// test('anon kan geen profielen lezen (RLS)', async () => {
//   const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
//   const { data } = await sb.from('profiles').select('id').limit(5);
//   expect(data ?? []).toHaveLength(0);   // moet 0 zijn ná de RLS-fix
// });
