/**
 * THE TAB BAR — the `origin-emdash-tabs:bar` field widget (see `index.js`),
 * and the plugin's settings page.
 *
 * TWO WAYS TO DECLARE TABS, the first one wins:
 *
 * 1. MARKER FIELDS, from the admin. A `json` field whose slug starts with
 *    `tab_` (Content Types → Add field → JSON, e.g. "Hero" / `tab_hero`) opens
 *    a tab named by its label; every field after it, up to the next marker,
 *    belongs to that tab. Fields before the first marker go in a first tab
 *    (`options.first`, "General" by default). Moving a field to another tab is
 *    dragging it in the content type's field list. The markers themselves are
 *    hidden in the editor: they store nothing. No sync step, no token: the bar
 *    reads the field order itself, with the editor's own session.
 * 2. A LIST in the bar field's options, `options.tabs: [{ name, fields }]`,
 *    written by code (`tabsField` in a seed, `syncTabs`).
 *
 * The bar reads the collection's fields IN EDITOR ORDER — from the editor
 * column itself, before the first paint (so the tabs are there from the first
 * frame, nothing jumps), and from the schema API
 * (`/_emdash/api/schema/collections/<c>?includeFields=true`) only when the
 * column shows no marker. With that order
 * it finds every field's block BY POSITION in the editor column — each field
 * is a direct child of one column, in that order — which reaches every field
 * type, including those whose control carries no id (selects, other plugins'
 * widgets). If the column doesn't match the order (an admin change), it falls
 * back to ids: a field's control carries `field-<slug>` (an image field: its
 * whole block; a repeater: its sub-fields, `field-<slug>.<i>.<sub>`).
 *
 * Hidden, not unmounted: what was typed in one tab is saved with the rest. An
 * invalid field in a hidden tab brings its tab back on the `invalid` event.
 * The open tab is remembered per collection for the browser session.
 *
 * Plain `createElement`, no JSX: the file is used as shipped. Inline styles on
 * the admin's theme variables (`--color-kumo-*`): its Tailwind is precompiled.
 */
import { createElement as h, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Switch } from "@cloudflare/kumo";

const MARKER_PREFIX = "tab_";
const WIDGET = "origin-emdash-tabs:bar";
const FR = typeof document !== "undefined" && /^fr/i.test(document.documentElement.lang || navigator.language || "");

const collectionOfPage = () => (typeof location === "undefined" ? "" : (location.pathname.split("/content/")[1]?.split("/")[0] ?? ""));
const storageKey = () => `origin-emdash-tabs:${collectionOfPage()}`;
const recall = () => {
  try {
    return Number(sessionStorage.getItem(storageKey())) || 0;
  } catch {
    return 0;
  }
};
const remember = (i) => {
  try {
    sessionStorage.setItem(storageKey(), String(i));
  } catch {
    /* storage unavailable: the tab is simply not remembered */
  }
};

