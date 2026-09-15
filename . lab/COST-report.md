lens: [COST] LLM unit economics — dev-loop.js per run, backend/src/lib/ai.ts per @ai message

findings:
  - severity: blocker
    what:     @ai triggers an Opus 5 call with no auth, no rate limit and no message-length cap
    where:    backend/src/socket/chat.ts:48 (gate) and backend/src/index.ts:39 (no io.use)
    why:      any socket.io client can loop "@ai" + a huge paste and run the bill up without limit
    fix:      authenticate the socket, cap content length, and add a per-conversation reply cooldown

        
  - severity: minor
    what:     model ids hardcoded in five places; no prompt caching and response.usage discarded
    where:    dev-loop.js:402,459,535,735; trace-agent.js:69; backend/src/lib/ai.ts:18,64
    why:      no cheap rehearsal mode, the ticket call pays Opus rates, and @ai spend is unobservable
    fix:      read the model from env, add a cache_control breakpoint, and log usage per reply

verdict: serious problems
