// W8 (cinatra#3096) item 13 — the company-discovery form showing the name or the domain.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const oas = JSON.parse(readFileSync(path.join(root, "cinatra/oas.json"), "utf8"));
const start = oas.$referenced_components.start;

test("(13) the form shows the company name and the domain", () => {
  const hidden = start.metadata.cinatra.hidden ?? [];
  for (const field of ["companyName", "domain"]) {
    assert.ok(!hidden.includes(field), `${field} is hidden from the person`);
    assert.ok(start.inputs.some((i) => i.title === field), `the form does not carry ${field}`);
  }
});

test("(13) the form says one of the two is enough", () => {
  for (const field of ["companyName", "domain"]) {
    const described = start.inputs.find((i) => i.title === field).description ?? "";
    assert.match(described, /at least one/i, `${field} does not say one of the two is enough`);
  }
  assert.deepEqual(start.metadata.cinatra.required ?? [], ["companyName", "domain"], "the form does not draw both fields");
});
