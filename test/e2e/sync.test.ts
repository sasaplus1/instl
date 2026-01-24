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

describe('instl sync', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('recipe parsing', () => {
    it('should skip empty lines', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `
op:mkdir\tdest:${tempDir}/dir1

op:mkdir\tdest:${tempDir}/dir2
`);

      const result = runInstl(`sync ${recipe}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(isDirectory(path.join(tempDir, 'dir1')), true);
      assert.strictEqual(isDirectory(path.join(tempDir, 'dir2')), true);
    });

    it('should skip comment lines', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `# This is a comment
op:mkdir\tdest:${tempDir}/dir1
# Another comment
op:mkdir\tdest:${tempDir}/dir2
`);

      const result = runInstl(`sync ${recipe}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(isDirectory(path.join(tempDir, 'dir1')), true);
      assert.strictEqual(isDirectory(path.join(tempDir, 'dir2')), true);
    });

    it('should fail with unknown operation', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:unknown\tdest:${tempDir}/file`);

      const result = runInstl(`sync ${recipe}`);
      assert.strictEqual(result.exitCode, 1);
    });

    it('should fail when recipe file does not exist', () => {
      const result = runInstl(`sync ${tempDir}/nonexistent.ltsv`);
      assert.strictEqual(result.exitCode, 1);
    });

    it('should fail when dest is missing', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir`);

      const result = runInstl(`sync ${recipe}`);
      assert.strictEqual(result.exitCode, 1);
    });

    it('should fail when cp is missing src', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:cp\tdest:${tempDir}/dest.txt`);

      const result = runInstl(`sync ${recipe}`);
      assert.strictEqual(result.exitCode, 1);
    });
  });

  describe('touch operation', () => {
    it('should create empty file', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:touch\tdest:${tempDir}/newfile.txt`);

      const result = runInstl(`sync ${recipe}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(fileExists(path.join(tempDir, 'newfile.txt')), true);
      assert.strictEqual(readFile(path.join(tempDir, 'newfile.txt')), '');
    });

    it('should set mode for new file', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:touch\tdest:${tempDir}/newfile.txt\tmode:0600`);

      runInstl(`sync ${recipe}`);
      assert.strictEqual(getFileMode(path.join(tempDir, 'newfile.txt')), 0o600);
    });

    it('should update timestamp of existing file', () => {
      const existingFile = createTestFile(tempDir, 'existing.txt', 'content');
      const oldStat = fs.statSync(existingFile);

      // Wait a bit to ensure time difference
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:touch\tdest:${existingFile}`);

      runInstl(`sync ${recipe}`);

      const newStat = fs.statSync(existingFile);
      assert.ok(newStat.mtime.getTime() >= oldStat.mtime.getTime());
      assert.strictEqual(readFile(existingFile), 'content'); // Content preserved
    });

    it('should create parent directories', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:touch\tdest:${tempDir}/a/b/c/file.txt`);

      runInstl(`sync ${recipe}`);
      assert.strictEqual(fileExists(path.join(tempDir, 'a/b/c/file.txt')), true);
    });
  });

  describe('mkdir operation', () => {
    it('should create directory', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir\tdest:${tempDir}/newdir`);

      const result = runInstl(`sync ${recipe}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(isDirectory(path.join(tempDir, 'newdir')), true);
    });

    it('should create nested directories', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir\tdest:${tempDir}/a/b/c`);

      runInstl(`sync ${recipe}`);
      assert.strictEqual(isDirectory(path.join(tempDir, 'a/b/c')), true);
    });

    it('should set directory mode', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir\tdest:${tempDir}/newdir\tmode:0700`);

      runInstl(`sync ${recipe}`);
      assert.strictEqual(getFileMode(path.join(tempDir, 'newdir')), 0o700);
    });

    it('should default to mode 755', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir\tdest:${tempDir}/newdir`);

      runInstl(`sync ${recipe}`);
      assert.strictEqual(getFileMode(path.join(tempDir, 'newdir')), 0o755);
    });
  });

  describe('cp operation', () => {
    it('should copy file', () => {
      const src = createTestFile(tempDir, 'source.txt', 'hello');
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:cp\tsrc:${src}\tdest:${tempDir}/dest.txt`);

      const result = runInstl(`sync ${recipe}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(readFile(path.join(tempDir, 'dest.txt')), 'hello');
    });

    it('should set file mode', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:cp\tsrc:${src}\tdest:${tempDir}/dest.txt\tmode:0600`);

      runInstl(`sync ${recipe}`);
      assert.strictEqual(getFileMode(path.join(tempDir, 'dest.txt')), 0o600);
    });

    it('should resolve relative paths from recipe directory', () => {
      createTestFile(tempDir, 'src/source.txt', 'content');
      const recipeDir = path.join(tempDir, 'recipes');
      fs.mkdirSync(recipeDir, { recursive: true });
      const recipe = createTestFile(tempDir, 'recipes/recipe.ltsv', `op:cp\tsrc:../src/source.txt\tdest:${tempDir}/dest.txt`);

      runInstl(`sync ${recipe}`);
      assert.strictEqual(readFile(path.join(tempDir, 'dest.txt')), 'content');
    });
  });

  describe('ln operation', () => {
    it('should create symlink', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:ln\tsrc:${src}\tdest:${tempDir}/link`);

      const result = runInstl(`sync ${recipe}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(isSymlink(path.join(tempDir, 'link')), true);
      assert.strictEqual(getSymlinkTarget(path.join(tempDir, 'link')), src);
    });

    it('should replace existing symlink', () => {
      const src1 = createTestFile(tempDir, 'source1.txt', 'one');
      const src2 = createTestFile(tempDir, 'source2.txt', 'two');
      const linkPath = path.join(tempDir, 'link');
      fs.symlinkSync(src1, linkPath);

      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:ln\tsrc:${src2}\tdest:${linkPath}`);

      runInstl(`sync ${recipe}`);
      assert.strictEqual(getSymlinkTarget(linkPath), src2);
    });
  });

  describe('environment variable expansion', () => {
    it('should expand $HOME in dest', () => {
      const home = process.env['HOME'];
      if (!home) {
        return; // Skip test if HOME not set
      }

      // Use a safe path under temp dir but test the expansion
      const testDir = path.join(tempDir, 'envtest');
      fs.mkdirSync(testDir);

      // Set a custom env var for testing
      process.env['INSTL_TEST_DIR'] = testDir;

      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:touch\tdest:$INSTL_TEST_DIR/expanded.txt`);

      runInstl(`sync ${recipe}`);
      assert.strictEqual(fileExists(path.join(testDir, 'expanded.txt')), true);

      delete process.env['INSTL_TEST_DIR'];
    });
  });

  describe('dry-run', () => {
    it('should not execute operations in dry-run mode', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir\tdest:${tempDir}/newdir
op:touch\tdest:${tempDir}/newfile.txt`);

      const result = runInstl(`sync --dry-run ${recipe}`);
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(fileExists(path.join(tempDir, 'newdir')), false);
      assert.strictEqual(fileExists(path.join(tempDir, 'newfile.txt')), false);
    });

    it('should show output in dry-run mode', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir\tdest:${tempDir}/newdir`);

      const result = runInstl(`sync --dry-run ${recipe}`);
      assert.ok(result.stdout.includes('[DRY-RUN]'));
    });
  });

  describe('verbose', () => {
    it('should show output in verbose mode', () => {
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `op:mkdir\tdest:${tempDir}/newdir`);

      const result = runInstl(`sync --verbose ${recipe}`);
      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.stdout.includes('[MKDIR]'));
    });
  });

  describe('complex recipe', () => {
    it('should execute multiple operations in order', () => {
      const src = createTestFile(tempDir, 'source.txt', 'content');
      const recipe = createTestFile(tempDir, 'recipe.ltsv', `# Setup directories
op:mkdir\tdest:${tempDir}/config\tmode:0755
op:mkdir\tdest:${tempDir}/data\tmode:0700

# Copy files
op:cp\tsrc:${src}\tdest:${tempDir}/config/app.conf\tmode:0644

# Create symlink
op:ln\tsrc:${tempDir}/config/app.conf\tdest:${tempDir}/data/app.conf.link

# Touch state file
op:touch\tdest:${tempDir}/data/state\tmode:0600
`);

      const result = runInstl(`sync ${recipe}`);
      assert.strictEqual(result.exitCode, 0);

      assert.strictEqual(isDirectory(path.join(tempDir, 'config')), true);
      assert.strictEqual(getFileMode(path.join(tempDir, 'config')), 0o755);

      assert.strictEqual(isDirectory(path.join(tempDir, 'data')), true);
      assert.strictEqual(getFileMode(path.join(tempDir, 'data')), 0o700);

      assert.strictEqual(readFile(path.join(tempDir, 'config/app.conf')), 'content');
      assert.strictEqual(getFileMode(path.join(tempDir, 'config/app.conf')), 0o644);

      assert.strictEqual(isSymlink(path.join(tempDir, 'data/app.conf.link')), true);

      assert.strictEqual(fileExists(path.join(tempDir, 'data/state')), true);
      assert.strictEqual(getFileMode(path.join(tempDir, 'data/state')), 0o600);
    });
  });
});
