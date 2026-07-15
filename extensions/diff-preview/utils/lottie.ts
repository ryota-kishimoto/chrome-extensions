import { unzipSync } from "fflate";
import {
	type FileRef,
	blobToDataUrl,
	rawDirUrl,
	rawFileUrl,
} from "./rawContent";

type LottieAsset = {
	p?: string;
	u?: string;
	e?: number;
};

type LottieAnimation = {
	v?: unknown;
	fr?: unknown;
	layers?: unknown;
	assets?: LottieAsset[];
};

function isLottieAnimation(data: unknown): data is LottieAnimation {
	return (
		typeof data === "object" &&
		data !== null &&
		"v" in data &&
		"fr" in data &&
		"layers" in data
	);
}

const IMAGE_MIME: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
};

function bytesToDataUrl(bytes: Uint8Array, path: string): Promise<string> {
	const ext = path.split(".").pop()?.toLowerCase() ?? "";
	const type = IMAGE_MIME[ext] ?? "application/octet-stream";
	return blobToDataUrl(new Blob([bytes as BlobPart], { type }));
}

/** Extracts the first animation from a .lottie archive (a zip with a
 * manifest.json and animations/*.json), along with its bundled files. */
function unpackDotLottie(bytes: Uint8Array): {
	animationText: string;
	files: Record<string, Uint8Array>;
} {
	const files = unzipSync(bytes);
	const decoder = new TextDecoder();

	let animationPath: string | undefined;
	const manifest = files["manifest.json"];
	if (manifest) {
		try {
			const parsed = JSON.parse(decoder.decode(manifest)) as {
				animations?: { id?: string }[];
			};
			const id = parsed.animations?.[0]?.id;
			if (id && files[`animations/${id}.json`]) {
				animationPath = `animations/${id}.json`;
			}
		} catch {
			// Fall through to scanning for any animation JSON.
		}
	}
	animationPath ??= Object.keys(files).find(
		(name) => name !== "manifest.json" && name.endsWith(".json"),
	);
	if (!animationPath) throw new Error("No animation found in .lottie file");

	return { animationText: decoder.decode(files[animationPath]), files };
}

/**
 * Lottie animations with raster image layers reference them via relative
 * asset paths (u: directory, p: filename). Like the HTML preview's <img>
 * handling, those are inlined as data: URIs here — resolved from inside the
 * .lottie archive when bundled, or fetched relative to the file's directory
 * on GitHub otherwise.
 */
async function inlineImageAssets(
	animation: LottieAnimation,
	ref: FileRef,
	archiveFiles: Record<string, Uint8Array>,
): Promise<void> {
	const dirUrl = rawDirUrl(ref);
	await Promise.all(
		(animation.assets ?? []).map(async (asset) => {
			if (!asset.p || asset.p.startsWith("data:")) return;
			const assetPath = `${asset.u ?? ""}${asset.p}`;
			try {
				const archived = archiveFiles[assetPath.replace(/^\//, "")];
				const dataUrl = archived
					? await bytesToDataUrl(archived, asset.p)
					: await blobToDataUrl(
							await (await fetch(new URL(assetPath, dirUrl))).blob(),
						);
				asset.p = dataUrl;
				asset.u = "";
				asset.e = 1;
			} catch {
				// Leave the asset as-is; that layer just won't render.
			}
		}),
	);
}

// Zip local-file-header magic ("PK\x03\x04").
function isZip(bytes: Uint8Array): boolean {
	return (
		bytes[0] === 0x50 &&
		bytes[1] === 0x4b &&
		bytes[2] === 0x03 &&
		bytes[3] === 0x04
	);
}

/** Fetches and parses the referenced file into ready-to-play animation data,
 * or throws if it isn't a Lottie animation. */
export async function loadLottieAnimation(ref: FileRef): Promise<object> {
	const res = await fetch(rawFileUrl(ref));
	if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);

	// A .lottie is a zip archive per the dotLottie spec, but plain Lottie JSON
	// renamed to .lottie is common in the wild too — sniff, don't trust the
	// extension.
	const bytes = new Uint8Array(await res.arrayBuffer());
	let animationText: string;
	let archiveFiles: Record<string, Uint8Array> = {};
	if (isZip(bytes)) {
		({ animationText, files: archiveFiles } = unpackDotLottie(bytes));
	} else {
		animationText = new TextDecoder().decode(bytes);
	}

	let animation: unknown;
	try {
		animation = JSON.parse(animationText);
	} catch {
		throw new Error("Not valid JSON");
	}
	if (!isLottieAnimation(animation)) {
		throw new Error("Not a Lottie animation");
	}

	await inlineImageAssets(animation, ref, archiveFiles);
	return animation;
}
