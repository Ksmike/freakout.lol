/**
 * Graph seed runner.
 * Usage: yarn tsx lib/graph/seeds/seed.ts
 */

import { seedCommercialDueDiligenceGraph } from "./commercial-due-diligence";

async function main() {
  await seedCommercialDueDiligenceGraph();
  console.log("All graph seeds complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
