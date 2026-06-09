# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**Cinatra LLM Bridge:**
- Service: Cinatra platform's `/api/llm-bridge` endpoint
  - Used by: `discover` ApiNode in `cinatra/oas.json`
  - Invocation: HTTP POST to `{{CINATRA_BASE_URL}}/api/llm-bridge`
  - Auth: provided by Cinatra platform at runtime (token injection not visible in this repo)
  - Payload: `{ agent_id, system, user, agent_run_id, cinatra_llm: { preferredProvider, preferredModel } }`
  - LLM preference: OpenAI `gpt-5.5` (`cinatra/oas.json` → `metadata.cinatra.llm`)

**Apollo (Sales Intelligence):**
- Service: Apollo.io — accessed via Cinatra self-MCP primitives (NOT direct HTTP calls from this repo)
- MCP Primitives used:
  - `apollo_validate` — verifies Apollo connector is connected (returns `{ ok: true }` or throws)
  - `apollo_administration_get` — retrieves connector admin settings including `{ connected, lastValidatedAt, peopleSearchAvailable, loggingEnabled }`
- Lookup behavior: best-effort; per-domain organization lookup NOT exposed by current connector
- `apolloOrganizationId` is always returned as `""` under the current Apollo connector surface
- Activation: controlled by `apolloLookup` boolean input (default `true`)

## Data Storage

**Databases:**
- CRM (provider-agnostic facade) — accessed via Cinatra self-MCP primitives:
  - `crm_account_search({ query })` — search existing accounts (name-biased, used for dedup in Step 3)
  - `crm_account_create({ name, domainName?, apolloOrganizationId? })` — create new account row
  - `crm_account_update({ id, patch })` — patch existing account row
- Current CRM provider: Twenty (Company id is the native `accountId` returned)
- Future providers: HubSpot, Salesforce (via the same `crm_*` facade — no agent changes required)
- Connection: managed by Cinatra platform; no direct DB credentials in this repo

**File Storage:**
- Not applicable

**Caching:**
- Not detected — the agent is explicitly stateless; no cache layer

## Authentication & Identity

**Auth Provider:**
- Cinatra platform handles all authentication — the agent itself carries no auth credentials
- Apollo connector auth: managed by Cinatra connector config (not visible in this repo); `apollo_administration_get` surfaces `connected` state

## Monitoring & Observability

**Error Tracking:**
- Not detected in this repo — error handling is fully in-agent (Step 1 input validation is the only hard abort; Steps 2–6 are best-effort and never throw)

**Logs:**
- Agent run notes are embedded in LLM output (e.g., Apollo branch disconnect noted in run output text)
- `cinatra_run_id` input wired to `agent_run_id` in `cinatra/oas.json` for platform-side run correlation

## CI/CD & Deployment

**Hosting:**
- Cinatra Marketplace (`registry.cinatra.ai`) — not a public npm registry
- Submission via marketplace MCP proxy: `extension-submit-for-review` → approve → promotion saga

**CI Pipeline:**
- GitHub Actions — `.github/workflows/ci.yml` (runs on push/PR to `main`)
  - Validates first-party dependency shape (no `@cinatra-ai/*` in deps/devDeps)
  - Conditionally installs, typechecks, and tests (skipped for source-mirror repos)
  - Dry-run `npm pack` to validate publish payload
  - Agent OAS gate: `node extension-kind-gate.mjs --package-root .` (scans `cinatra/oas.json` for retired CRM primitives)
- GitHub Actions — `.github/workflows/release.yml` (triggers on GitHub Release publish)
  - Delegates to `cinatra-ai/.github/.github/workflows/reusable-extension-release.yml@main`
  - Requires `CINATRA_MARKETPLACE_VENDOR_TOKEN` org secret (dormant until org infra exists)

## Environment Configuration

**Required env vars:**
- `CINATRA_BASE_URL` — base URL for the Cinatra platform API (injected into `cinatra/oas.json` at flow runtime)

**Secrets location:**
- `.env` file not present in this repo
- `CINATRA_MARKETPLACE_VENDOR_TOKEN` — GitHub org-level secret consumed by the release reusable workflow

## Webhooks & Callbacks

**Incoming:**
- Not applicable — the agent is invoked as a Cinatra flow; no inbound webhook endpoints

**Outgoing:**
- Not applicable — all external calls go through Cinatra's self-MCP primitives (`crm_*`, `apollo_*`) and the `/api/llm-bridge` endpoint; no direct outbound webhooks from this repo

---

*Integration audit: 2026-06-09*
