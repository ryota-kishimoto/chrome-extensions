import { defineConfig } from "wxt";

export default defineConfig({
	manifest: {
		name: "Copy from X",
		description:
			"Copy tweet and article content as Markdown with embedded images",
		host_permissions: ["https://pbs.twimg.com/*"],
	},
});
