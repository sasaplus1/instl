import * as fs from "node:fs";
import type { Logger } from "../utils/logger.js";

export function setMode(
  filePath: string,
  mode: number,
  logger: Logger,
  dryRun: boolean,
): void {
  const modeStr = mode.toString(8).padStart(4, "0");
  logger.logAction("CHMOD", `${filePath} (mode: ${modeStr})`);

  if (!dryRun) {
    fs.chmodSync(filePath, mode);
  }
}

export function setOwner(
  filePath: string,
  uid: number | undefined,
  gid: number | undefined,
  logger: Logger,
  dryRun: boolean,
  isSymlink: boolean = false,
): void {
  if (uid === undefined && gid === undefined) {
    return;
  }

  const stat = fs.lstatSync(filePath);
  const currentUid = uid ?? stat.uid;
  const currentGid = gid ?? stat.gid;

  const uidStr = uid !== undefined ? `uid: ${uid}` : "";
  const gidStr = gid !== undefined ? `gid: ${gid}` : "";
  const details = [uidStr, gidStr].filter(Boolean).join(", ");
  logger.logAction("CHOWN", `${filePath} (${details})`);

  if (!dryRun) {
    if (isSymlink) {
      // Use lchown for symlinks to change the symlink itself, not the target
      fs.lchownSync(filePath, currentUid, currentGid);
    } else {
      fs.chownSync(filePath, currentUid, currentGid);
    }
  }
}
