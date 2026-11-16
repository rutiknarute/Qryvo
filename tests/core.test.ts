import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  auditIds,
  csv,
  defaults,
  generateSearches,
  generateUrl,
  mergeConfig,
  parseGroup,
  validateConfig,
} from "../src/core.ts";
import type { Config } from "../src/core.ts";
const seed = JSON.parse(
  readFileSync(new URL("../src/data/seed.json", import.meta.url), "utf8"),
) as Config;

test("all 16 groups retain original names, ordered numeric IDs, and sources", () => {
  assert.equal(seed.groups.length, 16);
  assert.equal(seed.boolean_presets.length, 2);
  assert.deepEqual(
    seed.groups.map((g) => g.company_ids.length),
    [25, 25, 50, 60, 60, 60, 60, 100, 100, 40, 50, 50, 50, 50, 100, 100],
  );
  assert.equal(seed.groups.flatMap((g) => g.company_ids).length, 980);
  assert.equal(new Set(seed.groups.flatMap((g) => g.company_ids)).size, 839);
  assert.deepEqual([...auditIds], ["04", "05", "06", "07", "10"]);
  for (const g of seed.groups) {
    assert.deepEqual(
      new URL(g.source_url).searchParams.get("f_C")!.split(","),
      g.company_ids,
    );
    assert.equal(new Set(g.company_ids).size, g.company_ids.length);
  }
  assert.equal(validateConfig(seed), seed);
});

