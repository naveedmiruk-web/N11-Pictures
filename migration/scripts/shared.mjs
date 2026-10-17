import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { htmlToBlocks } from "@portabletext/block-tools";
import { Schema } from "@sanity/schema";
import { JSDOM } from "jsdom";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

export const studioDirectory = path.resolve(scriptDirectory, "../..");
export const extractionDirectory = path.join(studioDirectory, "migration", "extracted");
export const reportDirectory = path.join(studioDirectory, "migration", "reports");
export const snapshotPath = path.join(extractionDirectory, "webflow-snapshot.json");
export const sourceListingUrl = "https://www.n11pictures.com/work/our-work";
export const sanityConfig = {
  projectId: "1bbo98jd",
  dataset: "production",
  apiVersion: "2024-03-10",
};

const portableTextSchema = Schema.compile({
  name: "webflowMigration",
  types: [
    {
      type: "object",
      name: "film",
      fields: [
        {
          name: "projectDetails",
          type: "array",
          of: [
            {
              type: "block",
              styles: [
                {title: "Normal", value: "normal"},
                {title: "Heading 2", value: "h2"},
                {title: "Heading 3", value: "h3"},
                {title: "Blockquote", value: "blockquote"},
              ],
              lists: [
                {title: "Bullet", value: "bullet"},
                {title: "Numbered", value: "number"},
              ],
              marks: {
                decorators: [
                  {title: "Strong", value: "strong"},
                  {title: "Emphasis", value: "em"},
                  {title: "Underline", value: "underline"},
                ],
                annotations: [
                  {
                    name: "link",
                    type: "object",
                    fields: [{name: "href", type: "url"}],
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
});

const projectDetailsType = portableTextSchema
  .get("film")
  .fields.find((field) => field.name === "projectDetails").type;

export function stableKey(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

export function normalizeTitle(value) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function categoryGroup(value) {
  const normalized = normalizeTitle(value);

  if (normalized.includes("behind the scenes")) return "behind";
  if (normalized.includes("hospital")) return "hospitality";
  if (normalized.includes("gym")) return "gyms";
  if (normalized.includes("short")) return "shorts";
  if (normalized.includes("music video") || normalized === "music") return "music";
  if (normalized.includes("ben samuel") || normalized.includes("bens samuel")) return "ben";
  if (normalized.includes("film festival")) return "festival";
  if (normalized.includes("show reel") || normalized.includes("showreel")) return "showreel";
  return normalized;
}

export function normalizeUrl(value, baseUrl) {
  if (!value || typeof value !== "string") return undefined;

  try {
    const parsed = new URL(value.trim(), baseUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function extractImageUrls(html, baseUrl) {
  const document = new JSDOM(html, {url: baseUrl}).window.document;
  const urls = [];

  for (const image of document.querySelectorAll("img")) {
    urls.push(image.getAttribute("src"), image.getAttribute("data-src"));
    const srcset = image.getAttribute("srcset") ?? image.getAttribute("data-srcset") ?? "";
    for (const candidate of srcset.split(",")) {
      urls.push(candidate.trim().split(/\s+/)[0]);
    }
  }

  for (const source of document.querySelectorAll("source[srcset]")) {
    for (const candidate of (source.getAttribute("srcset") ?? "").split(",")) {
      urls.push(candidate.trim().split(/\s+/)[0]);
    }
  }

  return [...new Set(urls.map((url) => normalizeUrl(url, baseUrl)).filter(Boolean))];
}

export function extractVideoEmbeds(html, baseUrl) {
  const document = new JSDOM(html, {url: baseUrl}).window.document;

  return [...document.querySelectorAll("iframe[src]")]
    .map((frame) => ({
      url: normalizeUrl(frame.getAttribute("src"), baseUrl),
      title: frame.getAttribute("title")?.trim() ?? "",
    }))
    .filter((video) => video.url);
}

export function extractVideoFileUrls(html, baseUrl) {
  const document = new JSDOM(html, {url: baseUrl}).window.document;
  const urls = [];

  for (const source of document.querySelectorAll("video[src], video source[src]")) {
    urls.push(source.getAttribute("src"));
  }

  for (const video of document.querySelectorAll("[data-video-urls]")) {
    urls.push(...(video.getAttribute("data-video-urls") ?? "").split(","));
  }

  return [...new Set(urls.map((url) => normalizeUrl(url, baseUrl)).filter(Boolean))];
}

export function blocksFromHtml(html, keyPrefix) {
  if (!html?.trim()) return [];

  const document = new JSDOM(html).window.document;
  for (const figure of document.querySelectorAll("figure")) {
    if (figure.querySelector("img, iframe, video")) {
      const caption = figure.querySelector("figcaption");
      if (caption?.textContent?.trim()) {
        figure.replaceWith(caption);
      } else {
        figure.remove();
      }
    }
  }
  document.querySelectorAll("img, iframe, video, script, style").forEach((element) => element.remove());

  const blocks = htmlToBlocks(document.body.innerHTML, projectDetailsType, {
    parseHtml: (input) => new JSDOM(input).window.document,
  });

  return blocks
    .filter((block) =>
      (block.children ?? []).some((child) =>
        (child.text ?? "").replace(/[\u200b-\u200d\ufeff]/g, "").trim(),
      ),
    )
    .map((block, blockIndex) => ({
      ...block,
      _key: stableKey(`${keyPrefix}-block-${blockIndex}`),
      children: (block.children ?? []).map((child, childIndex) => ({
        ...child,
        _key: stableKey(`${keyPrefix}-block-${blockIndex}-child-${childIndex}`),
      })),
      markDefs: (block.markDefs ?? []).map((mark, markIndex) => ({
        ...mark,
        _key: stableKey(`${keyPrefix}-block-${blockIndex}-mark-${markIndex}`),
      })),
    }));
}

export async function listCsvFiles() {
  const directory = path.join(studioDirectory, "csv-data");
  const files = await readdir(directory);
  return files
    .filter((file) => file.toLowerCase().endsWith(".csv"))
    .sort()
    .map((file) => path.join(directory, file));
}

export function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
