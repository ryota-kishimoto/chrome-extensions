import { defineConfig } from "wxt";

export default defineConfig({
	manifest: {
		name: "Diff Preview",
		description:
			"Preview the rendered output of HTML files on GitHub PR Files Changed tab",
		host_permissions: ["https://github.com/*"],
		web_accessible_resources: [
			{
				resources: ["/viewer.html"],
				matches: ["https://github.com/*"],
			},
		],
		icons: {
			"16": "icon-16.png",
			"32": "icon-32.png",
			"48": "icon-48.png",
			"128": "icon-128.png",
		},
	},
});
