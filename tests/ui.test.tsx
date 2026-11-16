import { before, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { Config } from "../src/core.ts";
import { readFileSync } from "node:fs";
const seed = JSON.parse(
  readFileSync(new URL("../src/data/seed.json", import.meta.url), "utf8"),
) as Config;
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://searchdesk.test/",
});
for (const k of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "MutationObserver",
  "Event",
  "CustomEvent",
  "Node",
  "NodeFilter",
  "Element",
  "HTMLSelectElement",
  "HTMLFormElement",
])
  Object.defineProperty(globalThis, k, {
    value: (dom.window as any)[k],
    configurable: true,
    writable: true,
  });
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
Object.defineProperty(globalThis, "getComputedStyle", {
  value: dom.window.getComputedStyle.bind(dom.window),
  configurable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: dom.window.localStorage,
  configurable: true,
});
Object.defineProperty(globalThis, "location", {
  value: dom.window.location,
  configurable: true,
});
Object.defineProperty(globalThis, "FormData", {
  value: dom.window.FormData,
  configurable: true,
});
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (cb: FrameRequestCallback) => setTimeout(cb, 0),
  configurable: true,
});
Object.defineProperty(globalThis, "matchMedia", {
  value: () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }),
  configurable: true,
});
Object.defineProperty(dom.window.HTMLElement.prototype, "scrollIntoView", {
  value() {},
  configurable: true,
});
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  value: true,
  writable: true,
});
const React = await import("react");
const { render, screen, cleanup, waitFor, within } =
  await import("@testing-library/react");
const userEvent = (await import("@testing-library/user-event")).default;
const App = (await import("../src/App.tsx")).default;
let user: ReturnType<typeof userEvent.setup>;
before(() => {
  user = userEvent.setup({ document: dom.window.document });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  location.hash = "";
});

test("initial state, all-group batch, preset switch, exact URL copy and inspect", async () => {
  render(<App />);
  const generate = screen.getByRole("button", {
    name: /Generate search links/,
  }) as HTMLButtonElement;
  assert.equal(generate.disabled, true);
  assert.equal(screen.getAllByRole("checkbox").length, 16);
  assert.equal(screen.getAllByText("Count differs").length, 5);
  await user.click(screen.getByRole("button", { name: "Select all" }));
  assert.equal(
    screen
      .getAllByRole("checkbox")
      .filter((c) => (c as HTMLInputElement).checked).length,
    16,
  );
  await user.click(
    screen.getByRole("radio", { name: /Software & Development/ }),
  );
  await user.click(generate);
  const links = await screen.findAllByRole("link", { name: "Open LinkedIn" });
  assert.equal(links.length, 16);
  const first = links[0] as HTMLAnchorElement;
  assert.equal(
    new URL(first.href).searchParams.get("keywords"),
    seed.boolean_presets[1].query,
  );
  assert.equal(
    new URL(first.href).searchParams.get("f_C"),
    seed.groups[0].company_ids.join(","),
  );
  assert.equal(first.target, "_blank");
  assert.equal(first.rel, "noopener noreferrer");
  await user.click(
    screen.getByRole("button", { name: "Copy URL for Top 1 (25)" }),
  );
  assert.equal(await navigator.clipboard.readText(), first.href);
  await user.click(screen.getAllByRole("button", { name: "Inspect URL" })[0]);
  const dialog = await screen.findByRole("dialog");
  assert.equal(
    (
      within(dialog).getByRole("textbox", {
        name: "Full URL",
      }) as HTMLTextAreaElement
    ).value,
    first.href,
  );
  await user.keyboard("{Escape}");
  await waitFor(() => assert.equal(screen.queryByRole("dialog"), null));
  const history = JSON.parse(localStorage.getItem("searchdesk-history")!);
  assert.equal(history.length, 1);
  assert.equal(history[0].groupIds.length, 16);
});

test("custom group validates URL, retains exact source and IDs, persists and stays selectable", async () => {
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Add group" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(
    within(dialog).getByRole("textbox", { name: "Group name" }),
    "My target companies",
  );
  await user.type(
    within(dialog).getByRole("textbox", { name: "Original LinkedIn Jobs URL" }),
    "https://example.com/jobs/search/?f_C=1",
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Save company group" }),
  );
  assert.match(screen.getByRole("alert").textContent!, /linkedin.com/);
  const url =
    "https://www.linkedin.com/jobs/search/?f_C=002%2C1%2C002&currentJobId=5";
  await user.clear(
    within(dialog).getByRole("textbox", { name: "Original LinkedIn Jobs URL" }),
  );
  await user.type(
    within(dialog).getByRole("textbox", { name: "Original LinkedIn Jobs URL" }),
    url,
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Save company group" }),
  );
  await waitFor(() => assert.equal(screen.queryByRole("dialog"), null));
  await user.click(
    screen.getByRole("checkbox", { name: "Select My target companies" }),
  );
  await user.click(
    screen.getByRole("button", { name: /Generate search links/ }),
  );
  const link = (await screen.findByRole("link", {
    name: "Open LinkedIn",
  })) as HTMLAnchorElement;
  assert.equal(new URL(link.href).searchParams.get("f_C"), "002,1,002");
  const stored = JSON.parse(localStorage.getItem("searchdesk-config")!);
  assert.equal(stored.groups.length, 17);
  assert.equal(stored.groups.at(-1).source_url, url);
});

