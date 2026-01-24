export interface InstallOptions {
  mode?: string;
  owner?: number;
  group?: number;
  directory: boolean;
  backup: boolean;
  symlink: boolean;
  verbose: boolean;
  dryRun: boolean;
}

export interface SyncOptions {
  verbose: boolean;
  dryRun: boolean;
}

export type RecipeOperation = "touch" | "mkdir" | "cp" | "ln";

export interface RecipeEntry {
  op: RecipeOperation;
  src?: string;
  dest: string;
  mode?: string;
  owner?: number;
  group?: number;
}

export interface LoggerOptions {
  verbose: boolean;
  dryRun: boolean;
}

export type LogAction =
  | "COPY"
  | "MKDIR"
  | "LINK"
  | "TOUCH"
  | "CHOWN"
  | "CHMOD"
  | "BACKUP"
  | "DELETE";
