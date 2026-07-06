# SaathiDesk Documentation

SaathiDesk is a customer-branded photo gallery, album delivery, AI culling, search, and sharing app for photographers and event teams. This directory is the durable documentation home for three audiences:

- Customers who need to understand what the product does and how to use it safely.
- Developers who need to run, debug, extend, and operate the application.
- AI agents who need enough map and guardrails to make changes without wandering through the whole repository.

## Start Here

| Audience | Read first | Use when |
| --- | --- | --- |
| Customers and studio teams | [Customer Handbook](customer/handbook.md) | You need workflows for albums, uploads, AI review, sharing, privacy, or account setup. |
| Developers | [Developer Handbook](developer/handbook.md) | You need architecture, setup, env vars, data flow, APIs, or operations notes. |
| AI agents | [Agent Handbook](agents/handbook.md) | You need repo orientation, safe change patterns, or task-specific playbooks. |

## Developer Deep Dives

- [API Map](developer/api-map.md)
- [Auth, Tenancy, and Sharing](developer/auth-tenancy-sharing.md)
- [Data and Media Flow](developer/data-and-media-flow.md)
- [Operations Runbook](developer/operations-runbook.md)

## Agent Deep Dives

- [Change Playbooks](agents/change-playbooks.md)
- [Repo Map](agents/repo-map.md)

## Customer Deep Dives

- [Sharing and Privacy Guide](customer/sharing-and-privacy.md)

## Existing Feature Guides

These guides document deeper implementation details for specific areas:

- [Frontend Data Flow](frontend-data-flow.md)
- [Google Integrations](google-integrations.md)
- [OpenRouter pgvector Search](openrouter-pgvector-search.md)
- [Preset Marketplace and LUT Guide](preset-marketplace-lut-guide.md)
- [S3 Video Upload and Rendering](s3-video-upload-rendering.md)

## Documentation Rules

- Keep customer-facing docs practical and plain-spoken. Avoid implementation details unless they change how a user should work.
- Keep developer docs tied to real files, routes, environment variables, and checks.
- Keep agent docs specific enough to prevent broad, speculative edits.
- When behavior changes, update the closest guide in the same change.