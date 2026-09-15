lens: [PERF] performance

findings:
  
  - severity: major
    what:     Message history is fetched and rendered unbounded — no limit, no windowing
    where:    backend/src/routes/messages.ts:10-17, frontend/src/components/ChatConversation.tsx:185
    why:      Opening a long thread ships the whole history and mounts one DOM node per message, so open time and every re-render degrade linearly
    fix:      Add limit/cursor paging with newest-first load plus scroll-back, and virtualise the bubble list

  - severity: major
    what:     A typing event is emitted on every keystroke with no throttle; the declared timer is cleared but never set
    where:    frontend/src/components/ChatInput.tsx:13-17, frontend/src/lib/socket.ts:33
    why:      One socket round trip per character, fanned out to every peer in the room, for a 2s indicator
    fix:      Throttle emitTyping to roughly one event per 1.5-2s using the existing ref timer

  - severity: major
    what:     Search is ilike '%q%' with no trigram/GIN index, plus a separate existence round trip first
    where:    backend/src/routes/messages.ts:30-46, backend/supabase/schema.sql:19-20
    why:      Leading-wildcard match cannot use any index, so each debounced keystroke sequentially scans the whole messages table
    fix:      Add a pg_trgm GIN index (or tsvector full-text column) and drop the pre-check by using the filtered query's own empty result

  - severity: major
    what:     No composite (conversation_id, created_at) index for the ordered per-conversation queries
    where:    backend/supabase/schema.sql:19-20
    why:      Every history fetch and the AI's newest-20 lookup reads all rows of the conversation and sorts them instead of walking an index
    fix:      Replace the two single-column indexes with create index on messages(conversation_id, created_at desc)

  - severity: minor
    what:     MessageBubble is unmemoised and recompiles a RegExp per bubble per render during search
    where:    frontend/src/components/MessageBubble.tsx:47-54, frontend/src/components/ChatConversation.tsx:185-192
    why:      Each new message re-renders and re-highlights the entire list; the /g regex also carries lastIndex state across .test calls
    fix:      Wrap MessageBubble in React.memo and build one escaped, non-global regex per query in the parent

verdict: needs work
