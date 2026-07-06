# Hooks

`hooks/` contains reusable React hooks used by components.

## Guidelines

- Keep hooks focused on client-side state, browser APIs, or reusable UI behavior.
- Do not put server-only database, S3, or secret-bearing logic in hooks.
- If a hook depends on a route contract, document the expected response shape near the route or in `docs/developer/`.
