# HTML PPT Toolkit agent guide

## Project

This repository provides one shared editor core for editable offline HTML slide decks, plus a Windows launcher, a local export studio, migration/check scripts, and the generated `html-ppt-author` Skill package.

## Runtime

- Node.js 22+ runs the installer, validator, Skill builder, and local studio.
- `HTML-PPT-Toolkit.exe` and the CMD/PowerShell wrappers are Windows launchers.
- The Full portable Release includes Node.js, the compatible DashiAI PPT export engine, its dependencies and a Chromium headless browser; keep these binaries in Release assets, not Git history. Source checkouts require those dependencies to be configured separately.

## Source of truth

- Edit the runtime only in `editor/`.
- Edit Skill instructions only in `skill/`.
- Treat `skill-package/html-ppt-author/` and the installed Codex Skill as generated outputs.
- Rebuild and synchronize with `node scripts/build-skill.mjs --install`.

## Verification

Run the compatibility checker and relevant smoke/regression scripts in `scripts/`. Rebuild the Skill after changing the editor, installer, checker, or canonical Skill documentation, then confirm generated file hashes match.

## Boundaries

Do not add course-specific content, private paths, credentials, generated exports, local backups, or QA residue. Preserve the distinction between Lite browser editing and Full local-studio export capabilities.
