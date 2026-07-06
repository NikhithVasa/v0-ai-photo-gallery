# Agent Handbook

This handbook is for AI coding agents working in the SaathiDesk repository.

## Prime Directive

Make the smallest correct change that satisfies the current request, and update the nearest docs when behavior changes. This repo has production-shaped compatibility code, so do not simplify defensive checks unless you understand the deployment history.

## Fast Orientation

| Need | Start here |
| --- | --- |
| Page behavior | Route in `app/`, then mounted component in `components/`. |
| API behavior | Route handler in `app/api/`, then helper in `lib/`. |
| Auth or share access | `lib/auth-access.ts`, `lib/album-access.ts`, `lib/share-access.ts`. |
| Customer subdomains | `middleware.ts`, `lib/customer-host.ts`. |
| Photo shape or media URL | `lib/gallery-data.ts`, `lib/s3.ts`, `lib/types.ts`. |
| Upload behavior | `app/api/uploads/route.ts`, upload UI component, `lib/s3.ts`. |
| Sorting | `lib/photo-sort.ts` and photo routes. |
| Presets | `lib/preset-*`, preset routes, preset components. |
| Google imports | `lib/google-photos-picker.ts`, `lib/google-drive-picker.ts`, Google docs. |

## Safe Search Pattern

1. Start from the named file, route, component, or failing command.
2. Read the nearest helper that actually makes the decision.
3. Form one local hypothesis and one cheap validation.
4. Edit narrowly.
5. Run the focused check before expanding.

## Do Not Break These Contracts

- Public share links can be restricted by token, passcode, people, event tabs, watermarks, downloads, and expiration.
- Customer subdomains should not become indexable.
- RAW/TIFF originals should not be used as browser image sources unless a renderer is added.
- `pnpm build` must keep running the Google Photos picker verification script.
- Database helpers must tolerate auth-token refresh and connection-limit errors.
- Runtime schema compatibility checks exist for a reason.

## Validation Shortcuts

Use the narrowest relevant check:

```bash
pnpm lint
pnpm build
pnpm verify:google-photos-picker
git diff --check
```

Quote bracket route paths in zsh commands:

```bash
git diff -- 'app/albums/[albumSlug]/page.tsx'
```

## Documentation Duties

When you change behavior, update one of these:

- Customer-facing workflow: `docs/customer/`.
- Internal behavior, APIs, env, operations: `docs/developer/`.
- Agent workflow or repo map: `docs/agents/`.
- Directory ownership: nearest `README.md` in `app/`, `components/`, `lib/`, or another top-level folder.