test("32 original combinations retain fixture filters on the search-results route", () => {
  const rows = readFileSync(new URL("./baseline.csv", import.meta.url), "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1);
  assert.equal(rows.length, 32);
  const keys = new Set<string>();
  for (const row of rows) {
    const [groupId, groupName, count, presetId, presetName, url] =
      row.split(",");
    const group = seed.groups.find((g) => g.id === groupId)!;
    const preset = seed.boolean_presets.find((p) => p.id === presetId)!;
    assert.equal(group.name, groupName);
    assert.equal(preset.name, presetName);
    assert.equal(group.company_ids.length, Number(count));
    const actual = new URL(generateUrl(group, preset));
    const expected = new URL(url);
    assert.equal(actual.origin, expected.origin);
    assert.equal(actual.pathname, "/jobs/search-results/");
    expected.searchParams.set("f_E", "2");
    assert.deepEqual([...actual.searchParams], [...expected.searchParams]);
    assert.equal(actual.searchParams.get("keywords"), preset.query);
    assert.deepEqual(
      actual.searchParams.get("f_C")!.split(","),
      group.company_ids,
    );
    assert.equal(actual.searchParams.has("currentJobId"), false);
    assert.equal(actual.searchParams.has("start"), false);
    keys.add(`${groupId}:${presetId}`);
  }
  assert.equal(keys.size, 32);
  assert.equal(seed.boolean_presets[0].query.length, 463);
  assert.equal(seed.boolean_presets[1].query.length, 489);
});

test("experience filters default to entry level, support associate and any, and restore old options", () => {
  const group = seed.groups[9];
  const preset = seed.boolean_presets[1];
  const legacy = { date: "r86400", geoId: "103644278", sortBy: "DD", mode: "separate" as const };
  const result = generateSearches([group], preset, legacy)[0];
  const u = new URL(result.url);
  assert.equal(u.searchParams.get("f_E"), "2");
  assert.equal(result.options.experience, "2");
  assert.equal(u.searchParams.get("keywords"), preset.query);
  assert.equal(u.searchParams.get("f_C"), group.company_ids.join(","));
  assert.equal(u.searchParams.get("f_TPR"), "r86400");
  assert.equal(u.searchParams.get("geoId"), "103644278");
  for (const experience of ["2", "2,3", ""]) {
    const url = new URL(generateUrl(group, preset, { ...defaults, experience }));
    assert.equal(url.searchParams.get("f_E"), experience || null);
  }
  assert.throws(() => generateUrl(group, preset, { ...defaults, experience: "4" }), /experience/);
});

test("batch stays separate, preset switches only keywords, merge is stable and explicit", () => {
  const batch = generateSearches(
    seed.groups,
    seed.boolean_presets[0],
    defaults,
  );
  assert.equal(batch.length, 16);
  for (const g of seed.groups) {
    const a = new URL(generateUrl(g, seed.boolean_presets[0]));
    const b = new URL(generateUrl(g, seed.boolean_presets[1]));
    a.searchParams.delete("keywords");
    b.searchParams.delete("keywords");
    assert.equal(a.href, b.href);
  }
  const merge = generateSearches(seed.groups, seed.boolean_presets[1], {
    ...defaults,
    mode: "merged",
  });
  assert.equal(merge.length, 1);
  assert.deepEqual(merge[0].group.company_ids, [
    ...new Set(seed.groups.flatMap((g) => g.company_ids)),
  ]);
  const u = new URL(
    generateUrl(seed.groups[0], seed.boolean_presets[0], {
      date: "r604800",
      geoId: "",
      sortBy: "R",
      mode: "separate",
    }),
  );
  assert.equal(u.searchParams.get("f_TPR"), "r604800");
  assert.equal(u.searchParams.has("geoId"), false);
  assert.equal(u.searchParams.get("sortBy"), "R");
});

test("imports reject malformed URLs and preserve duplicates and exact original source", () => {
  for (const url of [
    "https://example.com/jobs/search/?f_C=1",
    "http://www.linkedin.com/jobs/search/?f_C=1",
    "https://linkedin.com.evil.test/jobs/search/?f_C=1",
    "https://www.linkedin.com/in/person/?f_C=1",
    "https://linkedin.com/jobs/search/",
    "https://linkedin.com/jobs/search/?f_C=1,,2",
    "https://linkedin.com/jobs/search/?f_C=1,abc",
    "https://user:pass@linkedin.com/jobs/search/?f_C=1",
  ])
    assert.throws(() => parseGroup("Test", url, "test"));
  const source =
    "https://www.linkedin.com/jobs/search-results/?currentJobId=123&f_C=002%2C1%2C002&start=50";
  const g = parseGroup("Test", source, "test");
  assert.deepEqual(g.company_ids, ["002", "1", "002"]);
  assert.equal(g.source_url, source);
  assert.equal(g.unique_company_count, 2);
  const generated = new URL(generateUrl(g, seed.boolean_presets[0]));
  assert.equal(generated.searchParams.get("f_C"), "002,1,002");
  assert.equal(generated.searchParams.has("start"), false);
});

test("JSON validation is atomic, versioned, non-destructive and protects original presets", () => {
  const before = JSON.stringify(seed);
  assert.throws(
    () => validateConfig({ ...seed, schema_version: "2.0" }),
    /schema/,
  );
  assert.throws(
    () =>
      validateConfig({
        ...seed,
        groups: [{ ...seed.groups[0], company_ids: ["999"] }],
      }),
    /do not match/,
  );
  assert.throws(
    () => validateConfig({ ...seed, groups: [seed.groups[0], seed.groups[0]] }),
    /Duplicate/,
  );
  assert.throws(
    () =>
      mergeConfig(seed, {
        ...seed,
        boolean_presets: [{ ...seed.boolean_presets[0], query: "edited" }],
      }),
    /conflicts/,
  );
  const custom = parseGroup(
    "A new group",
    "https://linkedin.com/jobs/search/?f_C=1,2",
    "custom-test",
  );
  const imported = mergeConfig(seed, {
    schema_version: "1.0.0",
    groups: [custom],
    boolean_presets: [
      {
        id: "custom-p",
        name: "Special query",
        query: '  ("A&B" OR "C++") NOT "x"  ',
      },
    ],
  });
  assert.equal(imported.groups.length, 17);
  assert.equal(
    imported.boolean_presets[2].query,
    '  ("A&B" OR "C++") NOT "x"  ',
  );
  assert.equal(JSON.stringify(seed), before);
  assert.deepEqual(mergeConfig(imported, seed), imported);
});

test("CSV exports every pair and safely quotes custom names and full URLs", () => {
  const matrix = seed.boolean_presets.flatMap((p) =>
    generateSearches(seed.groups, p, defaults),
  );
  assert.equal(csv(matrix).split("\r\n").length, 33);
  const group = { ...seed.groups[0], name: '=SUM(1,2) "quoted"' };
  const text = csv(
    generateSearches([group], seed.boolean_presets[0], defaults),
  );
  assert.ok(text.includes('"\'=SUM(1,2) ""quoted"""'));
  assert.ok(text.includes(matrix[0].url));
});

test("the catalogue exposes only the two original exact queries and retires saved extras without losing companies", async () => {
  const { catalogue, mergeCatalogue } = await import("../src/catalogue.ts");
  assert.deepEqual(catalogue.boolean_presets, seed.boolean_presets);
  const custom = parseGroup(
    "My collection",
    "https://www.linkedin.com/jobs/search/?f_C=19,23",
    "custom-saved",
  );
  const restored = mergeCatalogue({
    ...seed,
    groups: [...seed.groups, custom],
    boolean_presets: [
      ...seed.boolean_presets,
      { id: "new-grad-software-ai", name: "Retired query", query: "legacy" },
      { id: "custom-old", name: "Old custom query", query: "old" },
    ],
  });
  assert.deepEqual(restored.boolean_presets, seed.boolean_presets);
  assert.equal(restored.groups.length, 17);
  assert.deepEqual(restored.groups.at(-1), custom);
  assert.throws(
    () =>
      mergeCatalogue({
        ...seed,
        boolean_presets: [{ ...seed.boolean_presets[0], query: "edited" }],
      }),
    /conflicts/,
  );
});

test("company names are keyed by exact saved IDs without inventing names for blank CSV fields", () => {
  const data = JSON.parse(
    readFileSync(
      new URL("../src/data/company-names.json", import.meta.url),
      "utf8",
    ),
  );
  const ids = seed.groups.flatMap((g) => g.company_ids);
  assert.equal(data.row_count, 839);
  assert.equal(data.named_row_count, 486);
  assert.equal(data.unresolved_row_count, 353);
  assert.equal(Object.keys(data.names).length, 486);
  assert.equal(new Set(ids).size, data.row_count);
  for (const [id, name] of Object.entries(data.names)) {
    assert.ok(ids.includes(id));
    assert.equal(typeof name, "string");
    assert.ok((name as string).trim());
  }
  assert.equal(data.names["1497"], "AMD");
  assert.equal(data.names["1441"], "Google");
  assert.equal(data.names["1480"], "Adobe");
  assert.equal(data.names["20226"], undefined);
  assert.ok(data.names["1253"]);
});
