import { createClient } from "@/lib/supabase/server";

export async function getShopkeeperContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") return null;

  const { data: assignments, error: assignmentError } = await supabase
    .from("shop_staff")
    .select("shop_id, role")
    .eq("user_id", userId);

  if (assignmentError || !assignments?.length) return { supabase, userId, assignment: null };
  const assignment = assignments[0];
  return { supabase, userId, assignment };
}
