import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  fileExists,
  readFile,
  getFileMode,
  isSymlink,
  getSymlinkTarget,
  isDirectory,
  runInstl,
} from '../setup.js';

describe('instl install', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('file copy', () => {
    it('should copy a single file', () => {
      const src = createTestFile(tempDir, 'source.txt', 'hello world');
      const dest = path.join(tempDir, 'dest.txt');

      const result = runInstl(`install ${src} ${dest}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(fileExists(dest), true);
      assert.strictEqual(readFile(dest), 'hello world');
    });

    it('should copy a single file to a directory', () => {
      const src = createTestFile(tempDir, 'source.txt', 'hello');
      const destDir = path.join(tempDir, 'destdir');
      fs.mkdirSync(destDir);

      const result = runInstl(`install ${src} ${destDir}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(fileExists(path.join(destDir, 'source.txt')), true);
    });

    it('should copy multiple files to a directory', () => {
      const src1 = createTestFile(tempDir, 'file1.txt', 'one');
      const src2 = createTestFile(tempDir, 'file2.txt', 'two');
      const destDir = path.join(tempDir, 'destdir');
      fs.mkdirSync(destDir);

      const result = runInstl(`install ${src1} ${src2} ${destDir}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(readFile(path.join(destDir, 'file1.txt')), 'one');
      assert.strictEqual(readFile(path.join(destDir, 'file2.txt')), 'two');
    });

    it('should fail when copying multiple files to non-directory', () => {
      const src1 = createTestFile(tempDir, 'file1.txt', 'one');
      const src2 = createTestFile(tempDir, 'file2.txt', 'two');
      const dest = path.join(tempDir, 'notexist');

      const result = runInstl(`install ${src1} ${src2} ${dest}`);
      assert.strictEqual(result.exitCode, 1);
    });

    it('should fail when source does not exist', () => {
      const src = path.join(tempDir, 'notexist.txt');
      const dest = path.join(tempDir, 'dest.txt');

      const result = runInstl(`install ${src} ${dest}`);
      assert.strictEqual(result.exitCode, 1);
    });
  });

  describe('mode option', () => {
    it('should set file mode with -m option (3 digit)', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'dest.txt');

      runInstl(`install -m 600 ${src} ${dest}`);
      assert.strictEqual(getFileMode(dest), 0o600);
    });

    it('should set file mode with -m option (4 digit)', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'dest.txt');

      runInstl(`install -m 0755 ${src} ${dest}`);
      assert.strictEqual(getFileMode(dest), 0o755);
    });

    it('should default to 644 for files', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'dest.txt');

      runInstl(`install ${src} ${dest}`);
      assert.strictEqual(getFileMode(dest), 0o644);
    });
  });

  describe('directory mode (-d)', () => {
    it('should create a single directory', () => {
      const dir = path.join(tempDir, 'newdir');

      const result = runInstl(`install -d ${dir}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(isDirectory(dir), true);
    });

    it('should create multiple directories', () => {
      const dir1 = path.join(tempDir, 'dir1');
      const dir2 = path.join(tempDir, 'dir2');

      const result = runInstl(`install -d ${dir1} ${dir2}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(isDirectory(dir1), true);
      assert.strictEqual(isDirectory(dir2), true);
    });

    it('should create nested directories', () => {
      const dir = path.join(tempDir, 'a/b/c');

      const result = runInstl(`install -d ${dir}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(isDirectory(dir), true);
    });

    it('should set directory mode with -m option', () => {
      const dir = path.join(tempDir, 'newdir');

      runInstl(`install -d -m 700 ${dir}`);
      assert.strictEqual(getFileMode(dir), 0o700);
    });

    it('should default to 755 for directories', () => {
      const dir = path.join(tempDir, 'newdir');

      runInstl(`install -d ${dir}`);
      assert.strictEqual(getFileMode(dir), 0o755);
    });

    it('should fail when combining -d with -b', () => {
      const dir = path.join(tempDir, 'newdir');
      const result = runInstl(`install -d -b ${dir}`);
      assert.strictEqual(result.exitCode, 1);
    });

    it('should fail when combining -d with -l', () => {
      const dir = path.join(tempDir, 'newdir');
      const result = runInstl(`install -d -l ${dir}`);
      assert.strictEqual(result.exitCode, 1);
    });
  });

  describe('symlink mode (-l)', () => {
    it('should create a symbolic link', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'link');

      const result = runInstl(`install -l ${src} ${dest}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(isSymlink(dest), true);
      assert.strictEqual(getSymlinkTarget(dest), src);
    });

    it('should replace existing file with symlink', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = createTestFile(tempDir, 'existing.txt', 'old');

      const result = runInstl(`install -l ${src} ${dest}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(isSymlink(dest), true);
    });

    it('should replace existing symlink', () => {
      const src1 = createTestFile(tempDir, 'source1.txt', 'one');
      const src2 = createTestFile(tempDir, 'source2.txt', 'two');
      const dest = path.join(tempDir, 'link');
      fs.symlinkSync(src1, dest);

      const result = runInstl(`install -l ${src2} ${dest}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(getSymlinkTarget(dest), src2);
    });

    it('should fail when dest is a directory', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'existingdir');
      fs.mkdirSync(dest);

      const result = runInstl(`install -l ${src} ${dest}`);
      assert.strictEqual(result.exitCode, 1);
    });

    it('should fail with multiple sources', () => {
      const src1 = createTestFile(tempDir, 'source1.txt', 'one');
      const src2 = createTestFile(tempDir, 'source2.txt', 'two');
      const dest = path.join(tempDir, 'link');

      const result = runInstl(`install -l ${src1} ${src2} ${dest}`);
      assert.strictEqual(result.exitCode, 1);
    });

    it('should fail when combining -l with -b', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'link');
      const result = runInstl(`install -l -b ${src} ${dest}`);
      assert.strictEqual(result.exitCode, 1);
    });
  });

  describe('backup mode (-b)', () => {
    it('should create backup when dest exists', () => {
      const src = createTestFile(tempDir, 'source.txt', 'new content');
      const dest = createTestFile(tempDir, 'dest.txt', 'old content');
      const backupPath = dest + '.old';

      const result = runInstl(`install -b ${src} ${dest}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(fileExists(backupPath), true);
      assert.strictEqual(readFile(backupPath), 'old content');
      assert.strictEqual(readFile(dest), 'new content');
    });

    it('should not create backup when dest does not exist', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'newdest.txt');
      const backupPath = dest + '.old';

      const result = runInstl(`install -b ${src} ${dest}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(fileExists(backupPath), false);
      assert.strictEqual(readFile(dest), 'content');
    });

    it('should overwrite existing .old file', () => {
      const src = createTestFile(tempDir, 'source.txt', 'newest');
      const dest = createTestFile(tempDir, 'dest.txt', 'current');
      const backupPath = dest + '.old';
      createTestFile(tempDir, 'dest.txt.old', 'oldest');

      const result = runInstl(`install -b ${src} ${dest}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(readFile(backupPath), 'current');
      assert.strictEqual(readFile(dest), 'newest');
    });
  });

  describe('dry-run', () => {
    it('should not create file in dry-run mode', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'dest.txt');

      const result = runInstl(`install --dry-run ${src} ${dest}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(fileExists(dest), false);
    });

    it('should not create directory in dry-run mode', () => {
      const dir = path.join(tempDir, 'newdir');

      const result = runInstl(`install -d --dry-run ${dir}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(fileExists(dir), false);
    });

    it('should not create symlink in dry-run mode', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'link');

      const result = runInstl(`install -l --dry-run ${src} ${dest}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(fileExists(dest), false);
    });
  });

  describe('verbose', () => {
    it('should show output in verbose mode', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const dest = path.join(tempDir, 'dest.txt');

      const result = runInstl(`install --verbose ${src} ${dest}`);
      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('[COPY]'));
    });
  });
});
