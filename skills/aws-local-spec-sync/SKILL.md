---
name: aws-local-spec-sync
description: Use when adding, removing, or changing user-facing GUI behavior, navigation, AWS service console capabilities, destructive actions, browser AWS boundaries, debug-api behavior surfaced in the GUI, or docs/specifications content in the aws-local-sandbox repository. This skill keeps implementation and GUI specifications synchronized.
---

# AWS Local Spec Sync

## Purpose

Use this skill to keep GUI behavior and `docs/specifications/` aligned. The specification is user-facing: it should describe what the local management console does, not every implementation detail.

## When To Update Specs

Update specs in the same change when GUI work affects any of these:

- Navigation items, routes, app shell behavior, or not-found behavior
- Dashboard inventory or displayed connection metadata
- Service console capabilities
- Create, update, delete, import, invoke, send, receive, scan, search, or preview behavior
- Confirmation dialogs or other destructive-action safeguards
- Error, loading, empty, disabled, or duplicate-name states that matter to users
- Browser AWS, Amplify, Floci, or `debug-api` boundaries visible through GUI behavior
- Required environment variables or local endpoint assumptions

Do not update specs for purely internal refactors that leave user-facing behavior unchanged, unless the refactor changes an important implementation boundary documented in the spec.

## Spec Locations

- Shared GUI overview: `docs/specifications/gui.md`
- Detailed service specs: `docs/specifications/gui/`
- Add or update a service-specific spec when a console grows beyond a short overview section.
- Keep the overview focused on navigation, runtime, shared rules, and short service summaries.

## Spec Writing Rules

- Write in present tense.
- Describe user-visible behavior and local-only constraints.
- Mention destructive actions and their confirmation behavior.
- Mention implementation boundaries only when they are architectural contracts, such as:
  - Vue components do not call AWS SDK clients directly.
  - AWS/Floci access goes through `gui/src/aws/`.
  - host or Docker diagnostics go through a backend such as `debug-api`.
- Avoid implementation changelog language such as "now supports" unless the document is explicitly a changelog.
- Keep resource names generic unless the GUI depends on a documented default.

## Workflow

1. Read the relevant GUI implementation and current spec section.
2. Identify the exact user-facing behavior added, removed, or changed.
3. Update the overview or service-specific spec in the same change.
4. Check that the spec and implementation agree on:
   - Routes and navigation labels
   - Supported actions
   - Destructive confirmation behavior
   - Local endpoint and credential assumptions
   - Service module or debug boundary, when documented
5. Validate GUI code with `cd gui && npm run build` when implementation changed.

## Common Decisions

- If the change affects one service console only, update that service section or file.
- If the change affects app-wide structure, update `docs/specifications/gui.md`.
- If a service section becomes long, create or extend a file under `docs/specifications/gui/` and link it from the overview.
- If behavior is removed, remove or rewrite the stale spec text in the same change.

## Finish Criteria

Before finishing:

- No implemented GUI behavior is missing from the spec.
- No spec promises behavior that the GUI no longer implements.
- Destructive and local-only behavior is documented where relevant.
- The final response mentions both implementation validation and spec synchronization.
