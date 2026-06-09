# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
company-discovery-agent/
├── cinatra/                  # Cinatra platform artifacts
│   └── oas.json              # OAS Flow definition (the agent's I/O contract + routing)
├── skills/                   # Agent skill definitions
│   └── company-discovery-agent/
│       └── SKILL.md          # System prompt: full 6-step business logic recipe
├── .github/
│   └── workflows/
│       ├── ci.yml            # Main CI pipeline (build, typecheck, test, gate)
│       └── release.yml       # Release pipeline
├── extension-kind-gate.mjs   # Zero-dependency CI gate (agent OAS + workflow BPMN validation)
├── package.json              # npm manifest: @cinatra-ai/company-discovery-agent, kind: agent
├── tsconfig.json             # TypeScript config template (no src/ exists currently)
├── .npmrc                    # npm registry config (existence only — not read)
├── LICENSE                   # Apache-2.0
└── README.md                 # Package documentation
```

## Directory Purposes

**`cinatra/`:**
- Purpose: Cinatra platform artifact directory. Contains the OAS flow definition consumed by the Cinatra orchestrator.
- Contains: `oas.json` — the complete agent flow (StartNode, ApiNode, EndNode, edges, I/O schema, LLM preferences).
- Key files: `cinatra/oas.json`

**`skills/company-discovery-agent/`:**
- Purpose: Agent skill directory. The LLM bridge auto-discovers `SKILL.md` using `agent_id: company-discovery-agent`.
- Contains: `SKILL.md` — the authoritative system prompt encoding all business logic (6-step recipe, tool discipline, error handling, output schema).
- Key files: `skills/company-discovery-agent/SKILL.md`

**`.github/workflows/`:**
- Purpose: GitHub Actions CI/CD configuration.
- Contains: `ci.yml` (build + kind gate), `release.yml` (publishing).
- Key files: `.github/workflows/ci.yml`

## Key File Locations

**Entry Points:**
- `cinatra/oas.json`: The flow entry point. StartNode accepts `companyName`, `domain`, `apolloLookup`, `cinatra_run_id`.

**Business Logic:**
- `skills/company-discovery-agent/SKILL.md`: All agent logic — domain normalization, CRM dedup, Apollo enrichment, CRM write branching, output format.

**CI Gate:**
- `extension-kind-gate.mjs`: Self-contained gate script. Run via `node extension-kind-gate.mjs --package-root .`. Exports `validateAgent`, `validateWorkflow`, `runGate`, `parseArgs`, `validateBpmnSanity`, `findWorkflowSidecars`.

**Package Manifest:**
- `package.json`: Declares `name: @cinatra-ai/company-discovery-agent`, `cinatra.kind: agent`, `cinatra.apiVersion: cinatra.ai/v1`.

**TypeScript Config:**
- `tsconfig.json`: Targets `src/**/*.ts` with `rootDir: src`, `outDir: dist`. No `src/` exists in this repo currently; config is a template for if source is added.

## Naming Conventions

**Files:**
- Cinatra artifact: `cinatra/oas.json` (always this exact name for agent flows).
- Skill files: `skills/<agent-id>/SKILL.md` (uppercase SKILL.md, directory named after `agent_id`).
- Gate script: `extension-kind-gate.mjs` (kebab-case `.mjs` ES module).
- CI workflows: `ci.yml`, `release.yml` (lowercase kebab-case YAML).

**Directories:**
- Skill directory matches `agent_id` exactly: `skills/company-discovery-agent/` matches `agent_id: company-discovery-agent` in the OAS.

**Package:**
- npm scoped name pattern: `@cinatra-ai/<slug>` where slug is `company-discovery-agent`.
- Agent packages do NOT use the `-workflow` suffix (that is reserved for workflow kind).

## Where to Add New Code

**Update business logic (step changes, new MCP tools, output fields):**
- Edit: `skills/company-discovery-agent/SKILL.md`
- Also update I/O schema if adding/removing inputs or outputs: `cinatra/oas.json` (inputs/outputs arrays on flow, StartNode, ApiNode, EndNode, and DataFlowEdges)

**Change LLM model or provider:**
- Edit: `cinatra/oas.json` → `metadata.cinatra.llm.preferredProvider` and `metadata.cinatra.llm.preferredModel`, and the matching `cinatra_llm` block inside the `discover` ApiNode `data`.

**Add TypeScript source (if runtime code is introduced):**
- Create: `src/` directory at repo root.
- `tsconfig.json` already targets `src/**/*.ts` and `outDir: dist`.

**Add tests:**
- Create: `src/*.test.ts` or a `tests/` directory. No test runner is currently configured; add a `test` script to `package.json` and install a runner (vitest or jest).

**Add a new CI gate check:**
- Edit: `extension-kind-gate.mjs` (add export function, call from `runGate`).
- Add corresponding step in `.github/workflows/ci.yml` `kind-gates` job.

**Update banned primitives list:**
- Edit: `extension-kind-gate.mjs` → `BANNED_PRIMITIVES` array (line 65) and `BANNED_TYPEHINTS` array (line 73). Keep in sync with the monorepo's `scripts/audit/oas-banned-primitives-gate.mjs`.

## Special Directories

**`cinatra/`:**
- Purpose: Cinatra platform artifacts consumed at agent publish/install time.
- Generated: No (hand-authored OAS JSON).
- Committed: Yes.

**`skills/`:**
- Purpose: Agent skill prompts auto-discovered by the LLM bridge via `agent_id`.
- Generated: No (hand-authored Markdown).
- Committed: Yes.

**`.planning/`:**
- Purpose: GSD planning and codebase analysis documents.
- Generated: Yes (by GSD tooling).
- Committed: Up to team convention.

---

*Structure analysis: 2026-06-09*
