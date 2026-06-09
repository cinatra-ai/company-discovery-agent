<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      Caller / Orchestrator                   │
│  (e.g. @cinatra-ai/contact-discovery-agent or direct call)  │
└────────────────────────┬────────────────────────────────────┘
                         │  inputs: companyName, domain, apolloLookup
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Cinatra Flow: company-discovery-agent-flow         │
│           `cinatra/oas.json`                                 │
│                                                              │
│  StartNode (Inputs)                                          │
│       ↓ (ControlFlowEdge: start_to_discover)                 │
│  ApiNode "Discover company"                                  │
│       POST {{CINATRA_BASE_URL}}/api/llm-bridge               │
│       agent_id: company-discovery-agent                      │
│       system prompt → SKILL.md step-by-step recipe          │
│       ↓ (ControlFlowEdge: discover_to_end)                   │
│  EndNode                                                     │
└────────────────────────┬────────────────────────────────────┘
                         │  outputs: accountId, wasMerged, apolloOrganizationId
                         ▼
┌─────────────────────────────────────────────────────────────┐
│   Cinatra LLM Bridge  →  LLM (gpt-5.5, OpenAI preferred)    │
│                                                              │
│   Auto-injected MCP tools (Cinatra self-MCP):               │
│     crm_account_search  crm_account_create                  │
│     crm_account_update  apollo_validate                      │
│     apollo_administration_get                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Provider-agnostic CRM Facade  (Twenty today; HubSpot/       │
│  Salesforce later) + Apollo connector                        │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| OAS Flow definition | Declares the three-node flow (Start→ApiNode→End), I/O schema, LLM preferences | `cinatra/oas.json` |
| SKILL.md system prompt | Stateless 6-step recipe the LLM executes verbatim: validate, normalize, dedup, enrich, persist, return | `skills/company-discovery-agent/SKILL.md` |
| extension-kind-gate | Zero-dependency CI gate: parses `cinatra/oas.json`, scans LLM-visible strings for retired CRM primitives | `extension-kind-gate.mjs` |
| package manifest | Declares Cinatra agent kind, version, npm identity | `package.json` |
| CI pipeline | Validates package shape, typechecks, runs gate, dry-pack | `.github/workflows/ci.yml` |

## Pattern Overview

**Overall:** Stateless LLM agent dispatched via a Cinatra OAS Flow. All business logic lives in the SKILL.md system prompt; the OAS flow is a thin routing shell with a single ApiNode that calls the LLM bridge.

**Key Characteristics:**
- No runtime source code (no `src/`). The agent is purely declarative: an OAS JSON flow + a SKILL.md prompt.
- Single-step LLM bridge pattern: `StartNode → ApiNode(llm-bridge) → EndNode`.
- MCP tools are injected automatically by the Cinatra runtime; the OAS node deliberately omits `toolboxes` to trigger the always-inject path.
- All state is transient per-invocation. No persistent local state.
- Error handling boundary: Step 1 (input validation) is the only abort; Steps 2–6 always run, Apollo enrichment is best-effort.

## Layers

**Flow Layer:**
- Purpose: Declare agent I/O contract, routing, and LLM preferences.
- Location: `cinatra/oas.json`
- Contains: StartNode, ApiNode, EndNode, ControlFlowEdges, DataFlowEdges, I/O schemas.
- Depends on: Cinatra platform runtime.
- Used by: Cinatra orchestrator / calling agents.

**Prompt Layer (SKILL.md):**
- Purpose: Encode the full business logic as an LLM-executable step-by-step recipe.
- Location: `skills/company-discovery-agent/SKILL.md`
- Contains: Input validation, domain normalization, CRM dedup logic, Apollo enrichment, CRM write branching, output schema.
- Depends on: MCP tool primitives injected by the Cinatra self-MCP.
- Used by: LLM bridge (auto-discovers via `agent_id: company-discovery-agent`).

**Gate / CI Layer:**
- Purpose: Pre-publish sanity checks without external dependencies.
- Location: `extension-kind-gate.mjs`, `.github/workflows/ci.yml`
- Contains: OAS banned-primitive scanner, workflow BPMN validator, package shape validator.
- Depends on: Node.js builtins only.
- Used by: GitHub Actions CI on push/PR to `main`.

## Data Flow

### Primary Request Path

1. Caller passes `companyName`, `domain`, `apolloLookup` to the flow StartNode (`cinatra/oas.json` → `$referenced_components.start`).
2. DataFlowEdges route all three inputs plus `cinatra_run_id` to the ApiNode `discover` (`cinatra/oas.json` → `$referenced_components.discover`).
3. ApiNode POSTs to `{{CINATRA_BASE_URL}}/api/llm-bridge` with `agent_id: company-discovery-agent`; the bridge loads `SKILL.md` as the system prompt and injects MCP tools.
4. LLM executes the 6-step recipe (validate → normalize → CRM search → Apollo → CRM write → return JSON).
5. Bridge extracts `accountId`, `wasMerged`, `apolloOrganizationId` from the LLM JSON output.
6. DataFlowEdges route outputs to EndNode; flow returns the three fields to the caller.

### Apollo Enrichment (Conditional)

