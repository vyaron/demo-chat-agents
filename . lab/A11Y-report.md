lens: [A11Y] accessibility — frontend/src

findings:
  - severity: blocker
    what:     Conversation rows are click-only <li> elements with no role, tabIndex or key handler
    where:    frontend/src/components/ChatList.tsx:45-50
    why:      Keyboard and screen reader users can never open a chat — the app's only entry point is mouse-only
    fix:      Render the row as a <button> (or li > button) so Tab, Enter and Space reach onSelect natively

  - severity: blocker
    what:     Own-message bubble is white text on #25D366, ~2.0:1; its timestamp (green-100) is ~1.9:1
    where:    frontend/src/components/MessageBubble.tsx:22,35
    why:      The user's own messages — the primary content — fail WCAG AA 4.5:1 by more than half
    fix:      Darken the bubble to the WhatsApp outgoing tone or switch bubble text to a near-black foreground

  - severity: major
    what:     Both search inputs set outline-none with no focus-visible replacement
    where:    frontend/src/App.tsx:34 and frontend/src/components/SearchInput.tsx:121
    why:      A keyboard user tabbing through the shell has no visible indication of where focus is
    fix:      Add focus-visible:ring-2 focus-visible:ring-[#075E54] on the wrapper instead of stripping the outline

  - severity: major
    what:     No aria-live anywhere — incoming socket messages, typing indicator, "Reconnecting...", result count
    where:    frontend/src/components/ChatConversation.tsx:157-161,171-175,193-199; SearchInput.tsx:129
    why:      A screen reader user hears nothing when a message arrives, the socket drops, or a search returns
    fix:      aria-live="polite" on the message list and result count, role="status" on the banner and typing row

    
verdict: serious problems
