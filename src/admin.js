/**
 * THE TAB BAR — the `origin-emdash-tabs:bar` field widget (see `index.js`).
 *
 * The EmDash editor renders each field as a direct child of one column, and
 * each field's control carries the id `field-<slug>` (an image field: its whole
 * block; a repeater: its sub-fields, `field-<slug>.<i>.<sub>`). The widget tags
 * that column (its own parent) and adds a stylesheet that hides, through
 * `:has()`, the blocks of the inactive tabs. Hidden, not unmounted: what was
 * typed in a tab stays in the form and is saved with the rest.
 *
 * An invalid field in a hidden tab (a required field left empty) brings its
 * tab back on the `invalid` event; otherwise the editor would not see why
 * nothing saves.
 *
 * The open tab is remembered per collection for the browser session.
 *
 * Plain `createElement`, no JSX: the file is used as shipped, with no build
 * step in the consuming site. Inline styles on the admin's theme variables
 * (`--color-kumo-*`): the admin's Tailwind is precompiled, a class it does
 * not use itself would not exist.
 */
import { createElement as h, useEffect, useId, useMemo, useRef, useState } from "react";

const storageKey = () => `origin-emdash-tabs:${location.pathname.split("/content/")[1]?.split("/")[0] ?? ""}`;
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

/** The tab of a form element: the tab of the field block it belongs to. */
const tabOf = (tabs, el) => {
  const block = el.closest("[data-origin-tabs] > *");
  if (!block) return -1;
  const ids = [block.id, ...[...block.querySelectorAll("[id^='field-']")].map((e) => e.id)];
  return tabs.findIndex((t) => t.fields.some((s) => ids.some((i) => i === `field-${s}` || i.startsWith(`field-${s}.`))));
};

/** Every selector that matches the block of field `s` inside column `m`. */
const blockSelectors = (m, s) => [
  `[data-origin-tabs="${m}"] > :has([id="field-${s}"])`,
  `[data-origin-tabs="${m}"] > [id="field-${s}"]`,
  `[data-origin-tabs="${m}"] > :has([id^="field-${s}."])`,
];

function Bar({ options }) {
  const tabs = useMemo(() => (Array.isArray(options?.tabs) ? options.tabs.filter((t) => t && Array.isArray(t.fields)) : []), [options]);
  const [active, setActive] = useState(() => Math.min(recall(), Math.max(tabs.length - 1, 0)));
  const root = useRef(null);
  const mark = `t${useId().replace(/[^a-z0-9]/gi, "")}`;

  useEffect(() => {
    const column = root.current?.parentElement;
    if (!column) return;
    column.setAttribute("data-origin-tabs", mark);
    const onInvalid = (e) => {
      const i = tabOf(tabs, e.target);
      if (i >= 0) setActive(i);
    };
    column.addEventListener("invalid", onInvalid, true);
    return () => {
      column.removeAttribute("data-origin-tabs");
      column.removeEventListener("invalid", onInvalid, true);
    };
  }, [mark, tabs]);

  useEffect(() => remember(active), [active]);

  if (!tabs.length) return null;
  const css = tabs
    .flatMap((t, i) => (i === active ? [] : t.fields))
    .flatMap((s) => blockSelectors(mark, s))
    .join(",\n");
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
        const on = i === active;
        return h(
          "button",
          {
            key: t.name,
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

export const fields = { bar: Bar };
