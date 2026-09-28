# origin-emdash-tabs

Tabs in the [EmDash](https://github.com/emdash-cms/emdash) entry editor.

EmDash stacks every field of an entry in one long column. This plugin groups a collection's fields into tabs (for example Hero / Intro / Gallery / Footer) with a bar at the top of the editor. Nothing is stored: the tab bar lives on an empty `json` field, and switching tabs only hides the other fields. What an editor typed in one tab is saved with the rest.

Requires EmDash 1.x. It is a **native** (trusted) plugin, because the widget is React, so it is installed from git rather than from the EmDash plugin registry, which only takes sandboxed plugins.

## Install

```bash
bun add github:stephanedemotte/origin-emdash-tabs#v1.0.0
```

```js
// astro.config.mjs
import emdash from "emdash/astro";
import { tabs } from "origin-emdash-tabs";

emdash({ plugins: [tabs()] });
```

## Declare the tabs

The tabs of a collection live in the `options.tabs` of its bar field: `[{ name, fields: [slugs] }]`. There are two helpers to build them.

`tabsFromLabels(fields)` derives the tabs from field labels. Each field goes in:

1. the tab named by its `tab` property, if it has one;
2. otherwise the tab given by its label prefix: `"Hero — title"` goes in `Hero`;
3. otherwise the tab of the field before it.

The first tab is `General`. When there would be only one tab, it returns `[]`: no bar.

```js
import { tabsFromLabels, tabsField } from "origin-emdash-tabs";

const fields = [
  { slug: "title", label: "Page title", type: "string" },
  { slug: "hero_title", label: "Hero — title", type: "string" },
  { slug: "hero_image", label: "Hero — image", type: "image" },
  { slug: "body", label: "Text", type: "portableText", tab: "Content" },
];

// in a seed: put the bar FIRST
const collection = { slug: "home", fields: [...tabsField(tabsFromLabels(fields)), ...fields] };
```

A seed only applies to an empty database. For an existing one, `syncTabs` does the work:

- creates the bar field if it is missing;
- rewrites its tabs, so they follow your code;
- moves it first in the editor.

```js
import { EmDashClient } from "emdash/client";
import { syncTabs } from "origin-emdash-tabs/sync";

const client = new EmDashClient({ baseUrl: "https://example.com", token: process.env.EMDASH_TOKEN });
await syncTabs(client, { home: tabsFromLabels(homeFields), about: tabsFromLabels(aboutFields) });
```

`syncTabs` needs an admin token (schema writes). Run it after each deploy that changes the tabs.

## How it works

- **Finding each field.** The editor renders each field as a direct child of one column, and each field's control carries `id="field-<slug>"`:
  - an image field carries it on its whole block;
  - a repeater carries it on its sub-fields, `field-<slug>.0.<sub>`.
- **Hiding the other tabs.** The widget tags that column and hides the blocks of the inactive tabs with CSS `:has()`.
- **Invalid field in a hidden tab.** When a hidden field fails validation, the `invalid` event switches to its tab, so the editor sees why the save is refused.
- **Remembering the tab.** The open tab is kept per collection for the browser session.
- **Styling.** Inline, on the admin's theme variables (`--color-kumo-*`), so it follows light and dark mode.

It depends on the editor's DOM (the column and the `field-<slug>` ids), which is not a public API. Check it after an EmDash upgrade.

## License

MIT
