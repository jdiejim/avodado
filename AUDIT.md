# Chiltepin audit — 2026-09-13

Chiltepin has a strong base: a typed block registry, separate parser and renderer packages, a working CLI, and extensive tests. The immediate opportunity is to make the first successful use easier and keep every public entry point consistent. Adding more block types is a lower priority than proving a few useful workflows.

This review covers the tracked repository, the authoring skill, package scripts, release workflows, example output, and public GitHub metadata. It is not a security certification or a complete dead-code analysis. Changes below are local; the audit did not publish packages, push commits, or change repository settings.

## Findings and changes

| Priority | Evidence and consequence | Action |
| --- | --- | --- |
| High | [Release workflow](./.github/workflows/release.yml) published on `main` independently of CI. A failing revision could reach npm. | Added build, lint, typecheck, tests, docs validation, package lint, and type checks before the publish step. |
| High | [Cursor](./.cursor/rules/chiltepin.mdc) and [Windsurf](./.windsurfrules) referenced the deleted `.chiltepin/skill/SKILL.md`; Cursor restricted authors to nine types. | Replaced duplicated grammar with short adapters pointing to the canonical skill and CLI. |
| High | The original README linked its competitor comparison to ignored `.scratch/` artifacts. Visitors could not inspect the evidence. | Removed the comparison. Moved internal eval results below the product workflow and disclosed their limits. |
| Medium | [Skill](./skills/chiltepin/SKILL.md) activated for essentially any documentation task when installed, demanded several blocks, stopped after two repair rounds, and required a rejected-alternative explanation in every handoff. | Narrowed activation to Chiltepin work, preserved single-diagram scope, preferred the installed CLI, and tied retries to progress. Handoffs report actual results. |
| Medium | [npm README sync](./packages/cli/scripts/sync-readme.mjs) missed HTML links and treated extensionless `LICENSE` as a directory. Markdown images also needed raw asset URLs. | Fixed link handling. The script now verifies local link targets exist. A concurrent commit wired the existing script into CLI builds during this audit; that change was preserved. |
| Medium | The README's main image cropped its heading and did not link to a checked-in source. The quick start used a placeholder file. | Added four real screenshots with source links, a reproducible capture script, and commands using generated starter docs. |
| Medium | The README said unlabeled arrows and repeated callouts failed the command; these are warnings. `verify` did not check the repo's own docs. | Corrected the claim and added `chiltepin check` to `pnpm verify`. |
| Low | Architecture and agent guidance contained old package names, block counts, commands, and theme behavior. Eval introductions listed outdated case counts. | Corrected the inspected references. |

## Visibility: improve the path from discovery to use

The public GitHub snapshot had 0 stars, 0 forks, a homepage, and 15 relevant topics. The topics include `docs-as-code`, `architecture-diagrams`, `claude-code`, `mcp`, and `markdown`. A concurrent commit removed MCP; remove that topic when updating repository metadata. Adding more keywords is unlikely to be the main improvement. GitHub uses topics to help people browse and search for related projects; this does not promise a ranking or star increase. [GitHub topic guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics).

