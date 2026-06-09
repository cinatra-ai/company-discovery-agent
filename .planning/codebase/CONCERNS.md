# Codebase Concerns

**Analysis Date:** 2026-06-09

## Tech Debt

**Apollo enrichment is permanently a stub:**
- Issue: Step 4 of the agent recipe is documented as "best-effort" and explicitly states "the current connector primitive surfaces administrative settings only — it does NOT expose a per-domain organization lookup." `apolloOrganizationId` is always returned as an empty string when `apolloLookup === true`. The stub comment "When a future Apollo primitive does expose per-domain lookup, this step can be extended" is open-ended with no tracking mechanism.
- Files: `skills/company-discovery-agent/SKILL.md` (lines 72–77), `cinatra/oas.json` (line 270)
- Impact: The `apolloOrganizationId` output is meaningless in all production runs regardless of the `apolloLookup` flag. Callers may misinterpret an empty string as "not found" when the connector simply cannot query by domain.
- Fix approach: Implement a dedicated `apollo_organization_get({ domain })` MCP primitive and update Step 4 of `SKILL.md` and the OAS prompt to use it. Until then, consider removing or deprecating `apolloOrganizationId` from the output contract to avoid caller confusion.

**`apollo_validate` described but not used in the canonical recipe:**
- Issue: `SKILL.md` lists `apollo_validate` as one of the 5 allowed MCP primitives (line 23) and Step 4 directs the agent to call `apollo_administration_get` for connection state — but also says "Use `apollo_administration_get({})` for connection state because `apollo_validate({})` returns `{ ok: true }` or throws, and `.connected` is only exposed by `apollo_administration_get`." The `apollo_validate` primitive is enumerated in the tool list but the text never instructs calling it, creating an apparent dead entry in the allowed-tool inventory.
- Files: `skills/company-discovery-agent/SKILL.md` (lines 23–24, 75)
- Impact: LLM agents following the recipe literally may attempt to call `apollo_validate` unnecessarily, consuming an MCP round trip, or may be confused by the mismatch.
- Fix approach: Remove `apollo_validate` from the "Tool discipline" allowed list in `SKILL.md` if it is not called, or add an explicit call site in Step 4.

**`wasMerged` derivation is always equivalent to `preexistingAccountId !== null`:**
- Issue: Step 6 derives `wasMerged` as `preexistingAccountId !== null && preexistingAccountId === accountId`. Because Branch B always sets `accountId = preexistingAccountId` (the CRM update does not change the id), the second condition is tautologically true whenever the first is true. The documentation comment adds no value and may mislead future editors into thinking the two conditions can diverge.
- Files: `skills/company-discovery-agent/SKILL.md` (lines 121–124)
- Impact: Low — logic is correct, but the redundant condition obscures the semantics and could mislead a future LLM agent into implementing a more complex check.
- Fix approach: Simplify Step 6 to `wasMerged = preexistingAccountId !== null`.

## Known Bugs

**No server-side dedup for `crm_account_create`:**
- Symptoms: If two concurrent runs of the agent race through Step 3 simultaneously (both see no preexisting account), both will call `crm_account_create` and create duplicate CRM rows for the same company.
- Files: `skills/company-discovery-agent/SKILL.md` (line 117, explicit warning)
- Trigger: Any high-concurrency caller (e.g., batch import of companies) where two runs share the same `domainName` and both arrive before either has committed.
- Workaround: The SKILL.md itself documents this: "Calling `crm_account_create` twice with the same `domainName` will create TWO rows; always run Step 3 first." No idempotency guarantee exists beyond the advisory.

**Domain normalization applied only by the agent, not enforced by the CRM facade:**
- Symptoms: If the CRM stores `domainName` in un-normalized form (e.g., with trailing slash or `www.` prefix from an older run), Step 3's domain match will miss the existing row and create a duplicate.
- Files: `skills/company-discovery-agent/SKILL.md` (lines 66–68, Step 3 matching logic)
- Trigger: CRM accounts created by an external tool or an older agent version that did not normalize before writing.
- Workaround: None specified. Step 3 normalizes before comparing, but existing CRM data may not be normalized.

## Security Considerations

