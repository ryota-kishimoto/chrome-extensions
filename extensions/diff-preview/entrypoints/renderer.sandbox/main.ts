// Sandboxed extension pages (manifest sandbox.pages) get a CSP that allows
// inline script execution — unlike regular extension pages, whose CSP floor
// forbids it. This page just renders whatever HTML its parent (viewer.html)
// sends it over postMessage. The HTML already has its own <img> src watcher
// script injected (see prepareRelativeImages) ahead of the page's own
// scripts, since document.write runs each <script> as the parser reaches it.
window.addEventListener("message", (event) => {
	// Only the embedding viewer page may supply the HTML.
	if (event.source !== window.parent) return;
	if (typeof event.data !== "string") return;
	document.open();
	document.write(event.data);
	document.close();
});
