# UI and Styling

## Libraries
No icon or toast library is installed. Icons are **inline `<svg>`** elements
(see the search icon in `frontend/src/App.tsx`). Do not add `lucide-react`,
`sonner`, or any other UI dependency without the plan calling for it.

## Styling engine
`frontend/` is styled with **Tailwind CSS v4** via the Vite plugin
(`@tailwindcss/vite`, wired in `frontend/vite.config.ts`). The single entry
point is `frontend/src/index.css`, which is just `@import "tailwindcss";`.
Use utility classes. Do not add new `.css` files and do not use inline styles.

## Visual language
This is a WhatsApp-style chat UI. Reuse the existing palette rather than
inventing one — notably the header green `#075E54` and the app's
`max-w-sm` / `rounded-2xl` phone-frame shell in `App.tsx`.

## Design tokens
- Prefer CSS variables for colors, spacing, sizing, and other shared tokens.
- Declare tokens in `:root` in `index.css` and expose them to utilities via
  `@theme inline`.
- Use nested CSS only where it improves scoping and readability.

> Resolves Q3 of `.plan/002-2026-08-03-pixel-perfect-the-visual-design.md`: the
> former `main.css` / `setup` / `basics` / `cmps` structure predated this Tailwind
> setup and no longer applies. The token intent above is what survives from it.