**LLM-visible prompt includes raw caller inputs without sanitization:**
- Risk: The `user` prompt string in `cinatra/oas.json` (line 226–228) interpolates `companyName` and `domain` from the caller directly via template variables (`{{ companyName }}`, `{{ domain }}`). Prompt injection is possible if a caller can supply adversarial values.
- Files: `cinatra/oas.json` (lines 225–228)
- Current mitigation: The Cinatra platform's llm-bridge is expected to handle variable substitution; the agent's Step 1 validation only checks that at least one field is non-empty after trimming.
- Recommendations: The llm-bridge layer should sanitize or quote template variables before embedding them in the system/user prompt to prevent prompt injection. An explicit character allowlist (e.g., printable ASCII, max length) on `companyName` and `domain` inputs should be enforced at the OAS input schema level.

**`.npmrc` present — may contain registry auth tokens:**
- The `.npmrc` file exists at the repo root. Its contents have not been read (per forbidden-file rules for auth-token files). If it contains a registry token it should not be committed.
- Files: `.npmrc`
- Current mitigation: Unknown.
- Recommendations: Verify `.npmrc` contains only non-secret configuration (e.g., `engine-strict=true`) and that no auth tokens are hard-coded. Use environment-level secrets in CI for registry authentication.

**Release workflow uses `secrets: inherit` broadly:**
- Risk: `release.yml` passes all secrets to the reusable workflow via `secrets: inherit`. If the reusable workflow at `cinatra-ai/.github` is ever compromised or extended, all org secrets (including `CINATRA_MARKETPLACE_VENDOR_TOKEN`) are exposed.
- Files: `.github/workflows/release.yml` (line 30)
- Current mitigation: The reusable workflow is hosted in the same org (`cinatra-ai/.github`), limiting blast radius to org-internal compromise.
- Recommendations: Prefer explicit `secrets:` mapping to pass only the required secret(s) instead of `secrets: inherit`.

## Performance Bottlenecks

**CRM search is name-biased — domain-only callers pay a false-miss penalty:**
- Problem: The SKILL.md notes that "the provider's search index is name-biased (Twenty searches by `searchName`); domain-only matches require post-filtering on the returned `domainName` field." When called with domain only, the agent must query by `websiteHost` and then scan the returned array manually, which may miss the correct row if the CRM search returns too few results (page truncation).
- Files: `skills/company-discovery-agent/SKILL.md` (lines 62–68)
- Cause: The CRM facade's `crm_account_search` does not support filtering by `domainName` directly.
- Improvement path: Add a `domainName`-indexed search primitive to the CRM facade (e.g., `crm_account_search({ domainName: websiteHost })`), or ensure the search returns all rows when queried with a domain string.

## Fragile Areas

**Agent behavior is fully encoded in a prose SKILL.md — no executable implementation:**
- Files: `skills/company-discovery-agent/SKILL.md`
- Why fragile: The entire business logic (normalization, dedup, Apollo branching, write selection, output format) lives as natural-language instructions to an LLM. Any ambiguity in the prose, any LLM model update, or any prompt-token truncation can silently change the agent's behavior. There is no unit-testable code path.
- Safe modification: Changes to SKILL.md should be accompanied by LLM-in-the-loop integration tests that exercise each step branch (create vs update, domain-only vs name-only, apolloLookup true vs false, Apollo connected vs disconnected).
- Test coverage: No automated tests exist for the agent's step logic (see Test Coverage Gaps below).

**OAS `oas.json` system prompt is a one-liner summary, not the full recipe:**
- Files: `cinatra/oas.json` (line 225)
- Why fragile: The `discover` node's `system` field says "Follow the SKILL.md step-by-step" but the LLM receives both the OAS prompt and SKILL.md injected by the bridge. If the bridge injection order changes or SKILL.md is not co-located at the expected path (`agents/cinatra/company-discovery-agent/skills/company-discovery-agent/SKILL.md`), the agent runs with only the thin system prompt and no recipe.
- Safe modification: The OAS metadata comment (line 270) documents the auto-discovery path. Do not rename the `skills/company-discovery-agent/` directory without also updating the bridge's lookup logic.

