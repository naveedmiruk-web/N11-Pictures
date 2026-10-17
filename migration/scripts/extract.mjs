import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import csvParser from "csv-parser";
import { JSDOM } from "jsdom";
import {
  delay,
  categoryGroup,
  extractImageUrls,
  extractVideoEmbeds,
  extractVideoFileUrls,
  extractionDirectory,
  listCsvFiles,
  normalizeUrl,
  normalizeTitle,
  snapshotPath,
  sourceListingUrl,
} from "./shared.mjs";

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (row) => {
        rows.push(
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key.replace(/^\uFEFF/, "").trim(),
              typeof value === "string" ? value.trim() : value,
            ]),
          ),
        );
      })
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {"user-agent": "N11-Sanity-Migration/1.0"},
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`GET ${url} returned HTTP ${response.status}`);
  }

  return response.text();
}

function extractBackgroundUrl(element, baseUrl) {
  if (!element) return undefined;

  const style = element.getAttribute("style") ?? "";
  const match = style.match(/url\((?:"|')?(.+?)(?:"|')?\)/i);
  return normalizeUrl(
    element.getAttribute("data-poster-url") ?? match?.[1],
    baseUrl,
  );
}

function readListingProjects(html) {
  const document = new JSDOM(html, {url: sourceListingUrl}).window.document;
  const cards = [...document.querySelectorAll("a.link-work-3[href]")];

  if (cards.length === 0) {
    throw new Error("No project cards found on the public Work page.");
  }

  const projects = cards.map((card) => {
    const sourceUrl = new URL(card.getAttribute("href"), sourceListingUrl);
    const slug = decodeURIComponent(sourceUrl.pathname.replace(/\/+$/, "").split("/").pop() ?? "");

    return {
      slug,
      title: card.querySelector(".heading-work")?.textContent?.trim() ?? "",
      category: card.querySelector(".info-work")?.textContent?.trim() ?? "",
      routeCategory: sourceUrl.pathname.split("/").filter(Boolean)[0] ?? "",
      url: sourceUrl.toString(),
      cardImageUrl: extractBackgroundUrl(card.querySelector(".bg-img-work-3"), sourceUrl),
    };
  });

  return projects;
}

function extractDetail(html, url) {
  const document = new JSDOM(html, {url}).window.document;
  const richTextElements = [
    ...document.querySelectorAll(".content.project .w-richtext, .content.project .rich-text-block"),
  ];
  const contentHtml = richTextElements.map((element) => element.innerHTML.trim()).filter(Boolean);
  const contentImages = contentHtml.flatMap((source) => extractImageUrls(source, url));
  const contentVideos = contentHtml.flatMap((source) => extractVideoEmbeds(source, url));
  const heroElement =
    document.querySelector("[data-poster-url]") ??
    document.querySelector(".section-top [style*='background-image']") ??
    document.querySelector(".section-top [style*='backgroundImage']");

  return {
    title:
      document.querySelector(".heading-project")?.textContent?.trim() ??
      document.querySelector("h1")?.textContent?.trim() ??
      "",
    heroImageUrl: extractBackgroundUrl(heroElement, url),
    contentHtml,
    imageUrls: [...new Set(contentImages)],
    videoEmbeds: contentVideos,
    hostedVideoUrls: extractVideoFileUrls(document.documentElement.outerHTML, url),
  };
}

function findCsvRow(project, csvRows, matchedRows) {
  const routeGroup = categoryGroup(project.routeCategory);
  const cardGroup = categoryGroup(project.category);
  const expectedGroup =
    routeGroup !== "project" && routeGroup !== "project copy" ? routeGroup : cardGroup;
  const slugMatches = csvRows.filter(
    (row) => !matchedRows.has(row) && row.Slug?.trim().toLowerCase() === project.slug.toLowerCase(),
  );
  const categorizedSlugMatches = slugMatches.filter(
    (row) => categoryGroup(row._sourceCategory) === expectedGroup,
  );
  if (categorizedSlugMatches.length === 1) return categorizedSlugMatches[0];
  if (categorizedSlugMatches.length > 1) {
    throw new Error(`Ambiguous CSV rows for slug "${project.slug}" in category "${expectedGroup}".`);
  }
  if (!expectedGroup && slugMatches.length === 1) return slugMatches[0];
  if (slugMatches.length > 1) {
    throw new Error(`Ambiguous CSV rows for slug "${project.slug}" across different categories.`);
  }

  const title = normalizeTitle(project.title);
  const titleMatches = csvRows.filter(
    (row) => !matchedRows.has(row) && normalizeTitle(row.Name) === title,
  );

  if (titleMatches.length === 0) return null;

  const categoryMatches = titleMatches.filter(
    (row) => categoryGroup(row._sourceCategory) === expectedGroup,
  );

  if (categoryMatches.length === 1) return categoryMatches[0];
  if (categoryMatches.length > 1) {
    throw new Error(`Ambiguous CSV rows for "${project.title}" in category "${expectedGroup}".`);
  }

  if (!expectedGroup && titleMatches.length === 1) return titleMatches[0];
  if (titleMatches.length > 1) {
    throw new Error(`Ambiguous CSV rows for "${project.title}" across different categories.`);
  }

  return null;
}

async function main() {
  const csvFiles = await listCsvFiles();
  const csvRows = [];
  const csvSummary = [];
  const matchedCsvRows = new Set();

  for (const filePath of csvFiles) {
    const rows = await readCsv(filePath);
    const sourceCategory = path.basename(filePath).split(" - ")[1] ?? "";
    const rowsWithMetadata = rows
      .filter((row) => row.Name && row.Slug)
      .map((row) => ({
        ...row,
        _sourceFile: path.basename(filePath),
        _sourceCategory: sourceCategory,
      }));
    csvRows.push(...rowsWithMetadata);

    csvSummary.push({
      file: path.basename(filePath),
      rows: rows.length,
      rowsWithSlug: rowsWithMetadata.length,
    });
  }

  const listingHtml = await fetchHtml(sourceListingUrl);
  const projects = readListingProjects(listingHtml);
  const failures = [];
  const extractedProjects = [];

  for (let index = 0; index < projects.length; index += 1) {
    const project = projects[index];
    const csvRow = findCsvRow(project, csvRows, matchedCsvRows);
    if (csvRow) matchedCsvRows.add(csvRow);
    let detail = null;

    try {
      detail = extractDetail(await fetchHtml(project.url), project.url);
    } catch (error) {
      failures.push({
        slug: project.slug,
        url: project.url,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    extractedProjects.push({
      ...project,
      csvRow,
      detail,
    });

    if (index < projects.length - 1) {
      await delay(150);
    }
  }

  const unmatchedCsvRows = csvRows
    .filter((row) => !matchedCsvRows.has(row))
    .map(({Name, Slug, _sourceCategory, _sourceFile}) => ({
      title: Name,
      slug: Slug,
      category: _sourceCategory,
      file: _sourceFile,
    }));
  const snapshot = {
    source: sourceListingUrl,
    extractedAt: new Date().toISOString(),
    projectCount: extractedProjects.length,
    csvSummary,
    matchedCsvRowCount: matchedCsvRows.size,
    unmatchedCsvRows,
    failures,
    projects: extractedProjects,
  };

  await mkdir(extractionDirectory, {recursive: true});
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Saved ${extractedProjects.length} projects to ${snapshotPath}`);
  console.log(`CSV rows matched to the public listing: ${matchedCsvRows.size}`);
  console.log(`CSV rows not present in the public listing: ${unmatchedCsvRows.length}`);

  if (failures.length > 0) {
    console.error(`Failed to fetch ${failures.length} project pages:`);
    for (const failure of failures) {
      console.error(`- ${failure.slug}: ${failure.error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
