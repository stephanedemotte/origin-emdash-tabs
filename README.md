# origin-emdash-tabs

Tabs in the [EmDash](https://github.com/emdash-cms/emdash) entry editor.

EmDash stacks every field of an entry in one long column. This plugin groups a collection's fields into tabs (for example Hero / Intro / Gallery / Footer) with a bar at the top of the editor. Nothing is stored and nothing changes in your content: switching tabs only hides the other fields, and what an editor typed in one tab is saved with the rest.

Requires EmDash 1.x. It is a **native** (trusted) plugin, because the widget is React. It is installed from git, not from the EmDash plugin registry: the registry only takes sandboxed plugins.

## Install

```bash
bun add github:stephanedemotte/origin-emdash-tabs#v1.2.1
```

```js
// astro.config.mjs
import emdash from "emdash/astro";
import { tabs } from "origin-emdash-tabs";

emdash({ plugins: [tabs()] });
```

## Use it from the admin (no code)

1. **Turn the bar on for a collection.** Go to Plugins → **Tabs**, where each collection has a switch. It adds the bar field at the top of the collection.
2. **Add a tab.** Go to Content Types → your collection → **Add field** → **JSON**:
   - its **label** is the tab's name, for example `Hero`;
   - its **slug** starts with `tab_`, for example `tab_hero`.
3. **Put fields in it.** Every field placed after a `tab_…` field, up to the next one, is in that tab. Fields before the first `tab_…` field go in a first tab, "General". To move a field to another tab, drag it in the content type's field list.

The `tab_…` fields are hidden in the editor and store nothing. There is no sync step and no token: the bar reads the markers from the editor itself each time it opens, before the first paint, so the tabs are there from the first frame.

## Or declare the tabs in code

In a seed, put the bar first and the markers where the tabs start:

```js
const fields = [
  { slug: "tabs", label: "Tabs", type: "json", widget: "origin-emdash-tabs:bar", options: { first: "General" } },
  { slug: "title", label: "Title", type: "string" },
  { slug: "tab_hero", label: "Hero", type: "json" },
  { slug: "hero_title", label: "Title", type: "string" },
  { slug: "hero_image", label: "Image", type: "image" },
];
```

Keep the fields in that order in every environment, since the order is what decides which field is in which tab. A seed only applies to an empty database; for an existing one, create any missing fields and reorder them. EmDash's REST routes for that are `POST /_emdash/api/schema/collections/<c>/fields` and `…/fields/reorder`.

**Bar options:** `first` sets the name of the first tab, before any `tab_…` field. It defaults to "General".

### Legacy: a list of tabs in the bar's options

Versions 1.0–1.1 declared the tabs as a list in the bar field's options, `options.tabs: [{ name, fields: [slugs] }]`, written with `tabsFromLabels` / `tabsField` and kept in sync with `syncTabs` (`origin-emdash-tabs/sync`). This still works; `tab_…` fields take precedence when a collection has any.

## How it works

- **Finding each field.** The editor renders each field as a direct child of one column, in the collection's field order.
  - **By position:** the bar reads the column itself, before the first paint, and groups its blocks between `tab_…` markers. It matches them with `:nth-child()`, which reaches every field type, including selects and other plugins' widgets, which carry no id. If no marker can be read from the column, it falls back to the field order from the schema API.
  - **By id, when the column doesn't match the order:** each field's control carries `id="field-<slug>"`. An image field carries it on its whole block; a repeater carries it on its sub-fields, `field-<slug>.0.<sub>`.
- **Hiding.** The bar tags that column and hides the inactive tabs' blocks, and the `tab_…` markers, with CSS.
- **Invalid field in a hidden tab.** When a hidden field fails validation, the `invalid` event switches to its tab, so the editor sees why the save is refused.
- **Remembering the tab.** The open tab is kept per collection for the browser session.
- **Styling.** Inline, on the admin's theme variables (`--color-kumo-*`), so it follows light and dark mode.

It depends on the editor's DOM (the field column), which is not a public API. Check it after an EmDash upgrade.

## Upstream

A core, presentation-only tab layout would replace this plugin and work for sandboxed plugins too. It is proposed in [emdash-cms/emdash#3561](https://github.com/emdash-cms/emdash/discussions/3561).

## License

MIT
