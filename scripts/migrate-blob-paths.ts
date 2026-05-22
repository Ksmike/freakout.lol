/**
 * One-time blob path migration script.
 *
 * Migrates existing Vercel Blob objects from the old userId-based path format
 * to the new firmId-based format:
 *
 *   OLD: {userId}/{projectId}/{filename}
 *   NEW: {firmId}/{projectId}/{filename}
 *
 * Also updates the `pathname` column in the `ProjectDocument` table to match.
 *
 * Usage:
 *   export $(grep -v '^#' .env | xargs) && yarn tsx scripts/migrate-blob-paths.ts
 *
 * The script is idempotent — it skips blobs that are already in the new format
 * (i.e. whose prefix matches a firmId rather than a userId).
 *
 * Run in a maintenance window. Blobs are copied then deleted, so there is a
 * brief period where both old and new paths exist.
 */

import "dotenv/config";
import { copy, del, list } from "@vercel/blob";
import { db } from "@/lib/db";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`Blob path migration — ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log("─".repeat(60));

  // 1. Load all projects with their userId and firmId
  const projects = await db.project.findMany({
    select: {
      id: true,
      userId: true,
      firmId: true,
    },
  });

  console.log(`Found ${projects.length} projects.`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const project of projects) {
    const oldPrefix = `${project.userId}/${project.id}/`;
    const newPrefix = `${project.firmId}/${project.id}/`;

    if (oldPrefix === newPrefix) {
      // userId === firmId — already effectively migrated (single-user firm)
      skipped++;
      continue;
    }

    // List blobs under the old prefix
    let cursor: string | undefined;
    const blobsToMigrate: Array<{ url: string; pathname: string }> = [];

    do {
      const result = await list({ prefix: oldPrefix, cursor });
      blobsToMigrate.push(...result.blobs);
      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);

    if (blobsToMigrate.length === 0) {
      skipped++;
      continue;
    }

    console.log(
      `Project ${project.id}: ${blobsToMigrate.length} blob(s) to migrate`
    );

    for (const blob of blobsToMigrate) {
      const filename = blob.pathname.slice(oldPrefix.length);
      const newPathname = `${newPrefix}${filename}`;

      try {
        if (!DRY_RUN) {
          // Copy to new path
          await copy(blob.url, newPathname, { access: "private" });

          // Update the DB record
          await db.projectDocument.updateMany({
            where: {
              projectId: project.id,
              pathname: blob.pathname,
            },
            data: { pathname: newPathname },
          });

          // Delete old blob
          await del(blob.url);
        }

        console.log(
          `  ${DRY_RUN ? "[dry]" : "✓"} ${blob.pathname} → ${newPathname}`
        );
        migrated++;
      } catch (err) {
        console.error(
          `  ✗ Failed to migrate ${blob.pathname}:`,
          err instanceof Error ? err.message : err
        );
        errors++;
      }
    }
  }

  console.log("─".repeat(60));
  console.log(
    `Done. Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`
  );

  if (errors > 0) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
