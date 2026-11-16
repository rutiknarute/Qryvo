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
  assert.equal(screen.queryByText("Count differs"), null);
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

test("Companies Data opens each saved URL membership without changing IDs or counts", async () => {
  render(<App />);
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  assert.deepEqual(
    within(nav)
      .getAllByRole("link")
      .map((x) => x.getAttribute("href")),
    ["#builder", "#presets", "#companies-data"],
  );
  assert.equal(screen.queryByRole("button", { name: "Add group" }), null);
  assert.equal(
    screen.queryByRole("heading", { name: "Choose your companies" }),
    null,
  );
  assert.equal(screen.queryByText("16 company groups"), null);
  await user.click(screen.getByRole("link", { name: "Companies Data" }));
  await screen.findByRole("heading", { name: "Companies Data" });
  for (const [i, name] of [
    "Top 1 (25)",
    "Top 4 (60)",
    "Top 8-9 (100)",
  ].entries()) {
    const group = seed.groups[[0, 3, 7][i]];
    const toggle = screen.getByRole("button", { name });
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    await user.click(toggle);
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    const panel = screen.getByRole("region", { name: `${name} companies` });
    const links = within(panel).getAllByRole("link", {
      name: /Company ID/,
    }) as HTMLAnchorElement[];
    assert.equal(links.length, group.company_ids.length);
    assert.deepEqual(
      links.map((x) => new URL(x.href).pathname),
      group.company_ids.map((id) => `/company/${id}/`),
    );
    assert.equal(
      (
        within(panel).getByRole("link", {
          name: "View original URL",
        }) as HTMLAnchorElement
      ).href,
      group.source_url,
    );
    assert.ok(
      links.every(
        (x) => x.target === "_blank" && x.rel === "noopener noreferrer",
      ),
    );
    await user.click(toggle);
    assert.equal(
      screen.queryByRole("region", { name: `${name} companies` }),
      null,
    );
  }
});

test("the compact company list retains both direct query actions and batch selection", async () => {
  render(<App />);
  assert.equal(screen.getAllByRole("checkbox").length, 16);
  assert.equal(
    screen.queryByRole("textbox", { name: "Search company groups" }),
    null,
  );
  const grad = screen.getByRole("link", {
    name: "Open Top 4 (60) with New grad on LinkedIn",
  }) as HTMLAnchorElement;
  const software = screen.getByRole("link", {
    name: "Open Top 4 (60) with Software on LinkedIn",
  }) as HTMLAnchorElement;
  assert.equal(
    new URL(grad.href).searchParams.get("keywords"),
    seed.boolean_presets[0].query,
  );
  assert.equal(
    new URL(software.href).searchParams.get("keywords"),
    seed.boolean_presets[1].query,
  );
  await user.click(screen.getByRole("checkbox", { name: "Select Top 4 (60)" }));
  await user.click(
    screen.getByRole("radio", { name: "Software & Development" }),
  );
  await user.click(
    screen.getByRole("button", { name: /Generate search links/ }),
  );
  assert.equal(
    (
      (await screen.findByRole("link", {
        name: "Open LinkedIn",
      })) as HTMLAnchorElement
    ).href,
    software.href,
  );
});

test("JSON import adds new groups, rejects conflicts atomically, and stays available from navigation", async () => {
  location.hash = "settings";
  render(<App />);
  await screen.findByRole("heading", { name: "Your search library" });
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
  assert.equal(screen.queryByRole("link", { name: /Company groups/ }), null);
  await user.click(screen.getByRole("link", { name: "Search builder" }));
  await screen.findByRole("heading", { name: "Build your next search" });
  assert.ok(
    screen.getByRole("checkbox", { name: "Select Imported collection" }),
  );
});

