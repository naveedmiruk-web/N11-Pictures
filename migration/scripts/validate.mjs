import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@sanity/client";
import { reportDirectory, sanityConfig, snapshotPath } from "./shared.mjs";
import { categoryGroup } from "./shared.mjs";
import { transformProject } from "./import.mjs";

async function main() {
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  if (!Array.isArray(snapshot.projects) || snapshot.projects.length === 0) {
    throw new Error("The extracted snapshot has no projects. Run npm run migrate:extract first.");
  }

  const client = createClient({...sanityConfig, useCdn: false});
  const documents = await client.fetch(`*[_type == "film"]{
    _id,
    title,
    "slug": slug.current,
    category,
    "heroImageUrl": heroImage.asset->url,
    "gallery": gallery[]{ "imageUrl": asset->url },
    "projectDetailsCount": count(projectDetails),
    trailerUrl,
    "btsVideos": btsVideos,
    "sourceUrl": sourceMetadata.url
  }`);
  const documentsBySourceUrl = new Map();

  for (const document of documents) {
    if (document.sourceUrl) {
      const sourceMatches = documentsBySourceUrl.get(document.sourceUrl) ?? [];
      sourceMatches.push(document);
      documentsBySourceUrl.set(document.sourceUrl, sourceMatches);
    }
  }

  const issues = [];
  const migrated = [];
  const sourceRoutes = new Set();

  for (const rawProject of snapshot.projects) {
    const project = transformProject(rawProject);
    const nextRoute = new URL(project.sourceMetadata.url).pathname;
    if (sourceRoutes.has(nextRoute)) {
      issues.push({
        severity: "error",
        slug: project.slug,
        message: `Multiple source projects map to route ${nextRoute}.`,
      });
      continue;
    }
    sourceRoutes.add(nextRoute);

    const matches = documentsBySourceUrl.get(project.sourceMetadata.url) ?? [];
    if (matches.length !== 1) {
      issues.push({
        severity: "error",
        slug: project.slug,
        message: `Expected one Sanity film document for ${project.sourceMetadata.url}, found ${matches.length}.`,
      });
      continue;
    }

    const document = matches[0];
    const gallery = document.gallery ?? [];
    if (!document.heroImageUrl?.startsWith("https://cdn.sanity.io/")) {
      issues.push({severity: "error", slug: project.slug, message: "Hero image is missing or not hosted in Sanity."});
    }
    if (gallery.some((image) => !image.imageUrl?.startsWith("https://cdn.sanity.io/"))) {
      issues.push({severity: "error", slug: project.slug, message: "A gallery image is missing or not hosted in Sanity."});
    }
    if (gallery.length !== project.galleryImageUrls.length) {
      issues.push({
        severity: "error",
        slug: project.slug,
        message: `Expected ${project.galleryImageUrls.length} gallery images, found ${gallery.length}.`,
      });
    }
    if (project.projectDetails?.length && !document.projectDetailsCount) {
      issues.push({severity: "error", slug: project.slug, message: "Portable Text details are missing."});
    }
    if ((document.projectDetailsCount ?? 0) < (project.projectDetails?.length ?? 0)) {
      issues.push({
        severity: "error",
        slug: project.slug,
        message: `Expected at least ${project.projectDetails.length} Portable Text blocks, found ${document.projectDetailsCount ?? 0}.`,
      });
    }
    if ((document.btsVideos?.length ?? 0) < (project.btsVideos?.length ?? 0)) {
      issues.push({
        severity: "error",
        slug: project.slug,
        message: `Expected at least ${project.btsVideos.length} additional video URLs, found ${document.btsVideos?.length ?? 0}.`,
      });
    }
    if (document.trailerUrl !== project.trailerUrl) {
      issues.push({
        severity: "error",
        slug: project.slug,
        message: project.trailerUrl
          ? "The main trailer URL is missing or differs from the source."
          : "Sanity contains a main trailer URL that is absent from the current source.",
      });
    }
    if (categoryGroup(document.category) !== categoryGroup(project.category)) {
      issues.push({
        severity: "warning",
        slug: project.slug,
        message: `Category differs: source "${project.category}", Sanity "${document.category ?? ""}".`,
      });
    }
    migrated.push({
      slug: project.slug,
      title: document.title,
      sourceUrl: project.sourceMetadata.url,
      nextRoute: new URL(project.sourceMetadata.url).pathname,
      heroImageUrl: document.heroImageUrl,
      galleryImageCount: gallery.length,
      projectDetailsCount: document.projectDetailsCount ?? 0,
      hasTrailer: Boolean(document.trailerUrl),
      additionalVideoUrlCount: document.btsVideos?.length ?? 0,
    });
  }

  const report = {
    validatedAt: new Date().toISOString(),
    sourceProjectCount: snapshot.projects.length,
    sanityFilmDocumentCount: documents.length,
    validatedProjectCount: migrated.length,
    issueCount: issues.length,
    issues,
    projects: migrated,
  };

  await mkdir(reportDirectory, {recursive: true});
  await writeFile(
    path.join(reportDirectory, "validation.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  const errors = issues.filter((issue) => issue.severity === "error");
  console.log(`Source projects: ${report.sourceProjectCount}`);
  console.log(`Sanity film documents: ${report.sanityFilmDocumentCount}`);
  console.log(`Validated routes: ${report.validatedProjectCount}`);
  console.log(`Projects with main trailer: ${migrated.filter((project) => project.hasTrailer).length}`);
  console.log(`Additional video URLs: ${migrated.reduce((count, project) => count + project.additionalVideoUrlCount, 0)}`);
  console.log(`Errors: ${errors.length}; warnings: ${issues.length - errors.length}`);
  console.log("Route coverage: each legacy project URL has a /project/[slug] route mapping in validation.json.");

  if (errors.length > 0) {
    console.error(`Validation failed. See migration/reports/validation.json.`);
    process.exitCode = 1;
  } else {
    console.log("Validation passed. See migration/reports/validation.json.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
