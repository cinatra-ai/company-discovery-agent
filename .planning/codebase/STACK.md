# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- JavaScript (ESM) — runtime logic in `extension-kind-gate.mjs` (CI gate, Node built-ins only)
- JSON — agent definition in `cinatra/oas.json`, skill manifest in `skills/company-discovery-agent/SKILL.md`

**Secondary:**
- TypeScript — `tsconfig.json` is present targeting `src/` (ES2023, ESNext modules), but no `src/` directory exists in this repo; TypeScript is a declared compile target for when source is added
- Markdown — agent system prompt in `skills/company-discovery-agent/SKILL.md` (YAML frontmatter + Markdown body)

## Runtime

**Environment:**
- Node.js 24 (enforced by `.github/workflows/ci.yml` via `actions/setup-node@v4 node-version: "24"`)

**Package Manager:**
- pnpm (via corepack) — `corepack enable` + `corepack pnpm install` in CI
- `.npmrc` sets `auto-install-peers=false`
- No lockfile committed (CI uses `--no-frozen-lockfile` for standalone repos)

## Frameworks

**Core:**
- Cinatra Agent Platform (`cinatra.ai/v1`) — the repo is a Cinatra `kind: agent` extension declared in `package.json` under the `cinatra` key
- Cinatra OAS Flow format (`agentspec_version: 26.1.0`) — agent execution graph defined in `cinatra/oas.json` with StartNode → ApiNode → EndNode

**Testing:**
- Not detected — no test framework declared; CI runs `pnpm test --if-present` (passes with no test script)

**Build/Dev:**
- No build step — this is a content-only agent extension; CI confirms no tracked TypeScript sources and skips typecheck accordingly
- `extension-kind-gate.mjs` — self-contained zero-dependency CI gate (plain Node builtins: `fs`, `path`)

## Key Dependencies

**Critical:**
- `@cinatra-ai/company-discovery-agent` (this package, v0.1.0) — declares no runtime dependencies
- `cinatra.dependencies: []` in `package.json` — no Cinatra platform dependencies declared

**Infrastructure:**
- No `dependencies` or `devDependencies` in `package.json`; the package is intentionally dependency-free
- First-party `@cinatra-ai/*` packages are expected to be provided as optional peer dependencies by the host Cinatra monorepo (CI enforces this shape)

## Configuration

**Environment:**
- `CINATRA_BASE_URL` — template variable injected at runtime into the `discover` ApiNode URL (`{{CINATRA_BASE_URL}}/api/llm-bridge` in `cinatra/oas.json`)
- `cinatra_run_id` — passed as a flow input for run correlation

**Build:**
- `tsconfig.json` — ES2023 target, ESNext modules, `bundler` module resolution, strict mode, outputs to `dist/` from `src/`; presently has no sources to compile
- `.npmrc` — `auto-install-peers=false`

## Platform Requirements

**Development:**
- Node.js 24+
- pnpm (via corepack)

**Production:**
- Deployed to the Cinatra Marketplace via `cinatra-ai/.github` reusable release workflow
- Published to `registry.cinatra.ai` (NOT a public npm registry) through the marketplace MCP proxy submission saga
- Release triggered by GitHub Release tag matching `v<package.json.version>`

---

*Stack analysis: 2026-06-09*