test("existing browsers lose retired presets while retaining saved groups, and the selector stays minimal", async () => {
  const custom = {
    id: "custom-saved",
    name: "Saved collection",
    company_ids: ["19", "23"],
    source_url: "https://www.linkedin.com/jobs/search/?f_C=19,23",
  };
  localStorage.setItem(
    "searchdesk-config",
    JSON.stringify({
      ...seed,
      groups: [...seed.groups, custom],
      boolean_presets: [
        ...seed.boolean_presets,
        { id: "new-grad-software-ai", name: "Retired query", query: "legacy" },
      ],
    }),
  );
  render(<App />);
  const newGrad = screen.getByRole("radio", {
    name: "New Graduate",
  }) as HTMLInputElement;
  assert.equal(newGrad.checked, true);
  assert.equal(screen.getAllByRole("radio").length, 2);
  assert.equal(screen.queryByText("Retired query"), null);
  for (const text of [
    "Workspace",
    "WORKSPACE",
    "Saved on this browser",
    "Your personal space",
    "Help & getting started",
    "Choose a Boolean preset.",
    "QUERY PREVIEW",
  ])
    assert.equal(screen.queryByText(text), null);
  assert.equal(screen.queryByRole("link", { name: "Data and settings" }), null);
  assert.equal(screen.queryByRole("link", { name: "Data & settings" }), null);
  const link = screen.getByRole("link", {
    name: "Open Saved collection with New grad on LinkedIn",
  }) as HTMLAnchorElement;
  assert.equal(
    new URL(link.href).searchParams.get("keywords"),
    seed.boolean_presets[0].query,
  );
  const stored = JSON.parse(localStorage.getItem("searchdesk-config")!);
  assert.equal(stored.groups.length, 17);
  assert.deepEqual(stored.boolean_presets, seed.boolean_presets);
  await user.click(screen.getByRole("link", { name: /Boolean presets/ }));
  await screen.findByRole("heading", { name: "Boolean presets" });
  assert.ok(screen.getByRole("heading", { name: "New Graduate" }));
  assert.ok(screen.getByRole("heading", { name: "Software & Development" }));
  for (const p of seed.boolean_presets)
    assert.ok(
      screen.getByText(
        (_, el) => el?.tagName === "CODE" && el.textContent === p.query,
      ),
    );
  assert.equal(screen.queryByText(/Exact original preset/), null);
  assert.equal(
    screen.queryByRole("button", { name: "Add custom preset" }),
    null,
  );
});

test("each company row shows its count and two direct buttons with exact queries and current filters", async () => {
  render(<App />);
  const names = [
    "Top 1 (25)",
    "Top 2 (25)",
    "Top 3 (50)",
    "Top 4 (60)",
    "Top 5 (60)",
    "Top 6 (60)",
    "Top 7 (60)",
    "Top 8-9 (100)",
    "Top 10-11 (100)",
    "Forbes (40)",
    "YC & others (50)",
    "Ashby (50)",
    "Greenhouse (50)",
    "Cloud (50)",
    "YC (100)",
    "Play (100)",
  ];
  const buttons = screen.getAllByRole("link", {
    name: /^Open .+ with (New grad|Software) on LinkedIn$/,
  }) as HTMLAnchorElement[];
  assert.equal(buttons.length, 32);
  for (const [i, name] of names.entries()) {
    for (const [j, label] of ["New grad", "Software"].entries()) {
      const button = screen.getByRole("link", {
        name: `Open ${name} with ${label} on LinkedIn`,
      }) as HTMLAnchorElement;
      assert.equal(button.textContent?.trim(), label);
      const url = new URL(button.href);
      assert.equal(url.pathname, "/jobs/search-results/");
      assert.equal(
        url.searchParams.get("keywords"),
        seed.boolean_presets[j].query,
      );
      assert.deepEqual(
        url.searchParams.get("f_C")!.split(","),
        seed.groups[i].company_ids,
      );
      assert.equal(button.target, "_blank");
      assert.equal(button.rel, "noopener noreferrer");
      const row = button.closest("article")!;
      assert.equal(
        row
          .querySelector(".company-name")!
          .textContent!.replace(/\s+/g, " ")
          .trim(),
        name,
      );
      assert.equal(within(row).getAllByRole("link").length, 2);
      assert.equal(within(row).queryByRole("button"), null);
    }
  }
  for (const text of [
    "A few choices. A more focused path forward.",
    "Private & browser-based",
  ])
    assert.equal(screen.queryByText(text), null);
  await user.selectOptions(screen.getByLabelText("Date posted"), "r604800");
  for (const label of ["New grad", "Software"]) {
    const button = screen.getByRole("link", {
      name: `Open Top 4 (60) with ${label} on LinkedIn`,
    }) as HTMLAnchorElement;
    assert.equal(new URL(button.href).searchParams.get("f_TPR"), "r604800");
  }
  const stored = JSON.parse(localStorage.getItem("searchdesk-config")!);
  assert.deepEqual(stored.groups, seed.groups);
});
