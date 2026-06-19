import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";

// Mock Supabase before importing app
vi.mock("../src/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "msg-1",
          conversation_id: "conv-1",
          sender_id: "user-1",
          sender_name: "Test User",
          content: "Hello",
          created_at: new Date().toISOString(),
        },
        error: null,
      }),
    })),
  },
}));

// Patch list responses
import { supabase } from "../src/lib/supabase";

beforeAll(() => {
  (supabase.from as any).mockImplementation((table: string) => {
    if (table === "conversations") {
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: "conv-1", name: "Alice", avatar_url: "https://i.pravatar.cc/150?u=alice", created_at: new Date().toISOString(), messages: [] },
            { id: "conv-2", name: "Bob",   avatar_url: "https://i.pravatar.cc/150?u=bob",   created_at: new Date().toISOString(), messages: [] },
          ],
          error: null,
        }),
      };
    }
    if (table === "messages") {
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: "msg-1", conversation_id: "conv-1", sender_id: "u1", sender_name: "Alice", content: "Hi!", created_at: new Date().toISOString() },
          ],
          error: null,
        }),
        single: vi.fn().mockResolvedValue({
          data: { id: "msg-new", conversation_id: "conv-1", sender_id: "u2", sender_name: "Bob", content: "Hello", created_at: new Date().toISOString() },
          error: null,
        }),
      };
    }
  });
});

import { app } from "../src/index";

describe("GET /api/conversations", () => {
  it("returns array of conversations", async () => {
    const res = await request(app).get("/api/conversations");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it("each conversation has required fields", async () => {
    const res = await request(app).get("/api/conversations");
    const conv = res.body[0];
    expect(conv).toHaveProperty("id");
    expect(conv).toHaveProperty("name");
    expect(conv).toHaveProperty("avatar_url");
  });
});

describe("GET /api/conversations/:id/messages", () => {
  it("returns messages array", async () => {
    const res = await request(app).get("/api/conversations/conv-1/messages");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /api/conversations/:id/messages", () => {
  it("creates a message and returns 201", async () => {
    const res = await request(app)
      .post("/api/conversations/conv-1/messages")
      .send({ sender_id: "u2", sender_name: "Bob", content: "Hello" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.content).toBe("Hello");
  });

  it("returns 400 when content is missing", async () => {
    const res = await request(app)
      .post("/api/conversations/conv-1/messages")
      .send({ sender_id: "u2", sender_name: "Bob" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when sender_id is missing", async () => {
    const res = await request(app)
      .post("/api/conversations/conv-1/messages")
      .send({ sender_name: "Bob", content: "Hello" });
    expect(res.status).toBe(400);
  });
});
