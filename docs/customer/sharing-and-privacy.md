# Sharing and Privacy Guide

This guide explains how public album access works from a customer or studio operations perspective.

## Public Surfaces

SaathiDesk has three public-facing surfaces:

- The main marketing and documentation pages on the root domain.
- Customer subdomains such as `customer.saathidesk.com`.
- Tokenized share pages such as `/share/{token}` or album URLs with `?share={token}`.

Public does not always mean indexable. Customer subdomains and sensitive app routes are marked with `X-Robots-Tag: noindex, nofollow`.

## Share Link Controls

Share links can control:

- Whether downloads are available.
- Whether watermarks are enabled.
- Which watermark text and positions are used.
- Whether only one person, a group of people, or the full album is visible.
- Whether event tabs are visible.
- Whether a passcode is required.
- Optional expiration.

## Recommended Sharing Patterns

| Scenario | Recommended link |
| --- | --- |
| Final client delivery | Full album share with downloads enabled if the contract allows it. |
| Preview proofing | Full album share with watermarks and downloads disabled. |
| Guest find-yourself | Person-specific or subset share with event tabs enabled. |
| Sensitive family album | Passcode-protected share with limited forwarding. |
| Social teaser | Curated album or event only; avoid private full-gallery links. |

## What Passcodes Do

A passcode blocks access until the viewer enters the correct value. After verification, SaathiDesk stores short-lived share access in a cookie. If a viewer changes browser, clears cookies, or opens a different device, they may need to enter the passcode again.

## What Watermarks Do

Watermarks protect previews and proofing galleries. They are not a substitute for access control. If an image can be viewed in a browser, the viewer can still capture the screen. Use passcodes and restricted links for privacy; use watermarks for proofing and branding.

## Search Engine Notes

SaathiDesk sends noindex headers on private surfaces, but search engines are external systems. Treat noindex as an indexing preference, not a security boundary. The real security boundary is authentication, share token validation, passcodes, and download permissions.