1. **Synchronize the website before a launch.** At review time, [chiltepin.dev](https://chiltepin.dev/) displayed 87 types, v0.42.0, `chiltepin install claude`, and PowerPoint output. The local CLI has 107 types and rejects the removed `install` and `pptx` commands. The website lives in a separate repository. Update its installation path, examples, and feature claims against the published CLI.
2. **Use one clear description everywhere.** Suggested GitHub About text: “Turn Markdown + typed YAML into architecture diagrams, API docs, runbooks, and slides. An agent skill writes the content; chiltepin check validates it.” This explains the product without calling all 107 blocks diagrams.
3. **Configure the social preview.** The existing [social-preview.png](./assets/social-preview.png) is a candidate. Inspect its legibility and claims before selecting it in repository settings. Committing the image alone does not configure the preview. GitHub recommends 1280 × 640 pixels. [GitHub preview instructions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview).
4. **Lead with three repeatable use cases.** Demonstrate “explain this service,” “document an API failure path,” and “turn a rollout plan into a reviewable doc.” Each example should show the request, source, rendered output, and validation command. Link each demo back to the repository.
5. **Make the first contribution small.** Prepare issues for a focused renderer defect, a missing example, and a reproducible bug. Include the input file, expected behavior, and the test command. Use `good first issue` only when the scope and instructions are suitable for a newcomer.
6. **Distribute useful demonstrations.** Prepare a short recording of a real request through validation and rendering, plus a compact screenshot for each use case. Share them in relevant communities under their rules. Ask for feedback and real examples; use one unobtrusive star invitation. No outreach was sent during this audit.
7. **Measure weekly.** Record unique visitors, clones, demo visits, npm downloads, and new stars where the corresponding analytics are available. Compare the same time window before and after each change. Treat these as separate signals; downloads can include automation, and aggregate ratios do not prove individual conversion.

Suggested order: fix the website, review the README, configure the preview, publish one real demonstration, then improve the steps where new users get stuck. There is no basis for a specific star-growth forecast.

## What is redundant, and what can go

| Area | Recommendation | Reason |
| --- | --- | --- |
| `.cursor/rules/chiltepin.mdc` and `.windsurfrules` | Keep the small adapters; remove their copied grammar. Done. | Each tool needs its entry point, but block rules need one maintained source. |
| Root README and `packages/cli/README.md` | Keep both delivery files; edit only the root. | GitHub and npm read different files. Build-time generation removes manual maintenance. |
| `docs/reference/showcase.md` and `packages/cli/templates/demo.md` | Generate the packaged template from the docs source in a follow-up. | They are byte-identical and tests enforce parity; `chiltepin demo` needs a packaged copy. Deleting the template without updating the build would break it. |
| Skill reference lists in CLI `init.ts` and MCP `embed-skill.mjs` | No further consolidation needed after the concurrent MCP removal. | The baseline duplicated this ordered list. Commit `e70ec5b` removed the MCP consumer during the audit; preserve that simplification. |
| Package LICENSE copies | Keep. | Each published package needs its license; identical contents are intentional. |
| Twelve legacy block aliases | Keep. | They are documented compatibility contracts with tests. Removing them breaks existing documents for little simplification. |
| `dist/`, package build output, generated skill files, `*.tsbuildinfo` | Regenerate when needed; do not commit them. | These are ignored build artifacts. Keep output needed by a current local session until it ends. |
| `.scratch/` and `graphify-out/` | Review and archive useful evidence before any deletion. | They are ignored local output, not published package bloat. Scratch contains the raw eval evidence referenced by historical results. |
| `assets/hero.png` | Optional cleanup after checking external consumers. | The new README replaces it. Its old crop is poor, but external pages may still use its raw URL. |
| `assets/flow.mp4` and `assets/social-preview.png` | Keep as launch assets if used. | Not every useful asset must appear inline in the README. |
| `resources/*.md` | Inspect callers before pruning. | For example, PDF tests use `resources/chiltepin-roadmap.md`; these are not all abandoned files. |

This audit did not perform broad deletions. The concurrent MCP removal was preserved, and public instructions were updated to match it. This avoids discarding unpublished evidence or breaking packaged assets and external links.

## Refactors worth doing next

1. **Reduce duplicate inventories first.** Generate the demo template from its canonical source and preserve its existing parity test. The concurrent MCP removal already eliminated the duplicate skill file list. Add a build check for generated public docs so the website does not keep a separate block count.
2. **Split schemas by block family.** [schemas.ts](./packages/core/src/blocks/schemas.ts) has 3,623 lines. Keep the public barrel, `BlockDataMap`, and exhaustive registry stable. Move one family at a time; retain shared primitives and schema identity tests. Size alone does not prove a defect, but it increases the surface of unrelated edits.
3. **Separate normalization dispatch from grammars.** [normalize.ts](./packages/core/src/blocks/normalize.ts) has 1,426 lines. Move family grammars into small modules while preserving canonicalization order, alias precedence, and terse-input parity. Do not add a second registry of block names.
4. **Extract pure helpers at the CLI boundary.** [studio.ts](./packages/cli/src/commands/studio.ts) has 612 lines; [site.ts](./packages/cli/src/commands/site.ts) has 664. Separate routing, file concurrency, export handling, and page composition when changing those areas. Preserve traversal checks, stale-write conflicts, SSE behavior, and integration tests.
5. **Evaluate skill behavior outside the training examples.** Include a one-diagram request, a plain Markdown edit, a project pinned to an older CLI, missing tooling, and a recoverable validation error. Measure scope preservation, schema lookup, truthful validation, tokens, and reader usefulness. Existing structural tests do not demonstrate agent behavior.
6. **Publish reproducible eval records before comparative claims.** Record model and version, prompts, skill commit, package versions, per-case results, raw first/final docs, token accounting, timing, and rerun policy. Separate original results from rescoring after parser fixes. Use repeated runs and keep a holdout set.

The core/render/CLI/Studio package split follows real execution boundaries. Merging those packages is not an obvious simplification. The larger opportunity is to remove duplicated metadata while preserving the typed interfaces and compatibility tests.

## Validation

- Baseline build, lint, and typecheck passed. All 2,494 tests across 164 files passed with browser and localhost permissions.
- The sandbox initially blocked PDF, server, and file-watcher tests. These passed on the permitted rerun; they were not treated as product defects.
- Final `pnpm verify` passed after the concurrent MCP removal: build, lint, typecheck, 2,489 tests across 163 files, and documentation validation. The doc check reported zero errors and four informational alias warnings.
- Published type checks passed for core and render under the repository's ESM-only profile. The README starter flow passed in a temporary project: init, check, and standalone HTML export.
- The skill frontmatter validator passed. A behavioral agent eval was not run.
- The four gallery blocks passed schema validation and were rendered and visually inspected. The screenshot script expands wide output and refuses a cropped scrollable diagram.
- Package lint passed, with an existing suggestion about the CLI's `main` field. Changing that export contract requires a separate compatibility review.
- Release workflow steps were reviewed locally. No GitHub Actions release or npm publish was run.