const api = async (method, path, body) => {
  const r = await fetch(`/_emdash/api/${path}`, {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json", "X-EmDash-Request": "1", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || d?.success === false) throw new Error(d?.error?.message ?? `${r.status}`);
  return d?.data ?? d;
};

/** The collection's fields in editor order: `[{ slug, label, type }]`. */
const fieldsOf = async (collection) => {
  const { item } = await api("GET", `schema/collections/${encodeURIComponent(collection)}?includeFields=true`);
  return (item?.fields ?? []).map((f) => ({ slug: f.slug, label: f.label ?? f.slug, type: f.type }));
};

const isMarker = (f) => f.type === "json" && f.slug.startsWith(MARKER_PREFIX);

/**
 * The collection's fields as the EDITOR shows them, read from the column
 * itself: one entry per block, in order, `{ slug, label, type }` — `type` is
 * `"json"` for a `tab_…` marker (its control carries `field-tab_…`), unknown
 * otherwise. Read in a layout effect, before the first paint, so the tabs are
 * there from the first frame: no fields flashing, then disappearing.
 */
const fieldsOfColumn = (column, bar, barSlug) =>
  [...column.children].map((block, i) => {
    // The bar's own block is the bar; a block whose control carries no id (a
    // select, another plugin's widget) gets a positional key — tabs group
    // blocks by position between markers, so a name isn't needed.
    if (bar && block.contains(bar)) return { slug: barSlug, label: "", type: "json" };
    const ids = [block.id, ...[...block.querySelectorAll("[id^='field-']")].map((e) => e.id)].filter((x) => x?.startsWith("field-"));
    const slug = (ids[0] ?? "").replace(/^field-/, "").split(".")[0] || `#${i}`;
    return { slug, label: labelOf(block) || slug, type: slug.startsWith(MARKER_PREFIX) ? "json" : undefined };
  });

/** A field block's label, without the admin's "(optional)" / "*" markers. */
const labelOf = (block) => {
  const label = block.querySelector("label");
  if (!label) return "";
  const copy = label.cloneNode(true);
  for (const el of copy.querySelectorAll("*")) if (/^(\(.*\)|\*)$/.test(el.textContent.trim())) el.remove();
  return copy.textContent.replace(/\s+/g, " ").trim();
};

/** Tabs from marker fields; `[]` when the collection has none. */
const tabsFromMarkers = (fields, barSlug, firstName) => {
  if (!fields.some(isMarker)) return [];
  const tabs = [{ name: firstName, fields: [] }];
  for (const f of fields) {
    if (f.slug === barSlug) continue;
    if (isMarker(f)) tabs.push({ name: f.label, fields: [] });
    else tabs[tabs.length - 1].fields.push(f.slug);
  }
  return tabs.filter((t, i) => i > 0 || t.fields.length);
};

/** The tab of a form element: the tab of the field block it belongs to. */
const tabOf = (tabs, el, order) => {
  const block = el.closest("[data-origin-tabs] > *");
  if (!block) return -1;
  if (order) {
    const slug = order[[...block.parentElement.children].indexOf(block)];
    return tabs.findIndex((t) => t.fields.includes(slug));
  }
  const ids = [block.id, ...[...block.querySelectorAll("[id^='field-']")].map((e) => e.id)];
  return tabs.findIndex((t) => t.fields.some((s) => ids.some((i) => i === `field-${s}` || i.startsWith(`field-${s}.`))));
};

/** Every selector that matches the block of field `s` inside column `m` (by id). */
const blockSelectors = (m, s) => [
  `[data-origin-tabs="${m}"] > :has([id="field-${s}"])`,
  `[data-origin-tabs="${m}"] > [id="field-${s}"]`,
  `[data-origin-tabs="${m}"] > :has([id^="field-${s}."])`,
];

function Bar({ options, id }) {
  const barSlug = String(id ?? "").replace(/^field-/, "");
  const firstName = options?.first ?? (FR ? "Général" : "General");
  const [fields, setFields] = useState(null); // the collection's fields, editor order
  const root = useRef(null);
  // First, from the editor column (before paint). The schema API is only the
  // fallback, for a column whose markers can't be read (no marker found there).
  useLayoutEffect(() => {
    const column = root.current?.parentElement;
    const dom = column ? fieldsOfColumn(column, root.current, barSlug) : [];
    if (dom.some(isMarker)) return void setFields(dom);
    let live = true;
    const c = collectionOfPage();
    if (c) fieldsOf(c).then((f) => live && setFields(f)).catch(() => live && setFields([]));
    return () => (live = false);
  }, []);

  const markers = useMemo(() => (fields ?? []).filter(isMarker).map((f) => f.slug), [fields]);
  const tabs = useMemo(() => {
    const fromMarkers = tabsFromMarkers(fields ?? [], barSlug, firstName);
    if (fromMarkers.length) return fromMarkers;
    return Array.isArray(options?.tabs) ? options.tabs.filter((t) => t && Array.isArray(t.fields)) : [];
  }, [fields, options, barSlug, firstName]);

  const [active, setActive] = useState(() => recall());
  const mark = `t${useId().replace(/[^a-z0-9]/gi, "")}`;
  // Positional mode: the column has exactly one block per field, in order.
  const [order, setOrder] = useState(null);

  useLayoutEffect(() => {
    const column = root.current?.parentElement;
    if (!column) return;
    column.setAttribute("data-origin-tabs", mark);
    const fromSchema = fields?.length ? fields.map((f) => f.slug) : null;
    const fromOptions = Array.isArray(options?.order) ? options.order : null;
    const wanted = [fromSchema, fromOptions].find((o) => o && column.children.length === o.length) ?? null;
    setOrder(wanted);
    const onInvalid = (e) => {
      const i = tabOf(tabs, e.target, wanted);
      if (i >= 0) setActive(i);
    };
    column.addEventListener("invalid", onInvalid, true);
    return () => {
      column.removeAttribute("data-origin-tabs");
      column.removeEventListener("invalid", onInvalid, true);
    };
  }, [mark, tabs, options, fields]);

  const current = Math.min(active, Math.max(tabs.length - 1, 0));
  useEffect(() => remember(current), [current]);

  // Until the fields are read, an empty placeholder: the ref needs a node.
  if (!tabs.length) return h("div", { ref: root, hidden: fields !== null });
  // The inactive tabs' fields, and the markers always: they store nothing.
  const hidden = [...tabs.flatMap((t, i) => (i === current ? [] : t.fields)), ...markers];
  const css = (
    order
      ? hidden
          .map((s) => order.indexOf(s))
          .filter((k) => k >= 0)
          .map((k) => `[data-origin-tabs="${mark}"] > :nth-child(${k + 1})`)
      : hidden.flatMap((s) => blockSelectors(mark, s))
  ).join(",\n");
  const line = "1px solid var(--color-kumo-line)";
  const surface = "var(--color-kumo-canvas, var(--color-kumo-base))";

  return h(
    "div",
    { ref: root, style: { position: "sticky", top: 0, zIndex: 10, background: surface, borderBottom: line, paddingTop: 4 } },
    css ? h("style", null, `${css} { display: none !important; }`) : null,
    h(
      "div",
      { role: "tablist", "aria-label": "Sections", style: { display: "flex", flexWrap: "wrap", gap: 4 } },
      tabs.map((t, i) => {
        const on = i === current;
        return h(
          "button",
          {
            key: `${i}:${t.name}`,
            type: "button",
            role: "tab",
            "aria-selected": on,
            onClick: () => setActive(i),
            style: {
              marginBottom: -1,
              padding: "8px 14px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              borderRadius: "6px 6px 0 0",
              border: on ? line : "1px solid transparent",
              borderBottomColor: on ? surface : "transparent",
              background: on ? surface : "transparent",
              color: on ? "inherit" : "color-mix(in srgb, currentColor 60%, transparent)",
            },
          },
          t.name,
        );
      }),
    ),
  );
}

// ——— The settings page: turn tabs on per collection ———

const P = FR
  ? {
      title: "Onglets",
      intro: "Active la barre d'onglets sur une collection, puis, dans Content Types, ajoute un champ JSON par onglet : son libellé est le nom de l'onglet, son slug commence par « tab_ » (ex. « Hero » / tab_hero). Tous les champs placés après lui, jusqu'au prochain, forment l'onglet ; glisse-les dans la liste des champs pour les ranger.",
      loading: "Chargement…",
      error: "Échec :",
      tabs: (n) => (n ? `${n} onglet${n > 1 ? "s" : ""} (champs tab_…)` : "aucun champ tab_… pour l'instant"),
      byCode: "onglets définis par le code (options.tabs)",
    }
  : {
      title: "Tabs",
      intro: 'Turn the tab bar on for a collection, then, in Content Types, add one JSON field per tab: its label is the tab\'s name and its slug starts with "tab_" (e.g. "Hero" / tab_hero). Every field after it, up to the next one, belongs to that tab; drag fields in the field list to arrange them.',
      loading: "Loading…",
      error: "Failed:",
      tabs: (n) => (n ? `${n} tab${n > 1 ? "s" : ""} (tab_… fields)` : "no tab_… field yet"),
      byCode: "tabs defined in code (options.tabs)",
    };

function Settings() {
  const [rows, setRows] = useState(null); // [{ slug, label, bar, markers, byCode, order }]
  const [busy, setBusy] = useState({});
  const [error, setError] = useState("");

  const load = async () => {
    const { items } = await api("GET", "schema/collections");
    const out = [];
    for (const c of items ?? []) {
      const { item } = await api("GET", `schema/collections/${encodeURIComponent(c.slug)}?includeFields=true`);
      const fs = item?.fields ?? [];
      const bar = fs.find((f) => f.widget === WIDGET);
      out.push({
        slug: c.slug,
        label: c.label,
        bar: bar?.slug ?? null,
        markers: fs.filter((f) => f.type === "json" && f.slug.startsWith(MARKER_PREFIX)).length,
        byCode: Array.isArray(bar?.options?.tabs) && bar.options.tabs.length > 0,
        order: fs.map((f) => f.slug),
      });
    }
    setRows(out);
  };
  useEffect(() => {
    load().catch((e) => (setError(`${P.error} ${e.message}`), setRows([])));
  }, []);

  const toggle = async (r, on) => {
    setBusy((b) => ({ ...b, [r.slug]: true }));
    setError("");
    try {
      if (on) {
        await api("POST", `schema/collections/${encodeURIComponent(r.slug)}/fields`, { slug: "tabs", label: "Tabs", type: "json", widget: WIDGET, translatable: false, required: false, sortOrder: 0 });
        await api("POST", `schema/collections/${encodeURIComponent(r.slug)}/fields/reorder`, { fieldSlugs: ["tabs", ...r.order.filter((s) => s !== "tabs")] });
      } else if (r.bar) {
        await api("DELETE", `schema/collections/${encodeURIComponent(r.slug)}/fields/${encodeURIComponent(r.bar)}`);
      }
      await load();
    } catch (e) {
      setError(`${P.error} ${e.message}`);
    } finally {
      setBusy((b) => ({ ...b, [r.slug]: false }));
    }
  };

  const line = "1px solid var(--color-kumo-line)";
  return h(
    "div",
    { style: { maxWidth: 760, display: "grid", gap: 20 } },
    h("div", null, h("h1", { style: { fontSize: 22, fontWeight: 600, margin: 0 } }, P.title), h("p", { style: { marginTop: 6, opacity: 0.7, fontSize: 14, lineHeight: 1.5 } }, P.intro)),
    error ? h("p", { role: "alert", style: { color: "var(--text-color-kumo-danger, #d33)", fontSize: 14, margin: 0 } }, error) : null,
    rows === null
      ? h("p", { style: { opacity: 0.6 } }, P.loading)
      : h(
          "section",
          { style: { border: line, borderRadius: 10, overflow: "hidden" } },
          rows.map((r, i) =>
            h(
              "div",
              { key: r.slug, style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 16px", borderTop: i ? line : "none" } },
              h(
                "div",
                { style: { minWidth: 0 } },
                h("div", { style: { fontSize: 14, fontWeight: 500 } }, r.label),
                h("div", { style: { fontSize: 12, opacity: 0.6 } }, `${r.slug}${r.bar ? ` · ${r.markers ? P.tabs(r.markers) : r.byCode ? P.byCode : P.tabs(0)}` : ""}`),
              ),
              h(Switch, { checked: Boolean(r.bar), disabled: Boolean(busy[r.slug]), onCheckedChange: (on) => toggle(r, on), "aria-label": r.label }),
            ),
          ),
        ),
  );
}

export const fields = { bar: Bar };
export const pages = { "/": Settings };
