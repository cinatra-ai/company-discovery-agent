# Coding Conventions

**Analysis Date:** 2026-06-09

## Repository Type

This is a **content-only agent extension** — it ships no `src/` TypeScript sources. The primary artifact is a system-prompt specification in `skills/company-discovery-agent/SKILL.md`, an OAS manifest in `cinatra/oas.json`, and a single CI gate script (`extension-kind-gate.mjs`). Coding conventions are therefore split between:
1. **Agent specification conventions** — how the SKILL.md prompt is written.
2. **Gate script conventions** — the single JavaScript file (`extension-kind-gate.mjs`) that ships with the repo.

## Naming Patterns

**Files:**
- Agent skill directory: `skills/<agent-name>/SKILL.md` — kebab-case directory, uppercase SKILL.md
- CI gate: `extension-kind-gate.mjs` — kebab-case, `.mjs` extension (ESM)
- OAS manifest: `cinatra/oas.json` — fixed path, lowercase

**Functions (in `extension-kind-gate.mjs`):**
- PascalCase for exported validator functions: `validateAgent`, `validateWorkflow`, `validateWorkflowPackageShape`, `validateBpmnSanity`, `findWorkflowSidecars`, `runGate`
- camelCase for private helpers: `walkLlmStrings`, `scanOasString`, `wordBoundary`, `prefixOf`, `localOf`, `parseArgs`, `main`

**Variables:**
- camelCase throughout: `packageRoot`, `bpmnPrefixes`, `openTags`, `allSidecars`
- SCREAMING_SNAKE_CASE for module-level constants: `LLM_VISIBLE_FIELDS`, `BANNED_PRIMITIVES`, `BANNED_TYPEHINTS`, `PRIMITIVE_PATTERNS`, `OBJECTS_LIST_CRM_RE`, `BPMN_MODEL_NS`, `WORKFLOW_PACKAGE_NAME_RE`

**Types:**
- No TypeScript types in the gate script (plain `.mjs`) — JSDoc comments provide inline documentation.

## Code Style

**Formatting:**
- No `.prettierrc` or `eslint.config.*` detected — formatting is not enforced by a tool in this extracted repo.
- Indent: 2 spaces (observed throughout `extension-kind-gate.mjs`).
- Trailing commas in arrays/objects: yes (observed).
- Semicolons: yes.
- Double quotes for strings.

**Linting:**
- No ESLint config present — linting is not enforced in the standalone extracted repo (the monorepo owns lint).

## Import Organization

**In `extension-kind-gate.mjs`:**
- Only Node built-in imports, grouped together at the top:
  ```js
  import { readFileSync, existsSync, readdirSync } from "node:fs";
  import { resolve, join, basename, dirname, relative } from "node:path";
  ```
- `node:` protocol prefix used consistently for all built-ins.
- No third-party imports — the gate is explicitly self-contained and zero-dependency.

**Path Aliases:**
- Not applicable (no `src/` TypeScript, no tsconfig path aliases in use at runtime).

## Module Design

**Exports:**
- All validator and utility functions are named exports from `extension-kind-gate.mjs`:
  `parseArgs`, `validateAgent`, `validateWorkflowPackageShape`, `validateBpmnSanity`, `findWorkflowSidecars`, `validateWorkflow`, `runGate`
- `main()` is NOT exported — it is invoked conditionally only when the file is run directly:
  ```js
  const invokedDirectly =
    process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
  if (invokedDirectly) { ... }
  ```

**Barrel Files:**
- Not applicable.

## Error Handling

**In `extension-kind-gate.mjs`:**
- All validators are **pure functions** returning `string[]` (error messages). They do not throw.
- File-read errors are caught with try/catch and pushed as error strings into the errors array.
- `main()` wraps `runGate` in a try/catch that catches unexpected errors and calls `process.exit(1)`.
- Pattern: early-return on fatal precondition failures (e.g., missing `oas.json` returns `[]`, missing `workflow.bpmn` returns early with an error).

**In `SKILL.md` agent specification:**
- Step 1 is the only abort path — returns `{"error":"at_least_one_of_companyName_or_domain_required"}` immediately.
- Steps 2–6 always execute; Step 4 (Apollo) is explicitly best-effort: connector errors must not abort the run.
- Rule: **never throw** — always return either the success JSON envelope or the Step 1 error JSON.

## Logging

**In `extension-kind-gate.mjs`:**
- `console.log` for success messages (stdout).
- `console.error` for violation lists (stderr).
- Unicode checkmarks in output: `✓` for pass, `✗` for fail.

**In agent specification (`SKILL.md`):**
- Apollo branch errors are logged as "run notes" — not surfaced in the return value.

## Comments

**When to Comment:**
- Block comments at the top of each logical section in `extension-kind-gate.mjs` (dashed separator lines with section title).
- Inline `//` comments explain non-obvious behaviour (e.g., why `npx` is used instead of `pnpm dlx` in CI).
- `package.json` uses a `"//"` key for a machine-readable comment (non-standard but common pattern).

**JSDoc/TSDoc:**
- JSDoc-style `/** ... */` block comments on exported functions in `extension-kind-gate.mjs`.
- No TypeScript types; documentation is prose-only.

## Function Design

**Size:** Functions are kept focused. The largest is `validateBpmnSanity` (~80 lines) — it handles a single concern (XML sanity + BPMN shape check) and is well-commented.

**Parameters:** Functions accept simple primitives (`string`, `string[]`). No options objects.

**Return Values:**
- Validators return `string[]` (empty = pass, non-empty = violations).
- `runGate` returns `{ kind: string | undefined, errors: string[] }`.
- `parseArgs` returns `{ packageRoot: string }`.

## Agent Specification Conventions (`SKILL.md`)

**Structure:**
- Front-matter block (`---`) with `name` and `description` fields.
- Sections: Inputs, Tool discipline, Step-by-step recipe (numbered), Error handling.
- Steps are numbered 1–6 and use `###` headings.

**Precision rules enforced in the spec:**
- Exact tool call signatures shown as code blocks.
- Branching documented as "Branch A / Branch B" with explicit conditions.
- Output contract: return EXACTLY the JSON, no Markdown wrapping, no prose.
- Forbidden actions explicitly listed ("Do not call any other MCP primitive").

## Package Manifest Conventions

`package.json` uses the `cinatra` key for extension metadata:
```json
{
  "cinatra": {
    "apiVersion": "cinatra.ai/v1",
    "kind": "agent",
    "dependencies": []
  }
}
```
- `kind` must be `"agent"` or `"workflow"`.
- `dependencies` lists Cinatra extension dependencies (empty array when none).
- First-party `@cinatra-ai/*` packages must appear only as optional `peerDependencies` — never in `dependencies` or `devDependencies`.

---

*Convention analysis: 2026-06-09*