test("custom preset preserves exact spacing, source queries survive, and favorite filter works", async () => {
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Favorite Top 1 (25)" }));
  await user.click(screen.getByRole("button", { name: /Favorites/ }));
  assert.equal(screen.getAllByRole("checkbox").length, 1);
  await user.click(screen.getByRole("checkbox", { name: "Select Top 1 (25)" }));
  await user.click(screen.getByRole("button", { name: "Add custom preset" }));
  const dialog = await screen.findByRole("dialog");
  await user.type(
    within(dialog).getByRole("textbox", { name: "Preset name" }),
    "Precise & personal",
  );
  const query = '  ("C++" OR "A&B") NOT "senior"  ';
  await user.type(
    within(dialog).getByRole("textbox", { name: "Exact Boolean query" }),
    query,
  );
  await user.click(within(dialog).getByRole("button", { name: "Save preset" }));
  await waitFor(() => assert.equal(screen.queryByRole("dialog"), null));
  await user.click(
    screen.getByRole("button", { name: /Generate search links/ }),
  );
  const link = (await screen.findByRole("link", {
    name: "Open LinkedIn",
  })) as HTMLAnchorElement;
  assert.equal(new URL(link.href).searchParams.get("keywords"), query);
  const stored = JSON.parse(localStorage.getItem("searchdesk-config")!);
  assert.deepEqual(stored.boolean_presets.slice(0, 2), seed.boolean_presets);
});

test("JSON import adds new groups, rejects conflicts atomically, and stays available from navigation", async () => {
  render(<App />);
  await user.click(screen.getByRole("link", { name: "Data and settings" }));
  await screen.findByRole("heading", { name: "Your workspace. Your data." });
  const input = screen.getByLabelText(
    "Import JSON configuration",
  ) as HTMLInputElement;
  const custom = {
    id: "custom-import",
    name: "Imported collection",
    company_ids: ["19", "23"],
    source_url: "https://www.linkedin.com/jobs/search/?f_C=19,23",
  };
  const file = new dom.window.File(["{}"], "library.json", {
    type: "application/json",
  });
  Object.defineProperty(file, "text", {
    value: async () =>
      JSON.stringify({ ...seed, groups: [...seed.groups, custom] }),
  });
  await user.upload(input, file);
  await waitFor(() =>
    assert.equal(
      JSON.parse(localStorage.getItem("searchdesk-config")!).groups.length,
      17,
    ),
  );
  const before = localStorage.getItem("searchdesk-config");
  const bad = new dom.window.File(["{}"], "bad.json", {
    type: "application/json",
  });
  Object.defineProperty(bad, "text", {
    value: async () =>
      JSON.stringify({
        ...seed,
        boolean_presets: [{ ...seed.boolean_presets[0], query: "changed" }],
      }),
  });
  await user.upload(input, bad);
  await waitFor(() =>
    assert.match(screen.getByRole("alert").textContent!, /conflicts/),
  );
  assert.equal(localStorage.getItem("searchdesk-config"), before);
  await user.click(screen.getByRole("link", { name: /Company groups/ }));
  await screen.findByRole("heading", {
    name: "Good companies. Great possibilities.",
  });
  assert.ok(
    screen.getByRole("checkbox", { name: "Select Imported collection" }),
  );
});

test("the example preset becomes available in an existing browser and the open link uses current selections", async () => {
  const { examplePreset } = await import("../src/catalogue.ts");
  localStorage.setItem("searchdesk-config", JSON.stringify(seed));
  render(<App />);
  const defaultRadio = screen.getByRole("radio", {
    name: /New Grad · Software & AI/,
  }) as HTMLInputElement;
  assert.equal(defaultRadio.checked, true);
  await user.click(screen.getByRole("checkbox", { name: "Select Top 1 (25)" }));
  await user.click(
    screen.getByRole("button", { name: /Generate search links/ }),
  );
  const opened = (await screen.findByRole("link", {
    name: "Open LinkedIn",
  })) as HTMLAnchorElement;
  const first = new URL(opened.href);
  assert.equal(first.pathname, "/jobs/search-results/");
  assert.equal(first.searchParams.get("keywords"), examplePreset.query);
  assert.equal(
    first.searchParams.get("f_C"),
    seed.groups[0].company_ids.join(","),
  );
  assert.equal(first.searchParams.get("geoId"), "103644278");
  assert.equal(first.searchParams.get("f_TPR"), "r86400");
  await user.selectOptions(screen.getByLabelText("Date posted"), "r604800");
  await user.selectOptions(screen.getByLabelText("Location"), "");
  await user.selectOptions(screen.getByLabelText("Sort by"), "R");
  await user.click(
    screen.getByRole("button", { name: /Generate search links/ }),
  );
  const updated = new URL(
    (screen.getByRole("link", { name: "Open LinkedIn" }) as HTMLAnchorElement)
      .href,
  );
  assert.equal(updated.searchParams.get("keywords"), examplePreset.query);
  assert.equal(updated.searchParams.get("f_C"), first.searchParams.get("f_C"));
  assert.equal(updated.searchParams.get("f_TPR"), "r604800");
  assert.equal(updated.searchParams.has("geoId"), false);
  assert.equal(updated.searchParams.get("sortBy"), "R");
  assert.equal(
    JSON.parse(localStorage.getItem("searchdesk-config")!).boolean_presets
      .length,
    3,
  );
});
