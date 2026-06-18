import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// RLS-regressietest: bewijst dat de anon-key (publiek, in de JS-bundle) GEEN
// gevoelige profiel-PII kan lezen. Bewaakt de fix uit migratie
// `scope_profiles_select_policy` (juni 2026). Zie buuur-admin/RLS-FIX-VOORSTEL.sql.

// Env: eerst process.env, anders ../.env parsen zodat de test out-of-the-box draait.
function readEnv() {
  let url = process.env.VITE_SUPABASE_URL;
  let key = process.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) return { url, key };
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(here, "..", ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)\s*=\s*(.+?)\s*$/);
      if (m) {
        if (m[1] === "VITE_SUPABASE_URL") url = m[2];
        else key = m[2];
      }
    }
  } catch {
    /* .env niet gevonden — test wordt geskipt */
  }
  return { url, key };
}

const { url, key } = readEnv();

test.describe("RLS — anon mag geen profiel-PII lezen", () => {
  test.skip(!url || !key, "VITE_SUPABASE_URL/ANON_KEY niet beschikbaar");

  const anon = url && key ? createClient(url, key) : null;

  test("anon ziet geen adres-PII in profiles", async () => {
    // Anonieme client (geen sessie) — exact wat een bezoeker van buuur.nl heeft.
    const { data, error } = await anon
      .from("profiles")
      .select("id, street_address, postal_code, date_of_birth, admin_notes, income_indication")
      .not("street_address", "is", null);

    expect(error, error?.message).toBeNull();
    // Géén enkel profiel met adres mag voor anon zichtbaar zijn.
    expect(data ?? []).toHaveLength(0);
  });

  test("anon ziet geen admin_notes / geboortedatum / inkomen", async () => {
    const checks = ["admin_notes", "date_of_birth", "income_indication"];
    for (const col of checks) {
      const { data, error } = await anon.from("profiles").select(`id, ${col}`).not(col, "is", null);
      expect(error, error?.message).toBeNull();
      expect(data ?? [], `anon mag geen rij met ${col} zien`).toHaveLength(0);
    }
  });
});
