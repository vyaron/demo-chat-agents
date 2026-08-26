# Messages Search - Full Stack Feature

**Status:** done  
**Owner:** Orchestrator Agent  
**Last updated:** 2026-06-29  

---

## Goal

Enable users to search for messages within a conversation by text content. The search should be fast, intuitive, and return matching results highlighted in the message list.

---

## Scope

### Frontend
- Add a search input field to the conversation view (above message list or integrated into header)
- Display search results filtered by query term
- Highlight matching text in message bubbles
- Show result count (e.g., "3 results")
- Add clear/cancel button to exit search mode

### Backend
- Implement `/api/conversations/{id}/messages/search` endpoint
- Accept query parameter: `q` (search term)
- Return filtered messages matching the query
- Ensure search is case-insensitive

### Database
- No schema changes required (search on existing `content` field)

---

## Assumptions

1. Search is local to a single conversation (not global)
2. Search is case-insensitive substring match (no regex/fuzzy matching required for v1)
3. All messages are already loaded or will be fetched fresh on search
4. WebSocket messaging continues to work during search mode

---

## Open Questions

1. **Pagination for large result sets?** Should search results be paginated, or assume all results fit in memory?  
   *Recommended: Assume < 1000 messages per conversation for now (no pagination needed)*

2. **Real-time search or debounced?** Should results update as the user types, or require pressing Enter?  
   *Recommended: Debounced (300ms) search as user types for better UX*

3. **Search history?** Should we remember recent searches?  
   *Recommended: Not required for v1*

---

## Steps

### Phase 1: API Contract (Frontend Agent)
1. Define new search endpoint in `docs/api-contract.yaml`:
   - `GET /api/conversations/{id}/messages/search?q={query}`
   - Response: array of `Message` objects matching the query

### Phase 2: Frontend Implementation (Frontend Agent)
1. Add search input UI to conversation header or above message list
2. Implement search state management (query term, filtered results)
3. Add debounced fetch to call search endpoint
4. Render filtered message list with highlighting
5. Add clear/cancel UI
6. Add unit tests for search state logic
7. Add e2e test for search workflow

### Phase 3: Backend Implementation (Backend Agent)
1. Implement `/api/conversations/{id}/messages/search` route
2. Query `messages` table by `conversation_id` and filter by `content LIKE` (case-insensitive)
3. Return matching messages sorted by `created_at ASC`
4. Add error handling (invalid conversation ID, etc.)
5. Add backend API tests

### Phase 4: QA Validation (QA Agent)
1. Test search finds matching messages
2. Test case-insensitive search
3. Test empty result set
4. Test special characters in search query
5. Test search does not break real-time messaging
6. E2E test: Send message → search for it → verify found

---

## Validation

- [ ] Search endpoint is documented in `docs/api-contract.yaml`
- [ ] Frontend search input is visible in conversation view
- [ ] Searching for a word finds all matching messages
- [ ] Search is case-insensitive
- [ ] Highlighting appears in matched messages
- [ ] Clear button returns to full message list
- [ ] All frontend unit tests pass
- [ ] All backend API tests pass
- [ ] Playwright e2e test passes for search workflow
- [ ] Real-time messaging still works during search mode

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Search endpoint becomes slow with large messages | Assume < 1000 messages per conversation; optimize DB query if needed later |
| Frontend search state gets out of sync with backend | Store query in component state; clear on conversation change |
| Special characters in query break SQL | Use parameterized queries (Supabase client handles this) |
| Search conflicts with real-time WebSocket updates | Display note when new messages arrive during search |

---

## Rollout Order

1. **Backend**: Implement search endpoint and tests
2. **Frontend**: Implement search UI and integrate with API
3. **QA**: Validate end-to-end workflow

---

## Rollback

- Remove search input UI from conversation header
- Delete `/api/conversations/{id}/messages/search` route
- Remove search tests
- Revert changes to `docs/api-contract.yaml`

---

## Approval Gate

**Please review this plan and type APPROVED to proceed, or provide feedback to revise.**
