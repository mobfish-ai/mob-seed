/**
 * cache-checker 模块测试
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  hashFile,
  loadCache,
  isCacheValid,
  checkCache
} = require('../../lib/hooks/cache-checker');

describe('Cache Checker Module', () => {
  let testDir;
  let originalCwd;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-checker-test-'));
    originalCwd = process.cwd();
    process.chdir(testDir);
    fs.mkdirSync('.seed', { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('hashFile', () => {
    it('should return SHA256 hash for existing file', () => {
      const testFile = 'test.js';
      fs.writeFileSync(testFile, 'console.log("hello")');

      const hash = hashFile(testFile);

      assert.ok(hash);
      assert.strictEqual(hash.length, 64); // SHA256 hex is 64 chars
    });

    it('should return null for non-existent file', () => {
      const hash = hashFile('non-existent.js');

      assert.strictEqual(hash, null);
    });

    it('should return same hash for same content', () => {
      fs.writeFileSync('file1.js', 'same content');
      fs.writeFileSync('file2.js', 'same content');

      const hash1 = hashFile('file1.js');
      const hash2 = hashFile('file2.js');

      assert.strictEqual(hash1, hash2);
    });

    it('should return different hash for different content', () => {
      fs.writeFileSync('file1.js', 'content A');
      fs.writeFileSync('file2.js', 'content B');

      const hash1 = hashFile('file1.js');
      const hash2 = hashFile('file2.js');

      assert.notStrictEqual(hash1, hash2);
    });
  });

  describe('loadCache', () => {
    it('should return default cache when file does not exist', () => {
      const cache = loadCache();

      assert.deepStrictEqual(cache, { version: '1.0.0', entries: {} });
    });

    it('should load existing cache file', () => {
      const testCache = {
        version: '1.0.0',
        entries: {
          'test.js': { specHash: 'abc123', checkedAt: '2024-01-01T00:00:00Z' }
        }
      };
      fs.writeFileSync('.seed/check-cache.json', JSON.stringify(testCache));

      const cache = loadCache();

      assert.deepStrictEqual(cache, testCache);
    });

    it('should return default cache for invalid JSON', () => {
      fs.writeFileSync('.seed/check-cache.json', 'invalid json');

      const cache = loadCache();

      assert.deepStrictEqual(cache, { version: '1.0.0', entries: {} });
    });
  });

  describe('isCacheValid', () => {
    it('should return false for null entry', () => {
      assert.strictEqual(isCacheValid(null), false);
    });

    it('should return false for entry without checkedAt', () => {
      assert.strictEqual(isCacheValid({ result: { syncStatus: 'pass' } }), false);
    });

    it('should return false for expired cache (> 24 hours)', () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      const entry = {
        checkedAt: oldDate,
        result: { syncStatus: 'pass' }
      };

      assert.strictEqual(isCacheValid(entry), false);
    });

    it('should return false for failed result', () => {
      const entry = {
        checkedAt: new Date().toISOString(),
        result: { syncStatus: 'fail' }
      };

      assert.strictEqual(isCacheValid(entry), false);
    });

    it('should return true for valid recent cache with pass status', () => {
      const entry = {
        checkedAt: new Date().toISOString(),
        result: { syncStatus: 'pass' }
      };

      assert.strictEqual(isCacheValid(entry), true);
    });
  });

  describe('checkCache', () => {
    it('should return false when cache file does not exist', () => {
      fs.writeFileSync('test.js', 'content');

      const result = checkCache('test.js');

      assert.strictEqual(result, false);
    });

    it('should return true when all files have valid cache entries', () => {
      const testFile = 'test.js';
      fs.writeFileSync(testFile, 'content');
      const hash = hashFile(testFile);

      const cache = {
        version: '1.0.0',
        entries: {
          [testFile]: {
            specHash: hash,
            checkedAt: new Date().toISOString(),
            result: { syncStatus: 'pass' }
          }
        }
      };
      fs.writeFileSync('.seed/check-cache.json', JSON.stringify(cache));

      const result = checkCache(testFile);

      assert.strictEqual(result, true);
    });

    it('should return false when file content has changed', () => {
      const testFile = 'test.js';
      fs.writeFileSync(testFile, 'original content');
      const originalHash = hashFile(testFile);

      const cache = {
        version: '1.0.0',
        entries: {
          [testFile]: {
            specHash: originalHash,
            checkedAt: new Date().toISOString(),
            result: { syncStatus: 'pass' }
          }
        }
      };
      fs.writeFileSync('.seed/check-cache.json', JSON.stringify(cache));

      // Change file content
      fs.writeFileSync(testFile, 'modified content');

      const result = checkCache(testFile);

      assert.strictEqual(result, false);
    });

    it('should handle multiple files', () => {
      fs.writeFileSync('file1.js', 'content1');
      fs.writeFileSync('file2.js', 'content2');

      const hash1 = hashFile('file1.js');
      const hash2 = hashFile('file2.js');

      const cache = {
        version: '1.0.0',
        entries: {
          'file1.js': {
            specHash: hash1,
            checkedAt: new Date().toISOString(),
            result: { syncStatus: 'pass' }
          },
          'file2.js': {
            specHash: hash2,
            checkedAt: new Date().toISOString(),
            result: { syncStatus: 'pass' }
          }
        }
      };
      fs.writeFileSync('.seed/check-cache.json', JSON.stringify(cache));

      const result = checkCache('file1.js\nfile2.js');

      assert.strictEqual(result, true);
    });

    it('should return false if any file is not in cache', () => {
      fs.writeFileSync('file1.js', 'content1');
      fs.writeFileSync('file2.js', 'content2');

      const hash1 = hashFile('file1.js');

      const cache = {
        version: '1.0.0',
        entries: {
          'file1.js': {
            specHash: hash1,
            checkedAt: new Date().toISOString(),
            result: { syncStatus: 'pass' }
          }
          // file2.js is not in cache
        }
      };
      fs.writeFileSync('.seed/check-cache.json', JSON.stringify(cache));

      const result = checkCache('file1.js\nfile2.js');

      assert.strictEqual(result, false);
    });
  });
});
