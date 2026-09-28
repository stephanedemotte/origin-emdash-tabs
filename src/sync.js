/**
 * Writing the tab bar into an EXISTING database — a seed only applies to an
 * empty one. For each collection: create the bar field if missing, rewrite its
 * tabs (so they follow your code), and move it first in the editor.
 *
 *   import { EmDashClient } from "emdash/client";
 *   import { syncTabs } from "origin-emdash-tabs/sync";
 *   const client = new EmDashClient({ baseUrl, token }); // or { baseUrl, devBypass: true }
 *   await syncTabs(client, { home: tabsFromLabels(homeFields), about: [...] });
 *
 * Needs an admin token (schema writes). Collections whose tabs are `[]` are
 * left alone.
 */
import { DEFAULT_SLUG, WIDGET } from "./index.js";

export async function syncTabs(client, byCollection, { slug = DEFAULT_SLUG, label = "Tabs" } = {}) {
  const base = client.baseUrl ?? client.options?.baseUrl;
  const api = async (method, path, body) => {
    const r = await client.transport.fetch(
      new Request(`${base}/_emdash/api/${path}`, {
        method,
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-EmDash-Request": "1", Origin: new URL(base).origin },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
  };
  const done = [];
  for (const [collection, tabs] of Object.entries(byCollection)) {
    if (!tabs?.length) continue;
    const existing = ((await client.collection(collection)).fields ?? []).map((f) => f.slug);
    if (!existing.includes(slug)) {
      await client.createField(collection, { slug, label, type: "json", widget: WIDGET, options: { tabs }, translatable: false, required: false, sortOrder: 0 });
    } else {
      await api("PUT", `schema/collections/${collection}/fields/${slug}`, { widget: WIDGET, options: { tabs }, label });
    }
    const order = ((await client.collection(collection)).fields ?? []).map((f) => f.slug);
    if (order[0] !== slug) await api("POST", `schema/collections/${collection}/fields/reorder`, { fieldSlugs: [slug, ...order.filter((f) => f !== slug)] });
    done.push(collection);
  }
  return done;
}
