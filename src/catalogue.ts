import sourceData from "./data/seed.json";
import type { Config, Preset } from "./core";

// Added from the user's later example; the two supplied original queries remain verbatim.
export const examplePreset: Preset = {
  id: "new-grad-software-ai",
  name: "New Grad · Software & AI",
  query:
    '("new grad" OR "new graduate" OR "early career" OR "university graduate" OR "entry level") AND ("software engineer" OR "software developer" OR "AI engineer")',
};

export const catalogue: Config = {
  ...sourceData,
  boolean_presets: [...sourceData.boolean_presets, examplePreset],
};
