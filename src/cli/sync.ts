import * as path from "node:path";
import type { Command } from "commander";
import { executeRecipe } from "../recipe/executor.js";
import { parseRecipeFile } from "../recipe/parser.js";
import type { SyncOptions } from "../types/index.js";
import { createLogger } from "../utils/logger.js";

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Synchronize files according to LTSV recipe file")
    .argument("<recipe>", "Path to LTSV recipe file")
    .option("-v, --verbose", "Enable verbose output")
    .option("--dry-run", "Show what would be done without executing")
    .action(executeSync);
}

interface SyncCliOptions {
  verbose?: boolean;
  dryRun?: boolean;
}

function executeSync(recipePath: string, cliOptions: SyncCliOptions): void {
  try {
    const options: SyncOptions = {
      verbose: cliOptions.verbose ?? false,
      dryRun: cliOptions.dryRun ?? false,
    };

    const logger = createLogger({
      verbose: options.verbose,
      dryRun: options.dryRun,
    });

    // Parse recipe file
    const absoluteRecipePath = path.resolve(recipePath);
    const recipeDir = path.dirname(absoluteRecipePath);
    const entries = parseRecipeFile(absoluteRecipePath);

    // Execute recipe
    executeRecipe(entries, recipeDir, options, logger);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}
