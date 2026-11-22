import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Run ONLY against a separate non-production Supabase project with two test users.
const enabled = process.env.RUN_RLS_TESTS === "1";
const suite = enabled ? describe : describe.skip;

suite("Real authenticated RLS isolation", () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let userA = "";
  let userB = "";
  let createdId = "";

  beforeAll(async () => {
    const url = process.env.TEST_SUPABASE_URL;
    const key = process.env.TEST_SUPABASE_PUBLISHABLE_KEY;
    const emailA = process.env.TEST_USER_A_EMAIL;
    const passA = process.env.TEST_USER_A_PASSWORD;
    const emailB = process.env.TEST_USER_B_EMAIL;
    const passB = process.env.TEST_USER_B_PASSWORD;
    if (![url, key, emailA, passA, emailB, passB].every(Boolean))
      throw new Error("Missing dedicated integration test credentials");
    if (process.env.NODE_ENV === "production") throw new Error("Never run this against production");
    a = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
    b = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
    const [loginA, loginB] = await Promise.all([
      a.auth.signInWithPassword({ email: emailA!, password: passA! }),
      b.auth.signInWithPassword({ email: emailB!, password: passB! }),
    ]);
    if (loginA.error || loginB.error || !loginA.data.user || !loginB.data.user)
      throw new Error("Sign-in failed for test accounts");
    userA = loginA.data.user.id; userB = loginB.data.user.id;
    if (userA === userB) throw new Error("Tests require two distinct users");
  });

  afterAll(async () => {
    // Scoped cleanup: only the exact record created by this test account.
    if (createdId && a) await a.from("companies").delete().eq("id", createdId).eq("owner_id", userA);
    if (a) await a.auth.signOut();
    if (b) await b.auth.signOut();
  });

  it("user B cannot read, change or delete user A's company", async () => {
    const domain = `https://rls-stage7-${crypto.randomUUID()}.example.com`;
    const { data: created, error } = await a.from("companies")
      .insert({ owner_id: userA, name: "Stage 7 RLS synthetic company", website: domain })
      .select("id").single();
    expect(error).toBeNull();
    createdId = created!.id;

    const read = await b.from("companies").select("id").eq("id", createdId);
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);

    const changed = await b.from("companies").update({ name: "Hijacked" })
      .eq("id", createdId).select("id");
    expect(changed.data ?? []).toEqual([]);

    const removed = await b.from("companies").delete().eq("id", createdId).select("id");
    expect(removed.data ?? []).toEqual([]);

    const forged = await b.from("companies").insert({ owner_id: userA, name: "Forged", website: `https://forged-${crypto.randomUUID()}.example.com` });
    expect(forged.error).not.toBeNull();

    const stillExists = await a.from("companies").select("name").eq("id", createdId).single();
    expect(stillExists.data?.name).toBe("Stage 7 RLS synthetic company");
  });
});
