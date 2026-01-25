import { Command } from "commander";
import { executeInstall, type InstallCliOptions } from "./install.js";
import { registerSyncCommand } from "./sync.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("instl")
    .description("A CLI tool for installing files with LTSV recipe support")
    .helpCommand(false)
    .enablePositionalOptions()
    .argument(
      "[sources...]",
      "Source files or directories (last argument is DEST unless -d is used)",
    )
    .option("-m, --mode <mode>", "Set permission mode (octal: 644, 0644, 1755)")
    .option("-o, --owner <uid>", "Set owner UID")
    .option("-g, --group <gid>", "Set group GID")
    .option("-d, --directory", "Create directories (mkdir -p equivalent)")
    .option("-b, --backup", "Create backup of existing files (.old extension)")
    .option("-l, --symlink", "Create symbolic link instead of copy")
    .option("-v, --verbose", "Enable verbose output")
    .option("--dry-run", "Show what would be done without executing")
    .version(typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0-dev")
    .action((sources: string[], options: InstallCliOptions) => {
      if (sources.length === 0) {
        program.help();
        return;
      }
      executeInstall(sources, options);
    });

  registerSyncCommand(program);

  return program;
}