**`tsconfig.json` references a `src/` directory that does not exist:**
- Files: `tsconfig.json` (`"rootDir": "src"`, `"include": ["src/**/*.ts", "src/**/*.tsx"]`)
- Why fragile: The repo ships no `src/` directory — it is a content-only extension (SKILL.md + OAS). The tsconfig is a standard template carried over from the extraction script. Running `tsc` would emit TS18003 "No inputs were found". The CI workflow guards against this (`[ -z "$(git ls-files '*.ts' ...)" ]` exits early), but any future TS source added to `src/` will compile under incorrect assumptions (e.g., `jsx: react-jsx` and `DOM` lib are irrelevant for an LLM agent node).
- Safe modification: If TypeScript sources are added, update `tsconfig.json` to remove DOM/JSX settings not needed for a Node.js agent and verify the `src/` rootDir is correct.

## Scaling Limits

**Sequential MCP calls — no batching:**
- Current capacity: Each agent run issues up to 3 sequential MCP calls (Step 3: search, Step 4: apollo_administration_get, Step 5: create or update). This is fine for individual invocations.
- Limit: Batch callers issuing hundreds of concurrent runs will hit MCP rate limits on the CRM facade and Apollo connector. There is no retry or backoff logic in the agent recipe.
- Scaling path: Add retry-with-backoff guidance to SKILL.md for Step 3 and Step 5, or implement a batch-dedup layer upstream of the agent.

## Dependencies at Risk

**Hard-coded preferred model `gpt-5.5` in two places:**
- Risk: `cinatra/oas.json` specifies `"preferredModel": "gpt-5.5"` in both the flow-level metadata and the `discover` node's `cinatra_llm` field. If OpenAI retires or renames this model, runs will fail or silently fall back to a different model with potentially different instruction-following behavior.
- Files: `cinatra/oas.json` (lines 15, 229)
- Impact: All production runs use this model; any model-level behavioral change affects the entire agent.
- Migration plan: Centralize model selection in platform-level configuration rather than per-agent OAS hardcoding. Use a stable alias (e.g., `gpt-latest`) where the platform resolves to a current capable model.

**Reusable release workflow pinned to `@main`:**
- Risk: `release.yml` uses `cinatra-ai/.github/.github/workflows/reusable-extension-release.yml@main`, meaning any change to `main` in the `.github` repo immediately affects this repo's release process.
- Files: `.github/workflows/release.yml` (line 29)
- Impact: An accidental breaking change to the reusable workflow could block all releases from this repo without any indication at the repo level.
- Migration plan: Pin the reusable workflow to a SHA or versioned tag rather than `@main`.

## Missing Critical Features

**No input schema validation beyond "at least one of companyName/domain":**
- Problem: The OAS schema marks both `companyName` and `domain` as optional strings with no length limits, format constraints, or character allowlists. Invalid inputs (empty strings after trimming, extremely long strings, non-domain strings in the `domain` field) reach the LLM recipe without structured rejection.
- Blocks: Reliable error surfacing for malformed caller inputs; protection against prompt injection (see Security section).

**No idempotency key / external-id support:**
- Problem: There is no way for a caller to supply an idempotency key or external reference ID to prevent duplicate processing on retry.
- Blocks: Safe retry of failed runs without risking duplicate CRM rows.

## Test Coverage Gaps

**Zero automated tests for agent step logic:**
- What's not tested: Steps 1–6 of the recipe — input validation, domain normalization, CRM search dedup matching, Apollo branching, create vs update selection, `wasMerged` derivation, and output JSON format.
- Files: No test files exist anywhere in the repository.
- Risk: Any regression in SKILL.md prose (e.g., an accidental edit that changes normalization logic) or a new LLM model with different instruction adherence goes completely undetected before production.
- Priority: High

**No gate tests for `extension-kind-gate.mjs`:**
- What's not tested: The `validateAgent`, `validateWorkflow`, `validateBpmnSanity`, `validateWorkflowPackageShape`, `parseArgs`, and `findWorkflowSidecars` exported functions have no test suite despite containing non-trivial logic (regex-based XML tag-balance walking, namespace resolution, banned-primitive scanning).
- Files: `extension-kind-gate.mjs`
- Risk: Bugs in the gate (e.g., a regex that fails to match a new banned primitive token, or a false-pass on malformed BPMN) would allow regressions to reach the marketplace silently.
- Priority: Medium

---

*Concerns audit: 2026-06-09*
