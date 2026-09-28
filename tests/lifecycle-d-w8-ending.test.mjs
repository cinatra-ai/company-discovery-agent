// Lifecycle D W8 — the company discovery agent's ending (cinatra#3096 items 19
// and 20).
//
// (19) A run that ends closes with a plain sentence — the company was already
// in the CRM and its account was used, a new account was created, or nothing
// could be filed because the run needs the company's name or its domain and a
// connected CRM — never with the discovery step's error envelope or the raw
// values the run hands on.
//
// (20) This agent declares nothing and hands on no failures list: no produces,
// no table, no binding and no artifact edge, so every value it hands on takes
// the default road.
//
// The last two arms re-state the runtime loader's two mount rules over this
// flow, as cinatra-ai/email-recipient-selection-agent holds them in its own
// suite: (A) every input a step requires has a source on every path that
// reaches it, and (B) an OutputMessageNode declares only inputs its template
// reads.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => JSON.parse(readFileSync(path.join(root, rel), "utf8"));
const oas = read("cinatra/oas.json");
const pkg = read("package.json");

const refs = oas.$referenced_components;
const nodesOfType = (type) => Object.values(refs).filter((n) => n.component_type === type);
const controlEdges = (oas.control_flow_connections ?? []).map((e) => ({
  from: e.from_node.$component_ref,
  to: e.to_node.$component_ref,
  branch: e.from_branch,
}));
const hasEdge = (from, to) => controlEdges.some((e) => e.from === from && e.to === to);
const dataEdges = (oas.data_flow_connections ?? []).map((e) => [
  e.source_node.$component_ref + "." + e.source_output,
  e.destination_node.$component_ref + "." + e.destination_input,
]);
const countDataEdges = (from, to) => dataEdges.filter(([f, t]) => f === from && t === to).length;
const outsideComment = (message) => String(message ?? "").replace(/\{#[\s\S]*?#\}/g, "");
/** The names a template reads: identifiers inside its expression and
 *  statement tags, the hint comment left out; literal prose never counts. */
const templateReads = (message) => {
  const names = new Set();
  for (const m of outsideComment(message).matchAll(/\{\{([\s\S]*?)\}\}|\{%([\s\S]*?)%\}/g)) {
    for (const id of (m[1] ?? m[2]).matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) names.add(id[0]);
  }
  return names;
};

const ENVELOPE_CODE = "at_least_one_of_companyName_or_domain_required";
const MESSAGE =
  "{# pyagentspec-input-hint (do not remove): {{ accountId }} {{ wasMerged }} #}" +
  "{% if not accountId %}No company account was found or created: the run needs the company's name or its domain, " +
  "and a connected CRM to search and to write the account in." +
  "{% elif wasMerged %}The company was already in the CRM, so its existing account was used." +
  "{% else %}The company was not in the CRM yet, so a new account was created for it.{% endif %}";

// ---------------------------------------------------------------------------
// (19) a plain-language ending on an empty or failed discovery
// ---------------------------------------------------------------------------

test("(19) the run ends in plain language, never in the envelope", () => {
  const summary = refs.discovery_summary;
  assert.ok(summary, "the run has no closing statement");
  assert.equal(summary.component_type, "OutputMessageNode");
  assert.ok(oas.nodes.some((n) => n.$component_ref === "discovery_summary"), "the closing statement is not a step of the flow");
  assert.ok(hasEdge("discover", "discovery_summary"), "the discovery step does not pass the closing statement");
  assert.ok(hasEdge("discovery_summary", "end"), "the closing statement does not lead to the end");
  assert.ok(!hasEdge("discover", "end"), "the run still jumps straight to its end");
  assert.deepEqual(
    refs.end.outputs.map((o) => o.title),
    ["accountId", "wasMerged", "apolloOrganizationId"],
    "the end node no longer carries the values the run hands on",
  );
});

test("(19) a failed, found or created run ends in plain language", () => {
  const summary = refs.discovery_summary;
  assert.ok(summary, "the run has no closing statement");
  const message = String(summary.message ?? "");
  assert.equal(message, MESSAGE, "each outcome does not reach its own sentence: nothing filed, found, created");
  assert.match(message, /no company account was found or created/i, "a failed or empty run has no plain-language ending");
  assert.match(message, /existing account was used/i, "a found company has no plain-language ending");
  assert.match(message, /new account was created/i, "a created account has no plain-language ending");
  const reads = templateReads(message);
  assert.ok(reads.has("accountId"), "the sentence never reads the account id");
  assert.ok(reads.has("wasMerged"), "the sentence never reads whether the company was found");
  assert.equal(summary.metadata?.cinatra?.purpose, "plain-language-company-discovery-ending");
  assert.deepEqual(summary.inputs, [
    { title: "accountId", type: "string", default: "" },
    { title: "wasMerged", type: "boolean", default: false },
  ]);
  assert.equal(countDataEdges("discover.accountId", "discovery_summary.accountId"), 1);
  assert.equal(countDataEdges("discover.wasMerged", "discovery_summary.wasMerged"), 1);
});

test("(19) the discovery step's error envelope never reaches the person", () => {
  const system = String(refs.discover?.data?.system ?? "");
  const codes = [...new Set([...system.matchAll(/"error"\s*:\s*"([A-Za-z_]+)"/g)].map((m) => m[1]))];
  assert.deepEqual(codes, [ENVELOPE_CODE], "the discovery step names an envelope the ending does not account for");
  assert.deepEqual(
    (refs.discover?.outputs ?? []).map((o) => o.title),
    ["accountId", "wasMerged", "apolloOrganizationId"],
    "the discovery step hands on a value the ending does not account for",
  );
  const summary = refs.discovery_summary;
  assert.ok(summary, "the run has no closing statement");
  const message = String(summary.message ?? "");
  assert.ok(message.includes("{% if not accountId %}"), "an empty or failed run does not reach its own sentence");
  const rendered = outsideComment(message);
  assert.doesNotMatch(rendered, /\{\{\s*accountId\s*\}\}/, "the ending prints the raw account id");
  assert.ok(!rendered.includes(ENVELOPE_CODE), "the ending prints the envelope's code");
  assert.doesNotMatch(rendered, /\berror\b/i, "the ending prints an error word");
});

// ---------------------------------------------------------------------------
// (20) nothing declared: every value takes the default road
// ---------------------------------------------------------------------------

test("(20) nothing declared: no produces, no table, no binding, no artifact edge", () => {
  const cinatra = pkg.cinatra ?? {};
  assert.equal(cinatra.produces, undefined, "the manifest declares a produces entry");
  assert.equal(cinatra.declaredTables, undefined, "the manifest declares a table");
  assert.equal(oas.metadata?.cinatra?.produces, undefined, "the flow carries a produces mirror");
  assert.equal(oas.metadata?.cinatra?.declaredTables, undefined, "the flow declares a table");
  assert.deepEqual(
    (cinatra.dependencies ?? []).filter((d) => d.kind === "artifact"),
    [],
    "the manifest declares an artifact edge",
  );
  const bound = [];
  for (const [id, node] of Object.entries(refs)) {
    for (const out of node.outputs ?? []) if (out?.cinatra?.artifact) bound.push(`${id}.${out.title}`);
  }
  assert.deepEqual(bound, [], "an output carries an artifact binding: " + bound.join(", "));
});

// ---------------------------------------------------------------------------
// (A) every required step input has a source on every path that reaches it
// ---------------------------------------------------------------------------

/** The inputs a node CONSUMES: an EndNode names them under `outputs`, every
 *  other node declares `inputs`. */
function consumedInputs(node) {
  if (node.component_type === "EndNode") return node.outputs ?? [];
  return node.inputs ?? [];
}

/** The values a node HANDS ON: the StartNode emits the inputs it carries,
 *  every other node its declared `outputs`. */
function providedOutputs(node) {
  if (node?.component_type === "StartNode") return node.inputs ?? [];
  return node?.outputs ?? [];
}

/** Walk the flow the way the runtime loader does, returning each input it
 *  would demand from the StartStep. */
function unsourcedInputs() {
  const steps = new Map();
  for (const ref of oas.nodes ?? []) steps.set(ref.$component_ref, refs[ref.$component_ref]);
  const beginId = oas.start_node.$component_ref;
  const startTitles = new Set((steps.get(beginId)?.inputs ?? []).map((i) => i.title));
  // An edge supplies an input only when its source node declares the output
  // it names; an edge from an undeclared output supplies nothing.
  const flowDataEdges = (oas.data_flow_connections ?? [])
    .filter((e) => providedOutputs(refs[e.source_node.$component_ref]).some((o) => o.title === e.source_output))
    .map((e) => ({
      from: e.source_node.$component_ref,
      key: `${e.destination_node.$component_ref}.${e.destination_input}`,
    }));
  const successors = (id) => controlEdges.filter((e) => e.from === id).map((e) => e.to);

  const violations = [];
  const visited = new Map();
  const queue = [[beginId, new Set()]];
  while (queue.length > 0) {
    const [id, incoming] = queue.pop();
    let produced = incoming;
    if (visited.has(id)) {
      const seen = visited.get(id);
      if ([...seen].every((k) => produced.has(k))) continue;
      produced = new Set([...produced].filter((k) => seen.has(k)));
    }
    visited.set(id, produced);

    const node = steps.get(id);
    if (!node) continue;
    if (id !== beginId) {
      for (const descriptor of consumedInputs(node)) {
        const key = `${id}.${descriptor.title}`;
        if (produced.has(key)) continue;
        if (Object.hasOwn(descriptor, "default")) continue;
        if (startTitles.has(descriptor.title)) continue;
        violations.push(key);
      }
    }

    const next = new Set(produced);
    for (const edge of flowDataEdges) if (edge.from === id) next.add(edge.key);
    for (const child of successors(id)) queue.push([child, new Set(next)]);
  }
  return violations;
}

test("every required step input has a source on every path that reaches it", () => {
  const found = unsourcedInputs();
  assert.deepEqual(
    found,
    [],
    "the runtime refuses to mount a flow whose step requires an input the StartStep does not carry: " + found.join(", "),
  );
});

// ---------------------------------------------------------------------------
// (B) an OutputMessageNode declares only inputs its template reads
// ---------------------------------------------------------------------------

test("an output message declares only inputs its template reads", () => {
  const offenders = [];
  for (const node of nodesOfType("OutputMessageNode")) {
    const reads = templateReads(node.message);
    for (const { title } of node.inputs ?? []) {
      if (!reads.has(title)) offenders.push(`${node.id}.${title}`);
    }
  }
  assert.deepEqual(offenders, [], "the runtime rejects an input the template never reads: " + offenders.join(", "));
});
