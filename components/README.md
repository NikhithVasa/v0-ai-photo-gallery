# Components

`components/` contains the UI implementation for pages and shared interface pieces.

## Layout

- Page-level components usually end with `-page.tsx` and are mounted by route files in `app/`.
- Shared primitives live in `components/ui/`.
- Auth, analytics, media, and navigation helpers live near the top level.

## Change Guidelines

- Preserve existing visual language unless the task asks for a redesign.
- Keep data fetching and access decisions in routes or `lib/` helpers when possible.
- Keep public customer copy clear and task-oriented.
- For visible UI changes, verify desktop and mobile layouts when a browser check is available.
