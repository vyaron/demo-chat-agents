import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";

// Mock Supabase before importing app
vi.mock("../src/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Patch list responses
import { supabase } from "../src/lib/supabase";

beforeAll(() => {
  (supabase.from as any).mockImplementation((table: string) => {
    const chainable = {
      select: vi.fn(function() { return this; }),
      insert: vi.fn(function() { return this; }),
      eq: vi.fn(function() { return this; }),
      ilike: vi.fn(function() { return this; }),
      order: vi.fn(function() { return this; }),
      single: vi.fn(),
    };

    if (table === "conversations") {
      chainable.single.mockResolvedValue({
        data: { id: "conv-1", name: "Alice", avatar_url: "https://i.pravatar.cc/150?u=alice" },
        error: null,
      });
      
      chainable.order.mockResolvedValue({
        data: [
          { id: "conv-1", name: "Alice", avatar_url: "https://i.pravatar.cc/150?u=alice", created_at: new Date().toISOString(), messages: [] },
          { id: "conv-2", name: "Bob",   avatar_url: "https://i.pravatar.cc/150?u=bob",   created_at: new Date().toISOString(), messages: [] },
        ],
        error: null,
      });
    } else if (table === "messages") {
      chainable.order.mockResolvedValue({
        data: [
          { id: "msg-1", conversation_id: "conv-1", sender_id: "u1", sender_name: "Alice", content: "Hello world", created_at: "2026-06-29T10:00:00Z" },
          { id: "msg-2", conversation_id: "conv-1", sender_id: "u2", sender_name: "Bob", content: "HELLO there!", created_at: "2026-06-29T10:05:00Z" },
        ],
        error: null,
      });

      chainable.single.mockResolvedValue({
        data: { id: "msg-new", conversation_id: "conv-1", sender_id: "u2", sender_name: "Bob", content: "Hello", created_at: new Date().toISOString() },
        error: null,
      });
    }

    return chainable;
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

describe("GET /api/conversations/:id/messages/search", () => {
  it("returns array of matching messages", async () => {
    const res = await request(app)
      .get("/api/conversations/conv-1/messages/search")
      .query({ q: "hello" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("search is case-insensitive", async () => {
    const res = await request(app)
      .get("/api/conversations/conv-1/messages/search")
      .query({ q: "HELLO" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns 400 when q parameter is missing", async () => {
    const res = await request(app)
      .get("/api/conversations/conv-1/messages/search");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when q parameter is empty string", async () => {
    const res = await request(app)
      .get("/api/conversations/conv-1/messages/search")
      .query({ q: "" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when q parameter is whitespace only", async () => {
    const res = await request(app)
      .get("/api/conversations/conv-1/messages/search")
      .query({ q: "   " });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 404 when conversation not found", async () => {
    (supabase.from as any).mockImplementationOnce((table: string) => {
      if (table === "conversations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: "Not found",
          }),
        };
      }
    });

    const res = await request(app)
      .get("/api/conversations/invalid-id/messages/search")
      .query({ q: "hello" });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("handles special characters in search query", async () => {
    const res = await request(app)
      .get("/api/conversations/conv-1/messages/search")
      .query({ q: "hello (world)" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("results are sorted by created_at ASC", async () => {
    const res = await request(app)
      .get("/api/conversations/conv-1/messages/search")
      .query({ q: "hello" });
    expect(res.status).toBe(200);
    
    if (res.body.length > 1) {
      for (let i = 1; i < res.body.length; i++) {
        const prev = new Date(res.body[i - 1].created_at).getTime();
        const curr = new Date(res.body[i].created_at).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    }
  });

  it("each result has required message fields", async () => {
    const res = await request(app)
      .get("/api/conversations/conv-1/messages/search")
      .query({ q: "hello" });
    expect(res.status).toBe(200);
    
    if (res.body.length > 0) {
      const msg = res.body[0];
      expect(msg).toHaveProperty("id");
      expect(msg).toHaveProperty("conversation_id");
      expect(msg).toHaveProperty("sender_id");
      expect(msg).toHaveProperty("sender_name");
      expect(msg).toHaveProperty("content");
      expect(msg).toHaveProperty("created_at");
    }
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
