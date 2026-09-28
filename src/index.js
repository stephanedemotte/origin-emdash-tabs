/**
 * origin-emdash-tabs — tabs in the EmDash entry editor.
 *
 * EmDash stacks every field of an entry in one column. This plugin contributes
 * a field widget, `origin-emdash-tabs:bar`, meant for one `json` field placed
 * FIRST in a collection. The widget renders a tab bar and hides the fields of
 * the other tabs. It never writes a value: the field stays `null`.
 *
 * Which field goes in which tab lives in the widget field's `options.tabs`:
 * `[{ name: "Hero", fields: ["hero_title", "hero_image"] }, …]`. Build it by
 * hand, or derive it from field labels with `tabsFromLabels()`, then write it
 * with `tabsField()` (in a seed) or `syncTabs()` (`origin-emdash-tabs/sync`).
 */
import { fileURLToPath } from "node:url";

export const PLUGIN_ID = "origin-emdash-tabs";
export const WIDGET = `${PLUGIN_ID}:bar`;
export const DEFAULT_SLUG = "tabs";

/** The plugin descriptor, for `emdash({ plugins: [tabs()] })`. Native format: the widget is React. */
export const tabs = () => ({
  id: PLUGIN_ID,
  version: "1.0.0",
  format: "native",
  entrypoint: fileURLToPath(new URL("./runtime.js", import.meta.url)),
  adminEntry: fileURLToPath(new URL("./admin.js", import.meta.url)),
  capabilities: [],
});

/**
 * Tabs from field labels. A field goes in the tab named by its `tab` property,
 * else by the prefix of its label before `separator` ("Hero — title" → "Hero"),
 * else in the tab of the field before it. The first tab is `first`. Returns
 * `[]` when there would be a single tab: a one-tab bar is noise.
 *
 * `fields` are EmDash field definitions (`{ slug, label, tab? }`), in order.
 */
export const tabsFromLabels = (fields, { separator = " — ", first = "General" } = {}) => {
  const out = [];
  let current = first;
  for (const f of fields) {
    const label = String(f.label ?? "");
    current = f.tab ?? (label.includes(separator) ? label.split(separator)[0].trim() : current);
    let t = out.find((x) => x.name === current);
    if (!t) out.push((t = { name: current, fields: [] }));
    t.fields.push(f.slug);
  }
  return out.length > 1 ? out : [];
};

/**
 * The field definition that carries the bar, for a seed's `fields` array —
 * put it FIRST. `[]` when `tabs` is empty, so it can be spread unconditionally.
 */
export const tabsField = (tabs, { slug = DEFAULT_SLUG, label = "Tabs" } = {}) =>
  tabs.length ? [{ slug, label, type: "json", widget: WIDGET, options: { tabs }, translatable: false, required: false }] : [];
