import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { createClient } from "@sanity/client";
import { JSDOM } from "jsdom";
import {
  blocksFromHtml,
  delay,
  extractImageUrls,
  extractVideoEmbeds,
  extractVideoFileUrls,
  categoryGroup,
  normalizeTitle,
  sanityConfig,
  snapshotPath,
  stableKey,
  reportDirectory,
  studioDirectory,
} from "./shared.mjs";

const detailFieldNames = [
  "Project Details 1 (Wide)",
  "Project Details 2 (Narrow)",
  "Project Details 3 (Wide)",
];
const maxImageBytes = 25 * 1024 * 1024;
const sourceSystem = "Webflow";

function plainText(value) {
  if (!value?.trim()) return "";
  return new JSDOM(value).window.document.body.textContent
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeading(htmlList) {
  for (const html of htmlList) {
    const heading = new JSDOM(html).window.document.querySelector("h1, h2, h3");
    const text = heading?.textContent?.replace(/\s+/g, " ").trim();
    if (text) return text;
  }
}

function firstParagraph(htmlList) {
  for (const html of htmlList) {
    const document = new JSDOM(html).window.document;
    const paragraphs = [...document.querySelectorAll("p")];
    const text = paragraphs
      .map((paragraph) => plainText(paragraph.innerHTML))
      .find(Boolean);
    if (text) return text;
  }
}

function uniqueVideos(videos) {
  const seen = new Set();
  return videos.filter((video) => {
    if (!video.url || seen.has(video.url)) return false;
    seen.add(video.url);
    return true;
  });
}

export function transformProject(project) {
  const row = project.csvRow ?? {};
  const csvDetailHtml = detailFieldNames
    .map((field) => row[field])
    .filter((value) => typeof value === "string" && value.trim());
  const detailHtml = csvDetailHtml.length
    ? csvDetailHtml
    : (project.detail?.contentHtml ?? []);
  const sliderHtml = row["Slider Images"] ?? "";
  const heroImageUrl =
    row["Main Project Image"]?.trim() ||
    project.cardImageUrl ||
    project.detail?.heroImageUrl;
  const imageUrls = [
    heroImageUrl,
    ...detailHtml.flatMap((html) => extractImageUrls(html, project.url)),
    ...extractImageUrls(sliderHtml, project.url),
    ...(project.detail?.imageUrls ?? []),
  ].filter(Boolean);
  const uniqueImageUrls = [...new Set(imageUrls)];
  const galleryImageUrls = uniqueImageUrls.filter((url) => url !== heroImageUrl);
  const videos = uniqueVideos([
    ...csvDetailHtml.flatMap((html) => extractVideoEmbeds(html, project.url)),
    ...extractVideoEmbeds(sliderHtml, project.url),
    ...(project.detail?.videoEmbeds ?? []),
  ]);
  const hostedVideoUrls = [
    ...new Set([
      ...csvDetailHtml.flatMap((html) => extractVideoFileUrls(html, project.url)),
      ...(project.detail?.hostedVideoUrls ?? []),
    ]),
  ];
  const additionalVideoUrls = [
    ...new Set([...videos.slice(1).map((video) => video.url), ...hostedVideoUrls]),
  ];
  const projectDetails = detailHtml.flatMap((html, index) =>
    blocksFromHtml(html, `${project.slug}-detail-${index}`),
  );
  const summary =
    plainText(row["Project Summary"] ?? "") || firstParagraph(detailHtml);
  const sourceMetadata = {
    system: sourceSystem,
    ...(row["Item ID"] ? {itemId: row["Item ID"]} : {}),
    url: project.url,
  };

  return {
    slug: project.slug,
    title: project.title || project.detail?.title || row.Name || "",
    category: row._sourceCategory || project.category || row["Project Info"] || "",
    legacySynopsisFallback: plainText(row["Project Info"] ?? ""),
    ...(summary ? {synopsis: summary} : {}),
    ...(extractHeading(detailHtml) ? {synopsisHeading: extractHeading(detailHtml)} : {}),
    ...(projectDetails.length ? {projectDetails} : {}),
    ...(videos[0] ? {trailerUrl: videos[0].url} : {}),
    ...(additionalVideoUrls.length ? {btsVideos: additionalVideoUrls} : {}),
    ...(heroImageUrl ? {heroImageUrl} : {}),
    galleryImageUrls,
    hostedVideoUrls,
    sourceMetadata,
  };
}

function toImageReference(assetId, key, alt) {
  return {
    _type: "image",
    _key: key,
    asset: {_type: "reference", _ref: assetId},
    alt,
  };
}

async function downloadImage(url) {
  const response = await fetch(url, {
    headers: {"user-agent": "N11-Sanity-Migration/1.0"},
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    throw new Error(`GET ${url} returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Expected an image at ${url}, received ${contentType || "unknown content type"}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > maxImageBytes) {
    throw new Error(`Image size at ${url} is invalid (${bytes.length} bytes)`);
  }

  const filename = decodeURIComponent(new URL(url).pathname.split("/").pop() || "project-image");
  return {bytes, contentType, filename};
}

function makeClient(token) {
  return createClient({
    ...sanityConfig,
    useCdn: false,
    ...(token ? {token} : {}),
  });
}

function documentIdentity(title, category) {
  return `${normalizeTitle(title)}|${categoryGroup(category)}`;
}

async function mapLimit(values, limit, callback) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      results[index] = await callback(values[index], index);
    }
  }

  await Promise.all(Array.from({length: Math.min(limit, values.length)}, worker));
  return results;
}

export async function runMigration(args = process.argv.slice(2)) {
  const localEnvPath = path.join(studioDirectory, ".env.local");
  if (existsSync(localEnvPath)) loadEnvFile(localEnvPath);

  const commit = args.includes("--commit");
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  if (!Array.isArray(snapshot.projects) || snapshot.projects.length === 0) {
    throw new Error("The extracted snapshot has no projects. Run npm run migrate:extract first.");
  }
  if (snapshot.failures?.length) {
    throw new Error(`Snapshot contains ${snapshot.failures.length} source-page failures; re-extract before import.`);
  }

  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (commit && !token) {
    throw new Error("SANITY_API_WRITE_TOKEN is required for --commit. Set a new local write token; do not paste it into chat.");
  }
  if (commit && process.env.SANITY_ALLOW_PRODUCTION_IMPORT !== "YES") {
    throw new Error("Set SANITY_ALLOW_PRODUCTION_IMPORT=YES to explicitly allow writes to the production dataset.");
  }

  const client = makeClient(token);
  const sourceProjects = snapshot.projects.map(transformProject);
  const invalidProjects = sourceProjects.filter((project) => !project.title || !project.slug || !project.heroImageUrl);
  if (invalidProjects.length) {
    throw new Error(
      `Cannot continue: ${invalidProjects.length} project(s) are missing title, slug, or hero image: ${invalidProjects.map((project) => project.slug || "(no slug)").join(", ")}`,
    );
  }

  const existingDocuments = await client.fetch(
    `*[_type == "film"]{
      _id,
      title,
      category,
      synopsis,
      "slug": slug.current,
      "sourceUrl": sourceMetadata.url
    }`,
  );
  const existingBySourceUrl = new Map();
  const existingByIdentity = new Map();
  const existingByTitle = new Map();
  for (const document of existingDocuments) {
    if (document.sourceUrl) {
      const matches = existingBySourceUrl.get(document.sourceUrl) ?? [];
      matches.push(document);
      existingBySourceUrl.set(document.sourceUrl, matches);
    }
    const identity = documentIdentity(document.title, document.category);
    const identityMatches = existingByIdentity.get(identity) ?? [];
    identityMatches.push(document);
    existingByIdentity.set(identity, identityMatches);
    const title = normalizeTitle(document.title);
    const titleMatches = existingByTitle.get(title) ?? [];
    titleMatches.push(document);
    existingByTitle.set(title, titleMatches);
  }

  const duplicateSourceUrls = sourceProjects
    .map((project) => project.sourceMetadata.url)
    .filter((url, index, all) => all.indexOf(url) !== index);
  if (duplicateSourceUrls.length) {
    throw new Error(`Duplicate source URLs detected: ${duplicateSourceUrls.join(", ")}.`);
  }

  const matchedDocuments = sourceProjects.map((project) => {
    const urlMatch = existingBySourceUrl.get(project.sourceMetadata.url) ?? [];
    if (urlMatch.length > 1) {
      throw new Error(`Multiple Sanity documents already claim source URL ${project.sourceMetadata.url}.`);
    }
    if (urlMatch.length === 1) return urlMatch[0];

    const identityMatches = existingByIdentity.get(documentIdentity(project.title, project.category)) ?? [];
    if (identityMatches.length === 1) return identityMatches[0];
    if (identityMatches.length > 1) {
      const categoryMatches = identityMatches.filter(
        (document) => categoryGroup(document.category) === categoryGroup(project.category),
      );
      if (categoryMatches.length === 1) return categoryMatches[0];
      throw new Error(`Multiple Sanity documents match "${project.title}" in category "${project.category}".`);
    }

    const titleMatches = existingByTitle.get(normalizeTitle(project.title)) ?? [];
    if (titleMatches.length > 1) {
      throw new Error(`Multiple Sanity documents have the title "${project.title}" in different categories.`);
    }
    return titleMatches[0] ?? null;
  });
  const matchedIds = matchedDocuments.filter(Boolean).map((document) => document._id);
  if (new Set(matchedIds).size !== matchedIds.length) {
    throw new Error("Multiple source projects matched the same Sanity document; refusing to import.");
  }
  const imageUrls = [
    ...new Set(
      sourceProjects.flatMap((project) => [
        project.heroImageUrl,
        ...project.galleryImageUrls,
      ]),
    ),
  ];
  const hostedVideoUrls = sourceProjects.flatMap((project) =>
    project.hostedVideoUrls.map((url) => ({slug: project.slug, url})),
  );

  console.log(`Source projects: ${sourceProjects.length}`);
  console.log(`Existing Sanity documents: ${existingDocuments.length}`);
  console.log(`Matched to existing documents: ${matchedDocuments.filter(Boolean).length}`);
  console.log(`New documents: ${matchedDocuments.filter((document) => !document).length}`);
  console.log(`Unique images to upload: ${imageUrls.length}`);
  console.log(`Video URLs to preserve in Sanity: ${sourceProjects.reduce((count, project) => count + (project.trailerUrl ? 1 : 0) + (project.btsVideos?.length ?? 0), 0)}`);
  console.log(`Direct hosted video URLs kept on their streaming host: ${hostedVideoUrls.length}`);

  if (!commit) {
    console.log("Dry run only. No Sanity assets or documents were written.");
    return;
  }

  const assetIds = new Map();
  const imageErrors = [];
  await mapLimit(imageUrls, 2, async (url) => {
    try {
      const image = await downloadImage(url);
      const asset = await client.assets.upload("image", image.bytes, {
        filename: image.filename,
        contentType: image.contentType,
      });
      assetIds.set(url, asset._id);
      await delay(100);
    } catch (error) {
      imageErrors.push({
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  if (imageErrors.length > 0) {
    await mkdir(reportDirectory, {recursive: true});
    await writeFile(
      path.join(reportDirectory, "import-failures.json"),
      `${JSON.stringify({imageErrors}, null, 2)}\n`,
      "utf8",
    );
    throw new Error(
      `Image upload failed for ${imageErrors.length} source asset(s). No film documents were patched; see migration/reports/import-failures.json.`,
    );
  }

  const transaction = client.transaction();
  const newDocuments = [];
  const usedSlugs = new Set(existingDocuments.map((document) => document.slug).filter(Boolean));

  for (const [index, project] of sourceProjects.entries()) {
    const existing = matchedDocuments[index];
    const stableSourceId =
      project.sourceMetadata.itemId ??
      `${categoryGroup(project.category)}-${project.slug}`;
    const documentId =
      existing?._id ??
      `webflow-${stableSourceId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const fields = {
      title: project.title,
      sourceMetadata: project.sourceMetadata,
      heroImage: toImageReference(
        assetIds.get(project.heroImageUrl),
        stableKey(`${project.slug}-hero`),
        project.title,
      ),
    };

    if (project.synopsis) fields.synopsis = project.synopsis;
    if (project.synopsisHeading) fields.synopsisHeading = project.synopsisHeading;
    if (project.projectDetails) fields.projectDetails = project.projectDetails;
    if (project.trailerUrl) fields.trailerUrl = project.trailerUrl;
    if (project.btsVideos) fields.btsVideos = project.btsVideos;
    if (project.galleryImageUrls.length) {
      fields.gallery = project.galleryImageUrls.map((url, imageIndex) =>
        toImageReference(
          assetIds.get(url),
          stableKey(`${project.slug}-gallery-${imageIndex}-${url}`),
          `${project.title} image ${imageIndex + 1}`,
        ),
      );
    }

    if (existing) {
      transaction.patch(documentId, (patch) => {
        const nextPatch = patch.set(fields);
        const categoryFallbacks = [project.category, project.legacySynopsisFallback]
          .filter(Boolean)
          .map(normalizeTitle);
        if (
          !project.synopsis &&
          existing.synopsis &&
          categoryFallbacks.includes(normalizeTitle(existing.synopsis))
        ) {
          nextPatch.unset(["synopsis"]);
        }
        return nextPatch;
      });
    } else {
      let slug = project.slug;
      if (usedSlugs.has(slug)) {
        slug = `${categoryGroup(project.category)}-${slug}`;
      }
      if (usedSlugs.has(slug)) {
        throw new Error(`Cannot create a unique Sanity slug for ${project.title}.`);
      }
      usedSlugs.add(slug);
      const document = {
        _id: documentId,
        _type: "film",
        slug: {_type: "slug", current: slug},
        category: project.category,
        ...fields,
      };
      transaction.createIfNotExists(document);
      newDocuments.push(documentId);
    }
  }

  const result = await transaction.commit();
  await mkdir(reportDirectory, {recursive: true});
  await writeFile(
    path.join(reportDirectory, "import-result.json"),
    `${JSON.stringify(
      {
        importedAt: new Date().toISOString(),
        sourceProjectCount: sourceProjects.length,
        existingDocumentCount: existingDocuments.length,
        createdDocumentIds: newDocuments,
        uploadedImageCount: assetIds.size,
        hostedVideoUrlsPreserved: hostedVideoUrls,
        transactionId: result.transactionId,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`Committed ${sourceProjects.length} film documents in transaction ${result.transactionId}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMigration().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
