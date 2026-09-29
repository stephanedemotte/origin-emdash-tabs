/**
 * The runtime of origin-emdash-tabs: nothing happens server side, the widget
 * (`admin.js`) does everything. It only declares its field widget.
 */
import { definePlugin } from "emdash";
import { PLUGIN_ID } from "./index.js";

export function createPlugin() {
  return definePlugin({
    id: PLUGIN_ID,
    version: "1.2.1",
    capabilities: [],
    admin: {
      fieldWidgets: [{ name: "bar", label: "Tab bar", fieldTypes: ["json"] }],
      // The settings page (`admin.js` → `pages["/"]`): turn tabs on per collection.
      pages: [{ path: "/", label: "Tabs" }],
    },
  });
}
