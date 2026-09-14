# Contributing

Chiltepin is a pnpm monorepo: `chiltepin-core` (parse, schemas, diagnostics), `chiltepin-render` (deterministic HTML/SVG), `chiltepin` (the `chiltepin` CLI), `chiltepin-studio`, and the agent skill in `skills/chiltepin`.

```bash
pnpm install
pnpm typecheck && pnpm test && pnpm lint && pnpm build
node packages/cli/dist/bin.js check          # the repo's own docs must pass
```

## Adding or changing a block

A block type exists only when it has all five: a schema in `packages/core/src/blocks/schemas.ts`, a renderer in `packages/render/src/blocks/`, a skill entry in `skills/chiltepin/reference/blocks/<family>.md`, a catalog example in `packages/core/src/blocks/catalog.ts` (this is what `chiltepin block <type>` prints and must validate), and a test. Add a generation-eval scenario in `evals/generate/cases.yaml` too, so we can prove an agent picks it from a plain request.

Rules that are checked, not just written down: no literal colours in renderers (tokens only), the family files stay short selection sheets, `docs/reference/showcase.md` and `packages/cli/templates/demo.md` stay byte-identical, and the block count in prose matches the registry.

## The one invariant

Geometry is code, never prompt. If a fix tempts you to teach the model coordinates or layout rules, the fix belongs in `chiltepin-render`, not in the skill.

## Pull requests

Conventional commits (`feat(render): …`, `fix(core): …`). Add a changeset (`pnpm changeset`) for anything a user can see; pushes to `main` with changesets publish to npm. Keep PRs to one concern. A rendered example of anything visual you touched helps the review.

## Reporting

Bugs and block requests go in [issues](https://github.com/jdiejim/chiltepin/issues); questions and show-and-tell in [discussions](https://github.com/jdiejim/chiltepin/discussions).