1. If `apolloLookup === true`, LLM calls `apollo_administration_get({})`.
2. If `connected !== true`, sets `apolloOrganizationId = ""` (best-effort, does not abort).
3. Current connector does not expose per-domain lookup; `apolloOrganizationId` is always `""` until a future primitive is added.

### CRM Dedup Path

1. LLM calls `crm_account_search({ query: companyName || websiteHost })`.
2. Post-filters results by `domainName` (domain path) or lowercased `name` (name-only path).
3. Branch A (no match): `crm_account_create(...)` → new `accountId`, `wasMerged = false`.
4. Branch B (match found): minimal-patch `crm_account_update(...)` or no-op → same `accountId`, `wasMerged = true`.

**State Management:**
- No persistent state. Each invocation is fully stateless; all data comes from CRM reads within the run.

## Key Abstractions

**CRM Facade (`crm_*` primitives):**
- Purpose: Provider-agnostic interface over CRM backends (Twenty today, HubSpot/Salesforce planned).
- Examples: `crm_account_search`, `crm_account_create`, `crm_account_update` — called by the LLM via MCP.
- Pattern: Facade pattern; the agent never references provider-specific APIs.

**`websiteHost` (normalized domain):**
- Purpose: Canonical domain key used for dedup matching against `CrmAccount.domainName`.
- Normalization: strip protocol, `www.`, path, query, trailing slash, lowercase.
- Defined in: `skills/company-discovery-agent/SKILL.md` Step 2.

**OAS Flow (`component_type: Flow`):**
- Purpose: Cinatra's declarative agent shell — routes I/O between nodes.
- Key fields: `agentspec_version: 26.1.0`, `metadata.cinatra.llm` for model preference.
- File: `cinatra/oas.json`.

## Entry Points

**Flow Invocation:**
- Location: `cinatra/oas.json` → `start_node: { $component_ref: "start" }`
- Triggers: Cinatra orchestrator or a parent agent calling this flow by package name `@cinatra-ai/company-discovery-agent`.
- Responsibilities: Accept `companyName`, `domain`, `apolloLookup`, `cinatra_run_id`; return `accountId`, `wasMerged`, `apolloOrganizationId`.

**CI Gate:**
- Location: `extension-kind-gate.mjs` `main()` function (line 365).
- Triggers: `node extension-kind-gate.mjs --package-root .` in GitHub Actions.
- Responsibilities: Parse `cinatra/oas.json`, scan LLM-visible strings for retired primitives, exit 0/1.

## Architectural Constraints

- **No source code:** There is no `src/` directory. The agent is purely declarative (OAS + SKILL.md). TypeScript config (`tsconfig.json`) exists as a template/extract artifact but has no files to compile.
- **MCP tool discipline:** The LLM is constrained to exactly 5 MCP primitives. No `web_search`, no `crm_contact_*`, no legacy `objects_*` / `accounts_*`. Enforced by SKILL.md wording and the banned-primitive CI gate.
- **Always-inject toolbox:** `metadata.cinatra.toolboxes` is intentionally absent from the ApiNode so the Cinatra runtime injects the full self-MCP toolset automatically.
- **Stateless per run:** No database, no cache, no session. All reads/writes go through CRM MCP primitives within a single invocation.
- **Global state:** None. No module-level singletons.
- **Circular imports:** Not applicable (no source modules).

## Anti-Patterns

### Calling crm_account_create without Step 3 dedup

**What happens:** `crm_account_create` does not deduplicate server-side; calling it without first running `crm_account_search` + domain-match creates duplicate CRM rows.
**Why it's wrong:** The CRM ends up with two rows for the same company; downstream consumers (e.g. contact-discovery-agent) may attach contacts to the wrong row.
**Do this instead:** Always run Step 3 (`crm_account_search` + post-filter) before branching to create or update, as defined in `skills/company-discovery-agent/SKILL.md` Steps 3–5.

### Using retired CRM primitives

**What happens:** Using `accounts_*`, `contacts_*`, `lists_*`, or `objects_list` over CRM entity types instead of the `crm_*` facade.
**Why it's wrong:** Retired primitives are removed from the Cinatra runtime; calls will fail at execution time.
**Do this instead:** Route all CRM reads/writes through `crm_account_search`, `crm_account_create`, `crm_account_update`. The CI gate in `extension-kind-gate.mjs` (line 65–71) enforces this on every push.

## Error Handling

**Strategy:** Fail-fast only on Step 1 (missing inputs). All other steps are always-run with best-effort degradation for Apollo.

**Patterns:**
- Step 1 input validation returns `{"error":"at_least_one_of_companyName_or_domain_required"}` and stops immediately.
- Steps 2–6 never throw; errors in Apollo enrichment (Step 4) set `apolloOrganizationId = ""` and continue.
- The gate (`extension-kind-gate.mjs`) exits code 1 on violations, 0 on pass — never throws unhandled exceptions.

## Cross-Cutting Concerns

**Logging:** LLM run notes are embedded in the agent's run output (natural language notes alongside the JSON result). No structured logging framework.
**Validation:** Input validation is Step 1 of the SKILL.md recipe. OAS I/O schema validation is performed by the Cinatra platform at flow invocation time.
**Authentication:** Handled entirely by the Cinatra runtime and MCP layer. No auth logic in this package.

---

*Architecture analysis: 2026-06-09*
