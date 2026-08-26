import { Router } from "express";
import { supabase } from "../lib/supabase";
import { sendUpstreamError, sendValidationError } from "../lib/error";

export const messagesRouter = Router();

messagesRouter.get("/:id/messages", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) return sendUpstreamError(res, "message.list", error)
  res.json(data ?? []);
});

messagesRouter.get("/:id/messages/search", async (req, res) => {
  const { id } = req.params;
  const { q } = req.query;

  // Validate query parameter
  if (!q || typeof q !== "string" || !q.trim()) {
    return res.status(400).json({ error: "q parameter is required and must be a non-empty string" });
  }

  // First, verify the conversation exists
  const { data: conversationData, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .single();

  if (conversationError || !conversationData) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  // Query messages with case-insensitive substring match
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .ilike("content", `%${q}%`)
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

messagesRouter.post("/:id/messages", async (req, res) => {
  const { id } = req.params;
  const { sender_id, sender_name, content } = req.body;

  if (!content?.trim()) {
    return sendValidationError(res, "content_required", "content is required")
  }
  if (!sender_id || !sender_name) {
    return sendValidationError(
      res,
      "sender_required",
      "sender_id and sender_name are required"
    )
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: id, sender_id, sender_name, content: content.trim() })
    .select()
    .single();

  if (error) return sendUpstreamError(res, "message.create", error)
  res.status(201).json(data);
});
