# Testing Patterns

**Analysis Date:** 2026-06-09

## Repository Context

This is a **content-only agent extension** with no `src/` TypeScript sources and no dedicated test files detected in the repository. The sole JavaScript file is `extension-kind-gate.mjs`, which exports pure validator functions that are testable in isolation. The CI pipeline (`ci.yml`) runs `pnpm test --if-present`, meaning tests are optional — and none are currently present.

## Test Framework

**Runner:**
- Not configured. No `jest.config.*`, `vitest.config.*`, or test runner dependency in `package.json`.
- `tsconfig.json` includes `"src/**/*.ts"` in its `include` but no `src/` directory exists.

**Assertion Library:**
- Not applicable.

**Run Commands:**
```bash
# CI runs this (exits 0 if no test script is defined):
pnpm test --if-present

# No local test commands are currently available.
```

## Test File Organization

**Location:**
- No test files exist.
- The CI `ci.yml` gate would run tests if a `test` script were defined in `package.json`.

**Naming:**
- No convention established (no tests exist).

## Gate Script Testability

The `extension-kind-gate.mjs` exports pure functions that are straightforward to unit test without mocking:

- `parseArgs(argv: string[]) → { packageRoot: string }` — parses CLI args; pure, no I/O.
- `validateAgent(packageRoot: string) → string[]` — reads `cinatra/oas.json` from disk; requires fixture files.
- `validateWorkflowPackageShape(pkg: object) → string[]` — pure, no I/O; easiest to test.
- `validateBpmnSanity(xml: string) → string[]` — pure, no I/O; tests XML string inputs.
- `findWorkflowSidecars(packageRoot: string) → string[]` — walks filesystem; requires fixture dirs.
- `validateWorkflow(packageRoot: string) → string[]` — reads disk; requires fixture files.
- `runGate(packageRoot: string) → { kind, errors }` — dispatches to above; requires fixture files.

## Mocking

**Framework:** Not applicable (no tests exist).

**What to Mock (if tests were added):**
- `node:fs` functions (`readFileSync`, `existsSync`, `readdirSync`) — needed for filesystem-touching validators (`validateAgent`, `validateWorkflow`, `findWorkflowSidecars`).
- Pure functions (`validateWorkflowPackageShape`, `validateBpmnSanity`, `parseArgs`) require no mocking.

## Fixtures and Factories

**Test Data:**
- No fixtures exist. If tests were added, fixture files would be needed:
  - Valid and invalid `cinatra/oas.json` samples for `validateAgent`.
  - Valid and invalid `cinatra/workflow.bpmn` strings for `validateBpmnSanity`.
  - `package.json` objects for `validateWorkflowPackageShape`.

**Location:**
- No established fixture location. A `test/fixtures/` directory would be the natural choice.

## Coverage

**Requirements:** None enforced — no coverage tooling configured.

**View Coverage:**
- Not applicable.

## Test Types

**Unit Tests:**
- Not present. The pure functions in `extension-kind-gate.mjs` are the primary candidates.

**Integration Tests:**
- Not present. The CI pipeline itself acts as an integration gate: `node extension-kind-gate.mjs --package-root .` runs against the real `cinatra/oas.json` on every push/PR (`ci.yml` `kind-gates` job).

**E2E Tests:**
- Not applicable.

## CI Gate as Functional Verification

The closest thing to automated testing is the CI pipeline. Two jobs run on every push/PR to `main`:

**`build` job (`ci.yml`):**
1. Classifies repo as "source mirror" (has `@cinatra-ai/*` peers) or "standalone."
2. For standalone repos: installs deps, typechecks, runs `pnpm test --if-present`, and does `npm pack --dry-run`.
3. This repo is a **source mirror** (has host-internal `@cinatra-ai/*` peers) so install/typecheck/test are skipped in standalone CI; the monorepo runs those.

**`kind-gates` job (`ci.yml`):**
1. Runs `node extension-kind-gate.mjs --package-root .` directly.
2. This validates `cinatra/oas.json` for banned/retired CRM primitives.
3. Exit code 0 = pass, exit code 1 = violations found.

This is the only automated correctness check currently active for this repo.

## Common Patterns

**Async Testing:**
- Not applicable — all validator functions are synchronous.

**Error Testing:**
- Pure validators return `string[]`; error cases return a non-empty array. Test assertions would check `errors.length > 0` and specific error message substrings.

---

*Testing analysis: 2026-06-09*
