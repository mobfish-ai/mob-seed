/**
 * verify-init.js 测试
 *
 * 注意: verifyInit 的完整测试在 init-project.test.js 中
 * 这个文件提供额外的单元测试覆盖
 *
 * @module test/scripts/verify-init.test
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 导入被测模块
const { verifyInit, REQUIRED_FILES } = require('../../scripts/verify-init');

// 测试辅助函数
let testDir;

function createTestDir() {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-init-test-'));
}

function cleanupTestDir() {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

describe('verify-init.js', () => {
  beforeEach(() => {
    createTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  describe('REQUIRED_FILES', () => {
    it('should be an array', () => {
      assert.ok(Array.isArray(REQUIRED_FILES));
    });

    it('should have 7 required files', () => {
      assert.strictEqual(REQUIRED_FILES.length, 7);
    });

    it('should include config.json', () => {
      assert.ok(REQUIRED_FILES.some(f => f.path === '.seed/config.json'));
    });

    it('should include mission.md', () => {
      assert.ok(REQUIRED_FILES.some(f => f.path === '.seed/mission.md'));
    });

    it('should include observations/index.json', () => {
      assert.ok(REQUIRED_FILES.some(f => f.path === '.seed/observations/index.json'));
    });
  });

  describe('verifyInit', () => {
    it('should return object with success property', () => {
      const result = verifyInit(testDir);

      assert.ok(typeof result === 'object');
      assert.ok('success' in result);
      assert.ok('summary' in result);
      assert.ok('files' in result);
    });

    it('should fail for empty directory', () => {
      const result = verifyInit(testDir);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.summary.missing, 7);
    });

    it('should validate config.json content', () => {
      // 创建 .seed 目录和无效的 config.json
      fs.mkdirSync(path.join(testDir, '.seed'));
      fs.writeFileSync(
        path.join(testDir, '.seed/config.json'),
        'invalid json',
        'utf8'
      );

      const result = verifyInit(testDir);

      // 找到 config.json 的验证结果
      const configResult = result.files.find(f => f.path === '.seed/config.json');
      assert.ok(configResult);
      assert.ok(configResult.error.includes('JSON'));
    });

    it('should not require version field in config.json', () => {
      // 创建 .seed 目录和不含 version 的 config.json
      fs.mkdirSync(path.join(testDir, '.seed'));
      fs.writeFileSync(
        path.join(testDir, '.seed/config.json'),
        JSON.stringify({
          paths: { src: 'src', test: 'test' },
          mission: { enabled: true }
        }),
        'utf8'
      );

      const result = verifyInit(testDir);

      // 找到 config.json 的验证结果
      const configResult = result.files.find(f => f.path === '.seed/config.json');
      assert.ok(configResult);
      // 不应该因为缺少 version 而报错
      assert.strictEqual(configResult.error, null);
    });
  });
});
