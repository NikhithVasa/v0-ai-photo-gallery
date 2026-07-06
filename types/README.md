# Types

`types/` contains shared TypeScript declarations that do not belong to one component or helper module.

## Guidelines

- Keep public API response types close to the route or `lib/types.ts` when they are product-wide.
- Use this folder for declarations that need to be shared across otherwise unrelated modules.
- Avoid duplicating database row interfaces here when the row shape is local to one query helper.
