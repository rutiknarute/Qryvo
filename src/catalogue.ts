import sourceData from "./data/seed.json";
import { mergeConfig } from "./core";
import type { Config, Preset } from "./core";

// The app offers only these two exact, user-supplied queries.
export const catalogue: Config = sourceData;

export function presetLabel(preset: Preset): string {
  return preset.id === "new-grad" ? "New Graduate" : "Software & Development";
}

// Restore saved company groups without reintroducing retired/custom queries.
export function mergeCatalogue(
  incoming: Config,
  base: Config = catalogue,
): Config {
  const supported = new Set(catalogue.boolean_presets.map((p) => p.id));
  return mergeConfig(
    { ...base, boolean_presets: catalogue.boolean_presets },
    {
      ...incoming,
      boolean_presets: incoming.boolean_presets.filter((p) =>
        supported.has(p.id),
      ),
    },
  );
}
