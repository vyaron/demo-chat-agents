# PRD — QuickChat (Demo App)

**Version:** 1.0  
**Author:** Product Team  
**Figma:** [REPLACE WITH YOUR FIGMA LINK]  
**Status:** Ready for Development

---

## Overview

QuickChat is a real-time messaging app (WhatsApp-style) for the AI Developers course live demo.
Users can browse a list of conversations and exchange messages in real time via WebSockets.

---

## Screens

### Screen 1 — Chat List
- Header: "QuickChat" title + user avatar (top right)
- Search bar below header (UI only — no filter logic required for v1)
- List of conversations, each showing:
  - Contact avatar (circle, 48px)
  - Contact name (bold)
  - Last message preview (truncated, 1 line)
  - Timestamp of last message (right-aligned)
  - Unread badge (green circle with count) if unread > 0
- Tapping/clicking a conversation opens Screen 2

### Screen 2 — Conversation View
- Header: back arrow + contact avatar + contact name + online indicator (green dot)
- Message list (scrollable):
  - Own messages: right-aligned, green bubble (#25D366)
  - Other messages: left-aligned, white bubble with light shadow
  - Timestamp below each bubble (HH:MM)
  - Date separator when day changes (e.g. "Today", "Yesterday")
- Input area (pinned to bottom):
  - Text input (placeholder: "Message")
  - Send button (paper-plane icon, active only when text is non-empty)
  - Typing indicator ("Alice is typing..." above input) when remote user is typing

### Screen 3 — New Chat (stretch goal, not required for v1)
- Not in scope for this sprint

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| F1 | User sees a list of existing conversations on app load |
| F2 | User can open a conversation and see message history |
| F3 | User can type and send a message |
| F4 | Sent message appears immediately in the conversation (optimistic update) |
| F5 | Message is persisted to Supabase |
| F6 | Other users in the same conversation receive the message in real time via WebSocket |
| F7 | Typing indicator is shown when the other user is typing |
| F8 | App works on desktop (1280px+) and mobile (375px+) |

---

## Non-Functional Requirements

- First meaningful paint < 2 seconds on local network
- No full-page reload when navigating between screens
- Graceful error state if WebSocket disconnects (show "Reconnecting..." banner)

---

## Acceptance Criteria

1. **AC-1:** On load, at least 2 conversations are visible in the list
2. **AC-2:** Clicking a conversation shows the correct message history
3. **AC-3:** Sending a message adds it to the list without page reload
4. **AC-4:** The sent message is stored in Supabase `messages` table
5. **AC-5:** Opening the app in a second browser tab shows the message sent from the first tab
6. **AC-6:** Typing in the input causes the other tab to show a typing indicator
7. **AC-7:** The UI matches the Figma designs (colors, spacing, component structure)
8. **AC-8:** All frontend unit tests pass
9. **AC-9:** All backend API tests pass
10. **AC-10:** Playwright e2e tests pass for AC-3 and AC-5

---

## Data Model (proposed)

```
conversations
  id            uuid PK
  name          text
  avatar_url    text
  created_at    timestamptz

messages
  id            uuid PK
  conversation_id uuid FK → conversations.id
  sender_id     text        (simple string for demo — no auth)
  sender_name   text
  content       text
  created_at    timestamptz
```

---

## Out of Scope (v1)
- User authentication
- Push notifications
- Message reactions / read receipts
- Media attachments
- Group chats
