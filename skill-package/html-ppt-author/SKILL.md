---
name: html-ppt-author
description: Create, revise, migrate, or validate offline editable HTML slide decks using one shared editor core with Lite browser-editing and Full local-studio profiles. Use when an Agent must produce or retrofit a compatible HTML presentation, preserve editable text/images/animation order, add a reusable editing toolbar, or diagnose navigation, saving, PDF, and PPTX export issues.
---

# HTML PPT Author

Create the presentation as a content-first HTML deck while keeping the editor runtime separate from course-specific content.

This installed Skill is a portable distribution generated from the canonical `html-ppt-toolkit` source. Do not create a separate editor implementation inside the Skill; profile differences must remain configuration of the shared runtime.

For user-facing setup, collaboration order, and invocation examples, see `README.md`.

## Required workflow

1. Read `references/contract.md` before creating or migrating a deck. Read `references/profiles.md` when selecting or changing editor capabilities.
2. Inspect the target deck and its project instructions before changing it.
3. Preserve content hierarchy, visual system, page order, assets, and navigation unless the user explicitly changes them.
4. Give every slide a stable unique id and implement the required runtime hooks.
5. Mark only intended content as editable, draggable, replaceable, animated, or protected.
6. Select the smallest sufficient profile: use `lite` by default; use `full` only when the user requests write-back, PDF, or PPTX export.
7. When the target does not already load the shared SDK, run `scripts/install-editor.mjs <input> [output] --profile lite|full [--strip-legacy]`.
8. Run `scripts/check-deck.mjs <file> --profile lite|full` after implementation.
9. Test Full-only capabilities in the local studio. Do not imply that direct `file://` opening can write files or generate Office documents.

## Integration rules

- Prefer linking the shared editor SDK shipped in `assets/editor/`. Do not paste a bespoke toolbar into every deck.
- Keep one editor codebase. Lite and Full are feature configurations, not separate forks; do not copy the runtime into a new “simplified editor” implementation.
- Lite includes in-browser text/image/layout/animation editing, undo/redo, browser draft, and editable HTML export, but does not include the `页面整理` toolbar group. Full adds page tools, source write-back, and PDF/PPTX controls backed by the local studio.
- Keep toolbar nodes outside the slide canvas.
- Preserve normal layout until the user drags or resizes an element; do not make everything absolute by default.
- Protect page numbers, navigation, backup markers, editor controls, and structural metadata.
- Do not promise that HTML animations become PowerPoint animations. PDF is static; PPTX conversion prioritizes editable text and basic shapes. For iframe-template decks, expose separate editable and visual PPTX modes and label them honestly.
- Third-party outer branding may only be hidden through a reversible local focus mode or explicit user selection. Do not delete scripts or attribution metadata by default.
- If a deck cannot meet the contract without changing its layout model, explain the exact incompatibility before a broad rewrite.

## Deliverables

Return the compatible HTML, editor assets or injection route, compatibility check result, and relevant export limitations.
