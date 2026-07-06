# Scripts

`scripts/` contains local and build-time verification utilities.

## Current Build Hook

`pnpm build` runs `scripts/verify-google-photos-picker.mjs` before `next build`. Keep that verification in place when changing Google Photos picker behavior.

## Guidelines

- Scripts should be deterministic and safe to run locally.
- Prefer clear exit codes over log-only failures.
- Document new scripts in the root README or developer handbook if they become part of normal development.
