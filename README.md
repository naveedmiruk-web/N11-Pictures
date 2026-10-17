# Sanity Clean Content Studio

Congratulations, you have now installed the Sanity Content Studio, an open-source real-time content editing environment connected to the Sanity backend.

Now you can do the following things:

- [Read “getting started” in the docs](https://www.sanity.io/docs/introduction/getting-started?utm_source=readme)
- [Join the Sanity community](https://www.sanity.io/community/join?utm_source=readme)
- [Extend and build plugins](https://www.sanity.io/docs/content-studio/extending?utm_source=readme)

## Webflow project migration

The migration scripts combine the public Work pages with the Webflow CSV exports in `csv-data`.
They match projects to existing Sanity films by source URL when available, then by title and
category, preserving existing document IDs and slugs. Images are prepared for upload as Sanity
assets; YouTube, Vimeo, and hosted video URLs are preserved in the film document and remain on
their streaming host rather than being uploaded as raw Sanity file assets.

1. Run `npm run migrate:extract` to fetch the listing and project pages. The snapshot is saved
   under the ignored `migration/extracted` directory.
2. Run `npm run migrate:import` to review the read-only dry-run totals. This is the default and
   does not write assets or documents.
3. After reviewing the snapshot and dry-run, put a newly issued token in the ignored
   `studio-n11-pictures/.env.local` file alongside `SANITY_ALLOW_PRODUCTION_IMPORT=YES`, then run
   `npm run migrate:import -- --commit`. Do not put the token in source control or chat.
4. After a successful import, run `npm run migrate:validate`. The report is saved under the
   ignored `migration/reports` directory and checks every source route path, image, Portable Text
   body, and additional video URL.

The import command writes to the production dataset. Do not use `--commit` without explicit
approval and a reviewed dry run.
