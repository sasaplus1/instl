import * as fs from "node:fs";
import * as path from "node:path";
import type { Command } from "commander";
import { copyFile, createSymlink, makeDirectory } from "../core/operations.js";
import type { InstallOptions } from "../types/index.js";
import { createLogger } from "../utils/logger.js";
import {
  parseMode,
  validateGid,
  validateInstallOptions,
  validateUid,
} from "../utils/validation.js";

export function registerInstallCommand(program: Command): void {
  program
    .command("install")
    .description("Install files or directories")
    .argument(
      "<sources...>",
      "Source files or directories (last argument is DEST unless -d is used)",
    )
    .option("-m, --mode <mode>", "Set permission mode (octal: 644, 0644, 1755)")
    .option("-o, --owner <uid>", "Set owner UID")
    .option("-g, --group <gid>", "Set group GID")
    .option("-d, --directory", "Create directories (mkdir -p equivalent)")
    .option("-b, --backup", "Create backup of existing files (.old extension)")
    .option("-l, --symlink", "Create symbolic link instead of copy")
    .option("--verbose", "Enable verbose output")
    .option("--dry-run", "Show what would be done without executing")
    .action(executeInstall);
}

interface InstallCliOptions {
  mode?: string;
  owner?: string;
  group?: string;
  directory?: boolean;
  backup?: boolean;
  symlink?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
}

function executeInstall(args: string[], cliOptions: InstallCliOptions): void {
  try {
    const options: InstallOptions = {
      directory: cliOptions.directory ?? false,
      backup: cliOptions.backup ?? false,
      symlink: cliOptions.symlink ?? false,
      verbose: cliOptions.verbose ?? false,
      dryRun: cliOptions.dryRun ?? false,
    };
    if (cliOptions.mode !== undefined) options.mode = cliOptions.mode;
    if (cliOptions.owner !== undefined)
      options.owner = validateUid(cliOptions.owner);
    if (cliOptions.group !== undefined)
      options.group = validateGid(cliOptions.group);

    validateInstallOptions(options);

    const logger = createLogger({
      verbose: options.verbose,
      dryRun: options.dryRun,
    });

    if (options.directory) {
      executeDirectoryMode(args, options, logger);
    } else if (options.symlink) {
      executeSymlinkMode(args, options, logger);
    } else {
      executeCopyMode(args, options, logger);
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

function executeDirectoryMode(
  dirs: string[],
  options: InstallOptions,
  logger: ReturnType<typeof createLogger>,
): void {
  if (dirs.length === 0) {
    throw new Error("No directories specified");
  }

  const mode = parseMode(options.mode, 0o755);

  for (const dir of dirs) {
    makeDirectory(
      dir,
      {
        mode,
        dryRun: options.dryRun,
        ...(options.owner !== undefined ? { owner: options.owner } : {}),
        ...(options.group !== undefined ? { group: options.group } : {}),
      },
      logger,
    );
  }
}

function executeSymlinkMode(
  args: string[],
  options: InstallOptions,
  logger: ReturnType<typeof createLogger>,
): void {
  if (args.length < 2) {
    throw new Error("Requires SOURCE and DEST arguments");
  }

  if (args.length > 2) {
    throw new Error("Symlink mode does not support multiple sources");
  }

  const src = args[0];
  const dest = args[1];
  if (src === undefined || dest === undefined) {
    throw new Error("Requires SOURCE and DEST arguments");
  }

  createSymlink(
    src,
    dest,
    {
      dryRun: options.dryRun,
      ...(options.owner !== undefined ? { owner: options.owner } : {}),
      ...(options.group !== undefined ? { group: options.group } : {}),
    },
    logger,
  );
}

function executeCopyMode(
  args: string[],
  options: InstallOptions,
  logger: ReturnType<typeof createLogger>,
): void {
  if (args.length < 2) {
    throw new Error("Requires SOURCE and DEST arguments");
  }

  const sources = args.slice(0, -1);
  const dest = args[args.length - 1];
  if (dest === undefined) {
    throw new Error("Requires SOURCE and DEST arguments");
  }
  const mode = parseMode(options.mode, 0o644);

  if (sources.length === 1) {
    // Single source: copy to dest (file or dir/filename)
    const src = sources[0];
    if (src === undefined) {
      throw new Error("Requires SOURCE and DEST arguments");
    }
    let finalDest = dest;

    if (fs.existsSync(dest)) {
      const destStat = fs.statSync(dest);
      if (destStat.isDirectory()) {
        finalDest = path.join(dest, path.basename(src));
      }
    }

    copyFile(
      src,
      finalDest,
      {
        mode,
        backup: options.backup,
        dryRun: options.dryRun,
        ...(options.owner !== undefined ? { owner: options.owner } : {}),
        ...(options.group !== undefined ? { group: options.group } : {}),
      },
      logger,
    );
  } else {
    // Multiple sources: dest must be existing directory
    if (!fs.existsSync(dest)) {
      throw new Error(`Destination directory does not exist: ${dest}`);
    }

    const destStat = fs.statSync(dest);
    if (!destStat.isDirectory()) {
      throw new Error(`Destination is not a directory: ${dest}`);
    }

    for (const src of sources) {
      const finalDest = path.join(dest, path.basename(src));
      copyFile(
        src,
        finalDest,
        {
          mode,
          backup: options.backup,
          dryRun: options.dryRun,
          ...(options.owner !== undefined ? { owner: options.owner } : {}),
          ...(options.group !== undefined ? { group: options.group } : {}),
        },
        logger,
      );
    }
  }
}
