import test from "node:test";
import assert from "node:assert/strict";

import {
  getNextSelectedUserSkillSlugsMap,
  getReadyUserSkillOptions,
  pruneSelectedUserSkillSlugsMap,
} from "./userSkillsState.ts";

test("getReadyUserSkillOptions returns only ready skills and clears invalid payloads", () => {
  assert.deepEqual(getReadyUserSkillOptions(null), []);
  assert.deepEqual(getReadyUserSkillOptions({ ok: false }), []);
  assert.deepEqual(
    getReadyUserSkillOptions({
      ok: true,
      skills: [
        {
          id: "alpha",
          slug: "alpha",
          name: "Alpha",
          description: "Alpha helper",
          status: "ready",
        },
        {
          id: "beta",
          slug: "beta",
          name: "Beta",
          description: "Beta helper",
          status: "warning",
        },
      ],
    }),
    [
      {
        id: "alpha",
        slug: "alpha",
        name: "Alpha",
        description: "Alpha helper",
      },
    ],
  );
});

test("pruneSelectedUserSkillSlugsMap removes stale slugs and empty scopes", () => {
  assert.deepEqual(
    pruneSelectedUserSkillSlugsMap(
      {
        "terminal:1": ["alpha", "missing"],
        "workspace:1": ["missing"],
      },
      [
        {
          id: "alpha",
          slug: "alpha",
          name: "Alpha",
          description: "Alpha helper",
        },
      ],
    ),
    {
      "terminal:1": ["alpha"],
    },
  );
});

test("getNextSelectedUserSkillSlugsMap preserves selections when refresh fails", () => {
  const selected = {
    "terminal:1": ["alpha", "missing"],
    "workspace:1": ["beta"],
  };

  assert.equal(
    getNextSelectedUserSkillSlugsMap(selected, null),
    selected,
  );
  assert.equal(
    getNextSelectedUserSkillSlugsMap(selected, { ok: false }),
    selected,
  );
});
