"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInShopkeeper(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password || password.length > 256) redirect("/shop/login?error=invalid");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/shop/login?error=invalid");

  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (claimsError || typeof userId !== "string") {
    await supabase.auth.signOut();
    redirect("/shop/login?error=invalid");
  }

  const { data: assignment } = await supabase
    .from("shop_staff")
    .select("shop_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!assignment) {
    await supabase.auth.signOut();
    redirect("/shop/login?error=unassigned");
  }

  redirect("/dashboard");
}

export async function signOutShopkeeper() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/shop/login");
}
