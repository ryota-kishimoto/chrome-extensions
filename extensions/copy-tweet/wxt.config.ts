import { defineConfig } from "wxt";

export default defineConfig({
	manifest: {
		name: "Copy Tweet for AI",
		description: "Copy tweet content as Markdown with embedded images for AI",
		host_permissions: ["https://pbs.twimg.com/*"],
	},
});
