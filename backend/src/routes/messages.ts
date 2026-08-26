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
