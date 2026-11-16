import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  ArrowSquareOut,
  ArrowsClockwise,
  BracketsCurly,
  Buildings,
  CheckCircle,
  ClockCounterClockwise,
  Copy,
  DownloadSimple,
  FolderSimple,
  Info,
  Link,
  Sparkle,
  SquaresFour,
  UploadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import seedData from "./data/seed.json";
import CompaniesData from "./components/CompaniesData";
import { Database } from "@phosphor-icons/react";
import {
  csv,
  defaults,
  experienceLabels,
  generateSearches,
  generateUrl,
  displayGroupName,
  groupTitle,
  validateConfig,
} from "./core";
import type { Config, Options, SearchResult } from "./core";

import { catalogue, mergeCatalogue, presetLabel } from "./catalogue";

const seed = catalogue;
const dateLabels: Record<string, string> = {
  r86400: "Past 24 hours",
  r604800: "Past week",
  r2592000: "Past month",
  "": "Any time",
};
const geoLabels: Record<string, string> = {
  "103644278": "United States",
  "": "Anywhere",
};
type View = "builder" | "presets" | "companies-data" | "history" | "settings";
type Modal = { type: "inspect"; result: SearchResult } | null;
type HistoryItem = {
  id: string;
  created: string;
  groupIds: string[];
  presetId: string;
  options: Options;
};
function getStored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function initialConfig() {
  try {
    const stored = getStored<unknown>("searchdesk-config", null);
    return stored ? mergeCatalogue(validateConfig(stored)) : seed;
  } catch {
    return seed;
  }
}
function getView(): View {
  const v = location.hash.slice(1);
  return ["presets", "companies-data", "history", "settings"].includes(v)
    ? (v as View)
    : "builder";
}
function Button({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`button ${className}`} {...props}>
      {children}
    </button>
  );
}
function ModalFrame({
  title,
  description,
  children,
  close,
}: {
  title: string;
  description: string;
  children: ReactNode;
  close: () => void;
}) {
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function QueryText({ query }: { query: string }) {
  return (
    <code>
      {query.split(/(\bOR\b|\bAND\b|\bNOT\b)/g).map((s, i) => (
        <span key={i} className={/^(OR|AND|NOT)$/.test(s) ? "operator" : ""}>
          {s}
        </span>
      ))}
    </code>
  );
}
function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [view, setView] = useState<View>(getView);
  const [selected, setSelected] = useState<string[]>([]);
  const [presetId, setPresetId] = useState("new-grad");
  const [options, setOptions] = useState<Options>({ ...defaults });
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const v = getStored<unknown>("searchdesk-history", []);
    return Array.isArray(v)
      ? v
          .filter(
            (x) =>
              x &&
              typeof x.id === "string" &&
              typeof x.created === "string" &&
              !isNaN(Date.parse(x.created)) &&
              Array.isArray(x.groupIds) &&
              x.groupIds.every((g: unknown) => typeof g === "string") &&
              typeof x.presetId === "string" &&
              seed.boolean_presets.some((p) => p.id === x.presetId) &&
              x.options &&
              ["separate", "merged"].includes(x.options.mode) &&
              (x.options.experience === undefined ||
                Object.hasOwn(experienceLabels, x.options.experience)) &&
              ["date", "geoId", "sortBy"].every(
                (k) => typeof x.options[k] === "string",
              ),
          )
          .slice(0, 20)
      : [];
  });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [importError, setImportError] = useState("");
  const resultsRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const groups = config.groups;
  const presets = seed.boolean_presets;
  const preset = presets.find((p) => p.id === presetId) || presets[0];
  const chosen = groups.filter((g) => selected.includes(g.id));
  const totalCompanies = new Set(groups.flatMap((g) => g.company_ids)).size;
  const visible = groups;
  const allVisibleSelected =
    visible.length > 0 && visible.every((g) => selected.includes(g.id));
  const uniqueSelected = new Set(chosen.flatMap((g) => g.company_ids)).size;
  useEffect(() => {
    const fn = () => {
      setView(getView());
      requestAnimationFrame(() => mainRef.current?.focus());
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("searchdesk-config", JSON.stringify(config));
      localStorage.setItem("searchdesk-history", JSON.stringify(history));
    } catch {
      // The search still works when browser storage is unavailable.
    }
  }, [config, history]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const openModal = (m: Modal) => {
    setModal(m);
  };
  const toggle = (id: string) =>
    setSelected((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );
  const selectVisible = () =>
    setSelected((v) =>
      allVisibleSelected
        ? v.filter((id) => !visible.some((g) => g.id === id))
        : [...new Set([...v, ...visible.map((g) => g.id)])],
    );
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied to clipboard");
    } catch {
      setToast(
        "Clipboard unavailable. Open the link preview to select and copy the URL.",
      );
    }
  }
  function generate() {
    const generated = generateSearches(chosen, preset, options);
    setResults(generated);
    setHistory((v) =>
      [
        {
          id: crypto.randomUUID(),
          created: new Date().toISOString(),
          groupIds: [...selected],
          presetId: preset.id,
          options: { ...options },
        },
        ...v,
      ].slice(0, 20),
    );
    setToast(
      `${generated.length} search ${generated.length === 1 ? "link is" : "links are"} ready`,
    );
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      resultsRef.current?.focus({ preventScroll: true });
    });
  }
  function exportMatrix() {
    const matrix = presets.flatMap((p) =>
      generateSearches(groups, p, defaults),
    );
    download(
      csv(matrix),
      "searchdesk-all-searches.csv",
      "text/csv;charset=utf-8",
    );
    setToast(`Exported ${matrix.length} group and preset combinations`);
  }
  async function importFile(file?: File) {
    if (!file) return;
    setImportError("");
    try {
      if (file.size > 2_000_000)
        throw new Error("Choose a JSON configuration smaller than 2 MB.");
      const incoming = validateConfig(JSON.parse(await file.text()));
      const merged = mergeCatalogue(incoming, config);
      setConfig(merged);
      setToast(
        `Imported ${merged.groups.length - config.groups.length} groups and ${merged.boolean_presets.length - config.boolean_presets.length} presets`,
      );
    } catch (err) {
      setImportError((err as Error).message);
    }
    if (importRef.current) importRef.current.value = "";
  }

  const groupList = (
    <>
      <div className="group-tabs">
        <button
          className="text-button"
          onClick={selectVisible}
          disabled={!visible.length}
        >
          {allVisibleSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div className="company-list">
        {visible.map((g) => (
          <article
            className={`company-row ${selected.includes(g.id) ? "selected" : ""}`}
            key={g.id}
          >
            <label className="company-select">
              <input
                type="checkbox"
                checked={selected.includes(g.id)}
                onChange={() => toggle(g.id)}
                aria-label={`Select ${displayGroupName(g)}`}
              />
            </label>
            <strong
              className="company-name"
              title={`${groupTitle(g)} (${g.company_ids.length})`}
            >
              {groupTitle(g)} <span>({g.company_ids.length})</span>
            </strong>
            <div className="company-search-actions">
              {presets.map((p) => (
                <a
                  className={`button company-preset-link ${p.id === "new-grad" ? "new-grad-link" : "software-link"}`}
                  key={p.id}
                  href={generateUrl(g, p, options)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${displayGroupName(g)} with ${p.id === "new-grad" ? "New grad" : "Software"} on LinkedIn`}
                >
                  {p.id === "new-grad" ? "New grad" : "Software"}
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="group-selection">
        <span>
          <span className="selection-dot" />
          {selected.length} of {groups.length} groups selected
          {selected.length > 0 && (
            <span className="muted"> · {uniqueSelected} unique companies</span>
          )}
        </span>
        <button
          className="text-button"
          disabled={!selected.length}
          onClick={() => setSelected([])}
        >
          Clear selection
        </button>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="sidebar">
        <a href="#builder" className="brand">
          <img src="/favicon.svg" width="34" height="34" alt="" />
          <span>
            searchdesk<span className="brand-dot">.</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {(
            [
              { id: "builder", name: "Search builder", icon: SquaresFour },
              {
                id: "presets",
                name: "Boolean presets",
                icon: BracketsCurly,
                count: presets.length,
              },
              { id: "companies-data", name: "Companies Data", icon: Database },
            ] as const
          ).map((n) => (
            <a
              key={n.id}
              className={`nav-item ${view === n.id ? "active" : ""}`}
              href={`#${n.id}`}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon size={20} weight={view === n.id ? "fill" : "regular"} />
              <span>{n.name}</span>
              {"count" in n && <span className="nav-count">{n.count}</span>}
            </a>
          ))}
        </nav>
      </aside>
      <div className="main-shell">
        <main id="main-content" tabIndex={-1} ref={mainRef}>
          {view === "builder" && (
            <>
              <section className="stats-grid" aria-label="Your search library">
                <div className="stat-card">
                  <span className="stat-icon blue">
                    <Buildings size={22} />
                  </span>
                  <div>
                    <span>Company groups</span>
                    <strong>
                      {groups.length}
                      <small>ready to explore</small>
                    </strong>
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-icon violet">
                    <BracketsCurly size={22} />
                  </span>
                  <div>
                    <span>Boolean presets</span>
                    <strong>
                      {presets.length}
                      <small>precisely preserved</small>
                    </strong>
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-icon teal">
                    <SquaresFour size={22} />
                  </span>
                  <div>
                    <span>Unique companies</span>
                    <strong>
                      {totalCompanies}
                      <small>in your collection</small>
                    </strong>
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-icon amber">
                    <Link size={22} />
                  </span>
                  <div>
                    <span>Search combinations</span>
                    <strong>
                      {groups.length * presets.length}
                      <small>one click away</small>
                    </strong>
                  </div>
                </div>
              </section>
              <div className="section-intro">
                <div>
                  <h1 className="builder-title">Build your next search</h1>
                </div>
              </div>
              <div className="builder-grid">
                <section className="panel group-panel">{groupList}</section>
                <aside className="builder-right">
                  <section className="panel preset-panel">
                    <h2 className="intent-heading">Set your search intent</h2>
                    <fieldset className="preset-options">
                      <legend className="sr-only">Boolean preset</legend>
                      {presets.map((p) => (
                        <label
                          key={p.id}
                          className={`preset-option ${preset.id === p.id ? "selected" : ""}`}
                        >
                          <input
                            type="radio"
                            name="preset"
                            checked={preset.id === p.id}
                            onChange={() => setPresetId(p.id)}
                          />
                          <strong>{presetLabel(p)}</strong>
                        </label>
                      ))}
                    </fieldset>
                  </section>
                  <section className="panel filters-panel">
                    <div className="step-title">
                      <span className="step-number">3</span>
                      <div>
                        <h2>Fine-tune the details</h2>
                      </div>
                    </div>
                    <div className="filter-grid">
                      <label>
                        Date posted
                        <select
                          value={options.date}
                          onChange={(e) =>
                            setOptions((o) => ({ ...o, date: e.target.value }))
                          }
                        >
                          {Object.entries(dateLabels).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Location
                        <select
                          value={options.geoId}
                          onChange={(e) =>
                            setOptions((o) => ({ ...o, geoId: e.target.value }))
                          }
                        >
                          {Object.entries(geoLabels).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Sort by
                        <select
                          value={options.sortBy}
                          onChange={(e) =>
                            setOptions((o) => ({
                              ...o,
                              sortBy: e.target.value,
                            }))
                          }
                        >
                          <option value="DD">Most recent</option>
                          <option value="R">Most relevant</option>
                        </select>
                      </label>
                      <label>
                        Link output
                        <select
                          value={options.mode}
                          onChange={(e) =>
                            setOptions((o) => ({
                              ...o,
                              mode: e.target.value as Options["mode"],
                            }))
                          }
                        >
                          <option value="separate">One per group</option>
                          <option value="merged">Combine groups</option>
                        </select>
                      </label>
                      <label className="experience-filter">
                        Experience level
                        <select
                          value={options.experience ?? defaults.experience}
                          onChange={(e) =>
                            setOptions((o) => ({ ...o, experience: e.target.value }))
                          }
                        >
                          {Object.entries(experienceLabels).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {options.mode === "merged" ? (
                      <p className="filter-warning">
                        <WarningCircle size={16} /> Combined groups deduplicate
                        IDs. LinkedIn may limit large company lists.
                      </p>
                    ) : (
                      <p className="filter-hint">
                        <Info size={14} /> US location is the default for new
                        searches.
                      </p>
                    )}
                    <div className="generate-area">
                      <div>
                        <span>
                          {selected.length
                            ? `${selected.length} group${selected.length === 1 ? "" : "s"} selected`
                            : "Your search starts with a company group"}
                        </span>
                        {selected.length > 0 && (
                          <strong>
                            {options.mode === "merged" ? 1 : selected.length}{" "}
                            {options.mode === "merged" || selected.length === 1
                              ? "link"
                              : "links"}
                          </strong>
                        )}
                      </div>
                      <Button
                        className="primary generate-button"
                        disabled={!chosen.length}
                        onClick={generate}
                      >
                        <Sparkle size={19} /> Generate search links{" "}
                        <ArrowRight size={18} />
                      </Button>
                    </div>
                  </section>
                </aside>
              </div>
              {results.length > 0 && (
                <section
                  className="results-section"
                  ref={resultsRef}
                  tabIndex={-1}
                >
                  <div className="section-intro">
                    <div>
                      <h2>
                        Your search links{" "}
                        <span className="heading-count">{results.length}</span>
                      </h2>
                      <p>
                        Ready for your next opportunity. Open, copy, or take
                        them with you.
                      </p>
                    </div>
                    {results.length > 0 && (
                      <div className="result-bulk-actions">
                        <Button
                          onClick={() =>
                            copy(results.map((r) => r.url).join("\n"))
                          }
                        >
                          <Copy size={16} /> Copy all
                        </Button>
                        <Button
                          onClick={() =>
                            download(
                              csv(results),
                              "searchdesk-searches.csv",
                              "text/csv;charset=utf-8",
                            )
                          }
                        >
                          <DownloadSimple size={16} /> Export CSV
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="results-list">
                    {results.map((r, i) => (
                      <article
                        className="result-row"
                        key={`${r.group.id}-${r.preset.id}`}
                      >
                        <span className="result-icon">
                          <Link size={21} />
                        </span>
                        <div className="result-info">
                          <strong>{displayGroupName(r.group)}</strong>
                          <span>
                            {presetLabel(r.preset)}{" "}
                            <span className="dot">·</span>{" "}
                            {r.group.company_ids.length} companies{" "}
                            <span className="dot">·</span>{" "}
                            {dateLabels[r.options.date]}
                            {" "}<span className="dot">·</span>{" "}
                            {experienceLabels[r.options.experience ?? defaults.experience!]}
                          </span>
                          <small>Not live verified on LinkedIn</small>
                        </div>
                        <div className="result-actions">
                          <button
                            className="text-button"
                            onClick={() =>
                              openModal({ type: "inspect", result: r })
                            }
                          >
                            Inspect URL
                          </button>
                          <Button
                            className="icon-only"
                            aria-label={`Copy URL for ${displayGroupName(r.group)}`}
                            onClick={() => copy(r.url)}
                          >
                            <Copy size={18} />
                          </Button>
                          <a
                            className="button linkedin-button"
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open LinkedIn <ArrowSquareOut size={15} />
                          </a>
                        </div>
                        <span className="sr-only">Result {i + 1}</span>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
          {view === "presets" && (
            <>
              <div className="page-heading">
                <h1>Boolean presets</h1>
              </div>
              <div className="preset-library">
                {presets.map((p) => (
                  <article className="panel preset-library-card" key={p.id}>
                    <div className="panel-heading">
                      <h2>{presetLabel(p)}</h2>
                      <Button onClick={() => copy(p.query)}>
                        <Copy size={16} /> Copy query
                      </Button>
                    </div>
                    <div className="full-query">
                      <QueryText query={p.query} />
                    </div>
                    <footer>
                      <Button
                        onClick={() => {
                          setPresetId(p.id);
                          location.hash = "builder";
                        }}
                      >
                        Use this preset <ArrowRight size={16} />
                      </Button>
                    </footer>
                  </article>
                ))}
              </div>
            </>
          )}
          {view === "companies-data" && <CompaniesData groups={groups} />}
          {view === "history" && (
            <>
              <PageHeading
                eyebrow="PICK UP WHERE YOU LEFT OFF"
                title="Your search, continued."
                description="Your last 20 searches, saved in this browser."
              />
              {history.length ? (
                <div className="history-list">
                  {history.map((h) => {
                    const p = presets.find((x) => x.id === h.presetId);
                    return (
                      <article className="panel history-row" key={h.id}>
                        <span className="result-icon">
                          <ClockCounterClockwise size={23} />
                        </span>
                        <div>
                          <h2>{p ? presetLabel(p) : "Saved preset"}</h2>
                          <p>
                            {h.groupIds.length} groups ·{" "}
                            {dateLabels[h.options.date] || "Custom date"} ·{" "}
                            {new Date(h.created).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                        <Button
                          disabled={
                            !p ||
                            !h.groupIds.every((id) =>
                              groups.some((g) => g.id === id),
                            )
                          }
                          onClick={() => {
                            setSelected(h.groupIds);
                            setPresetId(h.presetId);
                            setOptions({ ...defaults, ...h.options });
                            setResults(
                              generateSearches(
                                groups.filter((g) => h.groupIds.includes(g.id)),
                                p!,
                                h.options,
                              ),
                            );
                            location.hash = "builder";
                            setToast(
                              "Search restored. Your links are ready below the builder.",
                            );
                          }}
                        >
                          Use again <ArrowsClockwise size={16} />
                        </Button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="panel empty-state">
                  <ClockCounterClockwise size={35} />
                  <h2>Your next search is the first chapter</h2>
                  <p>Generate a search to start your history.</p>
                  <a href="#builder" className="button primary">
                    Build your first search <ArrowRight size={16} />
                  </a>
                </div>
              )}
            </>
          )}
          {view === "settings" && (
            <>
              <PageHeading
                eyebrow="MAKE IT YOURS"
                title="Your search library"
                description="Keep your search library portable and your original sources close."
              />
              <div className="settings-grid">
                <section className="panel settings-card">
                  <span className="stat-icon blue">
                    <FolderSimple size={24} />
                  </span>
                  <h2>Back up your library</h2>
                  <p>
                    Export all {groups.length} company groups, {presets.length}{" "}
                    exact presets, and original source URLs as JSON.
                  </p>
                  <Button
                    onClick={() =>
                      download(
                        JSON.stringify(config, null, 2),
                        "searchdesk-config.json",
                        "application/json",
                      )
                    }
                  >
                    <DownloadSimple size={17} /> Export configuration
                  </Button>
                </section>
                <section className="panel settings-card">
                  <span className="stat-icon teal">
                    <UploadSimple size={24} />
                  </span>
                  <h2>Bring your library with you</h2>
                  <p>
                    Import a version 1.0.0 configuration. New entries are added;
                    existing data is kept intact.
                  </p>
                  <input
                    className="sr-only"
                    ref={importRef}
                    type="file"
                    accept="application/json,.json"
                    aria-label="Import JSON configuration"
                    onChange={(e) => importFile(e.target.files?.[0])}
                  />
                  <Button onClick={() => importRef.current?.click()}>
                    <UploadSimple size={17} /> Import configuration
                  </Button>
                  {importError && (
                    <p className="form-error" role="alert">
                      {importError}
                    </p>
                  )}
                </section>
                <section className="panel settings-card">
                  <span className="stat-icon violet">
                    <SquaresFour size={24} />
                  </span>
                  <h2>Every possible search</h2>
                  <p>
                    Export all {groups.length * presets.length} group and preset
                    combinations with the default entry-level, 24-hour, United States
                    filters.
                  </p>
                  <Button onClick={exportMatrix}>
                    <DownloadSimple size={17} /> Export search matrix
                  </Button>
                </section>
                <section className="panel settings-card">
                  <span className="stat-icon amber">
                    <Info size={24} />
                  </span>
                  <h2>A library you can trust</h2>
                  <p>
                    {groups.reduce((n, g) => n + g.company_ids.length, 0)}{" "}
                    company references · {totalCompanies} unique company IDs.
                  </p>
                  <p className="settings-note">
                    Schema 1.0.0 · Data stays in this browser.
                  </p>
                </section>
              </div>
              <section className="panel reference-panel">
                <div>
                  <h2>Earlier 50-company reference</h2>
                  <p>
                    Kept for provenance, separately from your 16 original
                    company groups.
                  </p>
                </div>
                <a
                  href={seedData.previous_reference.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button"
                >
                  View original reference <ArrowSquareOut size={16} />
                </a>
              </section>
            </>
          )}
        </main>
      </div>
      <div
        className={`toast ${toast ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            <CheckCircle size={19} />
            <span>{toast}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>
      {modal?.type === "inspect" && (
        <ModalFrame
          title="Your generated search"
          description={`${displayGroupName(modal.result.group)} · ${presetLabel(modal.result.preset)}`}
          close={() => setModal(null)}
        >
          <div className="validated-label">
            <CheckCircle size={18} /> URL format validated · Not live verified
          </div>
          <dl className="filter-details">
            <div>
              <dt>Companies</dt>
              <dd>
                {modal.result.group.company_ids.length} IDs · Source order
                preserved
              </dd>
            </div>
            <div>
              <dt>Date posted</dt>
              <dd>{dateLabels[modal.result.options.date]}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>
                {geoLabels[modal.result.options.geoId] ||
                  modal.result.options.geoId}
              </dd>
            </div>
            <div>
              <dt>Sort</dt>
              <dd>
                {modal.result.options.sortBy === "DD"
                  ? "Most recent"
                  : "Most relevant"}
              </dd>
            </div>
            <div>
              <dt>Experience level</dt>
              <dd>{experienceLabels[modal.result.options.experience ?? defaults.experience!]}</dd>
            </div>
            <div>
              <dt>Exact query</dt>
              <dd>{modal.result.preset.query.length} characters · Preserved</dd>
            </div>
          </dl>
          <label className="field-label">
            Full URL
            <textarea
              readOnly
              rows={6}
              value={modal.result.url}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <p className="muted text-sm">
            LinkedIn may interpret long queries or large company filters
            differently. Check the active filters after opening.
          </p>
          <div className="dialog-actions">
            {modal.result.group.source_url && (
              <a
                className="text-button"
                href={modal.result.group.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Original source <ArrowSquareOut size={14} />
              </a>
            )}
            <Button onClick={() => copy(modal.result.url)}>
              <Copy size={17} /> Copy URL
            </Button>
            <a
              className="button primary"
              href={modal.result.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open LinkedIn <ArrowSquareOut size={16} />
            </a>
          </div>
        </ModalFrame>
      )}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div className="eyebrow">
        <span />
        {eyebrow}
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
