# Company Discovery Agent

Turn a company name or website into one clean, deduplicated account in your workspace. Pass a company name (`Stripe`), a domain (`stripe.com`), or both — the agent searches the CRM before writing. On a match it updates only missing fields and returns `wasMerged: true`; on a miss it creates a new account and returns `wasMerged: false`. Apollo enrichment runs best-effort when connected (current connector: `apolloOrganizationId` is always empty).

**Purpose.** Stateless leaf agent for prospecting pipelines — resolve minimal company signals into a canonical `accountId` without duplicating records.

**Install.** Add `@cinatra-ai/company-discovery-agent` to your workspace manifest via the Cinatra marketplace; no build step required.

**Configuration.** Requires an active CRM connector (Twenty is the default; the agent uses a provider-agnostic `crm_*` facade). Connect Apollo to enable the enrichment step, or pass `apolloLookup: false` per call to skip it.

**API contract.** Inputs: `companyName` (string), `domain` (string — protocol/www/path stripped), `apolloLookup` (boolean, default `true`). At least one of `companyName`/`domain` must be non-empty or the agent returns `{"error":"at_least_one_of_companyName_or_domain_required"}`. Outputs: `accountId`, `wasMerged` (boolean), `apolloOrganizationId` (empty string when unavailable).

**Development.** Logic in `skills/company-discovery-agent/SKILL.md`; flow in `cinatra/oas.json`. Validate: `node extension-kind-gate.mjs --package-root .`

**Troubleshooting.** Duplicate accounts — pass a consistent `domain`; dedup is domain-first (normalized host), then name-matched. Apollo silently skipped — verify the connector is active in settings; errors never abort the run.

## Works with

- Apollo
- Twenty (default CRM)

## Capabilities

- Resolve a company name or domain into a single canonical CRM account
- Deduplicate against existing accounts before writing — never creates a duplicate for the same domain
- Create a new account when the company is genuinely new to the workspace
- Update only missing fields on an existing account when a domain or Apollo reference is absent
- Run a best-effort Apollo enrichment step when the Apollo connector is connected
- Normalize a bare domain or full URL to a host before matching
- Return `accountId`, `wasMerged`, and `apolloOrganizationId` in a structured result
- Run safely in batch as a stateless building block inside larger prospecting flows
