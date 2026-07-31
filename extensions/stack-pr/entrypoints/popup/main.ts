const STORAGE_KEY = "groupStackedPR";

const toggle = document.getElementById("toggle") as HTMLInputElement;

browser.storage.local.get(STORAGE_KEY).then((result) => {
	toggle.checked = result[STORAGE_KEY] ?? true;
});

toggle.addEventListener("change", () => {
	browser.storage.local.set({ [STORAGE_KEY]: toggle.checked });
});
