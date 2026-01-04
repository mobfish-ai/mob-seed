/**
 * Quick Defender Tests
 *
 * 测试快速检查（pre-commit hook 使用）
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 模块路径
const quickDefenderPath = path.join(__dirname, '../../lib/hooks/quick-defender.js');

describe('Quick Defender Module', () => {
  let quickDefender;
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    // 清除模块缓存
    delete require.cache[require.resolve(quickDefenderPath)];
    quickDefender = require(quickDefenderPath);

    // 保存原始目录
    originalCwd = process.cwd();

    // 创建临时目录
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quick-defender-test-'));

    // 切换到临时目录
    process.chdir(tempDir);
  });

  afterEach(() => {
    // 恢复原始目录
    process.chdir(originalCwd);

    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('module exports', () => {
    it('should export loadConfig function', () => {
      assert.ok(typeof quickDefender.loadConfig === 'function');
    });

    it('should export checkSpecExists function', () => {
      assert.ok(typeof quickDefender.checkSpecExists === 'function');
    });

    it('should export quickSeedCheck function', () => {
      assert.ok(typeof quickDefender.quickSeedCheck === 'function');
    });

    it('should export printResults function', () => {
      assert.ok(typeof quickDefender.printResults === 'function');
    });
  });

  describe('loadConfig', () => {
    it('should return null when .seed/config.json does not exist', () => {
      const config = quickDefender.loadConfig();
      assert.strictEqual(config, null);
    });

    it('should load config when .seed/config.json exists', () => {
      fs.mkdirSync('.seed', { recursive: true });
      fs.writeFileSync('.seed/config.json', JSON.stringify({
        paths: { specs: 'openspec/specs' }
      }));

      const config = quickDefender.loadConfig();
      assert.ok(config);
      assert.strictEqual(config.paths.specs, 'openspec/specs');
    });
  });

  describe('checkSpecExists', () => {
    it('should return exists: false when no spec file exists', () => {
      const result = quickDefender.checkSpecExists('src/auth.js', null);
      assert.strictEqual(result.exists, false);
      assert.strictEqual(result.path, null);
    });

    it('should return exists: true when spec file exists', () => {
      // 创建规格文件
      fs.mkdirSync('openspec/specs', { recursive: true });
      fs.writeFileSync('openspec/specs/auth.fspec.md', '# Auth Spec');

      const result = quickDefender.checkSpecExists('src/auth.js', null);
      assert.strictEqual(result.exists, true);
      assert.ok(result.path.includes('auth.fspec.md'));
    });

    it('should use config paths.specs if provided', () => {
      // 创建自定义路径的规格文件
      fs.mkdirSync('custom/specs', { recursive: true });
      fs.writeFileSync('custom/specs/utils.fspec.md', '# Utils Spec');

      const config = { paths: { specs: 'custom/specs' } };
      const result = quickDefender.checkSpecExists('lib/utils.js', config);
      assert.strictEqual(result.exists, true);
    });
  });

  describe('quickSeedCheck', () => {
    it('should return empty array when no files are provided', () => {
      const issues = quickDefender.quickSeedCheck('', null);
      assert.strictEqual(issues.length, 0);
    });

    it('should skip test files', () => {
      const files = 'src/auth.test.js\nsrc/auth.spec.js';
      const issues = quickDefender.quickSeedCheck(files, null);

      // 测试文件不应该报告规格缺失
      assert.strictEqual(issues.length, 0);
    });

    it('should skip config files', () => {
      const files = 'config.js\nwebpack.config.js';
      const issues = quickDefender.quickSeedCheck(files, null);

      // 配置文件不应该报告规格缺失
      assert.strictEqual(issues.length, 0);
    });

    it('should warn about code files without specs', () => {
      const files = 'src/newfeature.js';
      const issues = quickDefender.quickSeedCheck(files, null);

      // 应该有一个警告
      assert.strictEqual(issues.length, 1);
      assert.strictEqual(issues[0].level, 'warning');
      assert.ok(issues[0].message.includes('无对应规格文件'));
    });

    it('should not warn when spec exists for code file', () => {
      // 创建规格文件
      fs.mkdirSync('openspec/specs', { recursive: true });
      fs.writeFileSync('openspec/specs/auth.fspec.md', '# Auth Spec');

      const files = 'src/auth.js';
      const issues = quickDefender.quickSeedCheck(files, null);

      // 不应该有警告
      assert.strictEqual(issues.length, 0);
    });

    it('should error on spec file without functional requirements', () => {
      // 创建没有功能需求章节的规格文件
      fs.mkdirSync('openspec/specs', { recursive: true });
      fs.writeFileSync('openspec/specs/bad.fspec.md', `---
status: draft
---

# Bad Spec

Just a description without requirements.
`);

      const files = 'openspec/specs/bad.fspec.md';
      const issues = quickDefender.quickSeedCheck(files, null);

      // 应该有一个错误
      const errors = issues.filter(i => i.level === 'error');
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].message.includes('缺少功能需求'));
    });

    it('should pass on spec file with functional requirements', () => {
      // 创建有功能需求章节的规格文件
      fs.mkdirSync('openspec/specs', { recursive: true });
      fs.writeFileSync('openspec/specs/good.fspec.md', `---
status: draft
---

# Good Spec

## 功能需求

FR-001: 某功能
`);

      const files = 'openspec/specs/good.fspec.md';
      const issues = quickDefender.quickSeedCheck(files, null);

      // 不应该有错误
      const errors = issues.filter(i => i.level === 'error');
      assert.strictEqual(errors.length, 0);
    });

    it('should also accept English section title', () => {
      // 创建有英文功能需求章节的规格文件
      fs.mkdirSync('openspec/specs', { recursive: true });
      fs.writeFileSync('openspec/specs/english.fspec.md', `---
status: draft
---

# English Spec

## Functional Requirements

FR-001: Some feature
`);

      const files = 'openspec/specs/english.fspec.md';
      const issues = quickDefender.quickSeedCheck(files, null);

      // 不应该有错误
      const errors = issues.filter(i => i.level === 'error');
      assert.strictEqual(errors.length, 0);
    });
  });

  describe('printResults', () => {
    it('should return true when no errors', () => {
      const result = quickDefender.printResults([]);
      assert.strictEqual(result, true);
    });

    it('should return true when only warnings', () => {
      const issues = [
        { level: 'warning', file: 'test.js', message: 'Just a warning' }
      ];
      const result = quickDefender.printResults(issues);
      assert.strictEqual(result, true);
    });

    it('should return false when there are errors', () => {
      const issues = [
        { level: 'error', file: 'test.js', message: 'An error' }
      ];
      const result = quickDefender.printResults(issues);
      assert.strictEqual(result, false);
    });
  });

  describe('multiple files check', () => {
    it('should check multiple files separated by newlines', () => {
      const files = 'src/a.js\nsrc/b.js\nsrc/c.js';
      const issues = quickDefender.quickSeedCheck(files, null);

      // 应该有 3 个警告（每个文件一个）
      assert.strictEqual(issues.length, 3);
    });

    it('should handle mixed file types', () => {
      // 创建一个规格文件
      fs.mkdirSync('openspec/specs', { recursive: true });
      fs.writeFileSync('openspec/specs/auth.fspec.md', `# Auth
## 功能需求
FR-001: Auth
`);

      const files = 'src/auth.js\nopenspec/specs/auth.fspec.md\nsrc/other.js';
      const issues = quickDefender.quickSeedCheck(files, null);

      // auth.js 有规格，不警告；auth.fspec.md 格式正确；other.js 无规格，警告
      assert.strictEqual(issues.length, 1);
      assert.ok(issues[0].file.includes('other.js'));
    });
  });
});
