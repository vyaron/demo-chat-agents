import { Router } from "express";
import { supabase } from "../lib/supabase";

export const messagesRouter = Router();

messagesRouter.get("/:id/messages", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

messagesRouter.post("/:id/messages", async (req, res) => {
  const { id } = req.params;
  const { sender_id, sender_name, content } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ error: "content is required" });
  }
  if (!sender_id || !sender_name) {
    return res.status(400).json({ error: "sender_id and sender_name are required" });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: id, sender_id, sender_name, content: content.trim() })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});
