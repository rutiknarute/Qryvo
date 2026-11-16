export type Group = {
  id: string;
  name: string;
  company_ids: string[];
  source_url: string;
  company_count?: number;
  unique_company_count?: number;
  source_location_id?: string | null;
  source_time_filter?: string | null;
  source_sort?: string | null;
  [key: string]: unknown;
};
export type Preset = {
  id: string;
  name: string;
  query: string;
  [key: string]: unknown;
};
export type Config = {
  schema_version: string;
  groups: Group[];
  boolean_presets: Preset[];
  [key: string]: unknown;
};
export type Options = {
  date: string;
  geoId: string;
  sortBy: string;
  mode: "separate" | "merged";
};
export type SearchResult = {
  group: Group;
  preset: Preset;
  url: string;
  options: Options;
};
export const defaults: Options = {
  date: "r86400",
  geoId: "103644278",
  sortBy: "DD",
  mode: "separate",
};
export const auditIds = new Set(["04", "05", "06", "07", "10"]);
export function parseGroup(
  name: string,
  source: string,
  id = `custom-${crypto.randomUUID()}`,
): Group {
  if (!name.trim()) throw new Error("Give this company group a name.");
  let u: URL;
  try {
    u = new URL(source);
  } catch {
    throw new Error(
      "Enter a complete LinkedIn Jobs URL beginning with https://.",
    );
  }
  if (
    u.protocol !== "https:" ||
    !["linkedin.com", "www.linkedin.com"].includes(u.hostname) ||
    !/^\/jobs\/(search|search-results)\/?$/.test(u.pathname) ||
    u.username ||
    u.password
  )
    throw new Error(
      "Use an HTTPS linkedin.com/jobs/search/ or /jobs/search-results/ URL.",
    );
  const ids = u.searchParams.get("f_C")?.split(",");
  if (!ids?.length || ids.some((i) => !/^\d+$/.test(i)))
    throw new Error(
      "This URL needs an f_C company filter containing comma-separated numeric IDs, with no blank entries.",
    );
  return {
    id,
    name: name.trim(),
    company_ids: ids,
    company_count: ids.length,
    unique_company_count: new Set(ids).size,
    source_url: source,
    source_location_id: u.searchParams.get("geoId"),
    source_time_filter: u.searchParams.get("f_TPR"),
    source_sort: u.searchParams.get("sortBy"),
  };
}
export function generateUrl(
  group: Group,
  preset: Preset,
  options: Options = defaults,
): string {
  if (
    !group.company_ids.length ||
    group.company_ids.some((i) => !/^\d+$/.test(i))
  )
    throw new Error("Select a group with valid numeric company IDs.");
  if (!preset.query.trim())
    throw new Error("Select a Boolean preset with a non-empty query.");
  const u = new URL("https://www.linkedin.com/jobs/search/");
  u.searchParams.set("keywords", preset.query);
  u.searchParams.set("f_C", group.company_ids.join(","));
  if (options.date) u.searchParams.set("f_TPR", options.date);
  if (options.geoId) u.searchParams.set("geoId", options.geoId);
  if (options.sortBy) u.searchParams.set("sortBy", options.sortBy);
  return u.toString();
}
export function generateSearches(
  groups: Group[],
  preset: Preset,
  options: Options,
): SearchResult[] {
  if (!groups.length) return [];
  const out =
    options.mode === "merged"
      ? [
          {
            id: "merged",
            name: `Combined · ${groups.length} groups`,
            company_ids: [...new Set(groups.flatMap((g) => g.company_ids))],
            source_url: "",
          },
        ]
      : groups;
  return out.map((group) => ({
    group,
    preset,
    options: { ...options },
    url: generateUrl(group, preset, options),
  }));
}
export function validateConfig(value: unknown): Config {
  if (!value || typeof value !== "object")
    throw new Error("Choose a valid JSON configuration object.");
  const c = value as Config;
  if (c.schema_version !== "1.0.0")
    throw new Error(
      "Unsupported schema version. Import a Searchdesk 1.0.0 configuration.",
    );
  if (
    !Array.isArray(c.groups) ||
    !Array.isArray(c.boolean_presets) ||
    !c.groups.length ||
    !c.boolean_presets.length
  )
    throw new Error(
      "Configuration must include non-empty groups and boolean_presets arrays.",
    );
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const g of c.groups) {
    if (
      !g ||
      typeof g.id !== "string" ||
      !g.id ||
      typeof g.name !== "string" ||
      typeof g.source_url !== "string" ||
      !Array.isArray(g.company_ids) ||
      g.company_ids.some((i) => typeof i !== "string")
    )
      throw new Error(
        "Each group needs a string ID, name, source URL, and company IDs.",
      );
    if (ids.has(g.id)) throw new Error(`Duplicate group ID: ${g.id}`);
    ids.add(g.id);
    const parsed = parseGroup(g.name, g.source_url, g.id);
    if (parsed.company_ids.join(",") !== g.company_ids.join(","))
      throw new Error(`Company IDs for ${g.name} do not match its source URL.`);
  }
  for (const p of c.boolean_presets) {
    if (
      !p ||
      typeof p.id !== "string" ||
      !p.id ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      typeof p.query !== "string" ||
      !p.query.trim()
    )
      throw new Error("Each preset needs an ID, name, and non-empty query.");
    if (names.has(p.id)) throw new Error(`Duplicate preset ID: ${p.id}`);
    names.add(p.id);
  }
  return c;
}
export function mergeConfig(base: Config, incoming: Config): Config {
  const groups = [...base.groups];
  const presets = [...base.boolean_presets];
  for (const g of incoming.groups) {
    const existing = groups.find((x) => x.id === g.id);
    if (
      existing &&
      (existing.source_url !== g.source_url ||
        existing.name !== g.name ||
        existing.company_ids.join(",") !== g.company_ids.join(","))
    )
      throw new Error(
        `Group ID ${g.id} conflicts with an existing group. Give the imported group a new ID.`,
      );
    if (!existing) groups.push(g);
  }
  for (const p of incoming.boolean_presets) {
    const existing = presets.find((x) => x.id === p.id);
    if (existing && (existing.query !== p.query || existing.name !== p.name))
      throw new Error(
        `Preset ID ${p.id} conflicts with an existing preset. Use a new ID for edited queries.`,
      );
    if (!existing) presets.push(p);
  }
  return { ...base, groups, boolean_presets: presets };
}
export function csv(results: SearchResult[]): string {
  const cell = (v: string | number) =>
    `"${String(v)
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""')}"`;
  return [
    "group_id,group_name,number_of_company_ids,boolean_id,boolean_name,generated_url",
    ...results.map((r) =>
      [
        r.group.id,
        r.group.name,
        r.group.company_ids.length,
        r.preset.id,
        r.preset.name,
        r.url,
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");
}
