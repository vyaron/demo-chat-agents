import { Router } from "express";
import { supabase } from "../lib/supabase";
import { sendUpstreamError } from "../lib/error";

export const conversationsRouter = Router();

conversationsRouter.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("conversations")
    .select(`
      id, name, avatar_url, created_at,
      messages(content, created_at)
    `)
    .order("created_at", { ascending: false });

  if (error) return sendUpstreamError(res, "conversation.list", error)

  const enriched = (data ?? []).map((c: any) => {
    const msgs: any[] = c.messages ?? [];
    const last = msgs.sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    return {
      id: c.id,
      name: c.name,
      avatar_url: c.avatar_url,
      last_message: last?.content ?? null,
      last_message_at: last?.created_at ?? c.created_at,
      unread_count: 0,
    };
  });

  res.json(enriched);
});
