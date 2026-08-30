// Lifecycle D W6 — this agent's declared state, asserted on the shipped
// manifest and the shipped service description.
//
// The declaration key: a dependency is a required `kind: "artifact"` entry in
// `cinatra.dependencies`; produces is `cinatra.produces` on the manifest, which
// is the only authority the host compiler reads; a binding is an end-node
// output's `cinatra.artifact` block. A produces mirror carried in the service
// description is optional, and when present must agree entry for entry with the
// manifest — the compiler refuses a mirror that disagrees.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const oas = JSON.parse(readFileSync(join(root, "cinatra/oas.json"), "utf8"));
const cinatra = pkg.cinatra ?? {};
const components = oas.$referenced_components ?? {};

const artifactDependencies = (cinatra.dependencies ?? []).filter(
  (d) => d.kind === "artifact",
);
const bindings = [];
for (const [id, comp] of Object.entries(components)) {
  if (comp?.component_type !== "EndNode") continue;
  for (const out of comp.outputs ?? []) {
    const binding = out?.cinatra?.artifact;
    if (binding) bindings.push({ node: id, output: out.title, binding });
  }
}
function approvalNodes(value, found = []) {
  if (Array.isArray(value)) {
    for (const v of value) approvalNodes(v, found);
  } else if (value && typeof value === "object") {
    if (value.metadata?.cinatra?.requiresApproval === true) found.push(value.id ?? "(anonymous)");
    for (const v of Object.values(value)) approvalNodes(v, found);
  }
  return found;
}
function startMeta() {
  for (const comp of Object.values(components)) {
    if (comp?.component_type === "StartNode") return comp;
  }
  throw new Error("no StartNode");
}

test("the produces mirror agrees with the manifest, entry for entry", () => {
  const mirror = oas.metadata?.cinatra?.produces;
  if (mirror === undefined) return;
  assert.deepEqual(mirror, cinatra.produces ?? []);
});

test("no start-node input is listed as both required and hidden", () => {
  const meta = startMeta().metadata?.cinatra ?? {};
  const hidden = new Set(meta.hidden ?? []);
  assert.deepEqual((meta.required ?? []).filter((t) => hidden.has(t)), []);
});

test("the manifest claims a gate only when the flow has one", () => {
  const claimed = cinatra.hasApprovalGates === true;
  const real = approvalNodes(oas).length > 0;
  if (claimed) assert.equal(real, true);
});

// ---------------------------------------------------------------------------
// 6d — the form shows the one thing the person supplies, and 6e — this agent
// declares nothing: the account it finds or patches is a CRM row, not an
// artifact.
// ---------------------------------------------------------------------------

test("6d — the form shows the domain the person supplies", () => {
  const meta = startMeta().metadata?.cinatra ?? {};
  const hidden = new Set(meta.hidden ?? []);
  assert.equal(hidden.has("domain"), false, "the domain is still hidden");
  const titles = (startMeta().inputs ?? []).map((i) => i.title);
  assert.ok(titles.includes("domain"));
});

test("6d — the visible field is not also a required one", () => {
  assert.equal((startMeta().metadata?.cinatra?.required ?? []).includes("domain"), false);
});

test("6e — nothing declared: no produces, no binding, no artifact edge", () => {
  assert.equal(cinatra.produces, undefined);
  assert.equal(oas.metadata?.cinatra?.produces, undefined);
  assert.deepEqual(bindings, []);
  assert.deepEqual(artifactDependencies, []);
});
