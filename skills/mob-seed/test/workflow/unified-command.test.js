/**
 * Unified Command Tests
 *
 * @see openspec/changes/v2.1-release-automation/specs/workflow/unified-command.fspec.md
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  routeSubcommand,
  executeSmartEntry,
  collectStatus,
  checkSync,
  detectDrift,
  formatStatusPanel,
  loadSeedConfig,
  isOpenSpecMode,
  SUBCOMMANDS,
  GLOBAL_OPTIONS
} = require('../../lib/workflow/unified-command.js');

describe('unified-command', () => {
  let testDir;

  beforeEach(() => {
    // 创建临时测试目录
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-test-'));
  });

  afterEach(() => {
    // 清理测试目录
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('routeSubcommand', () => {
    it('should route valid subcommand', async () => {
      // AC-002: 子命令路由正确
      const result = await routeSubcommand('spec', ['test-feature']);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.subcommand, 'spec');
      assert.deepStrictEqual(result.args, ['test-feature']);
    });

    it('should handle all valid subcommands', async () => {
      const validCommands = ['init', 'spec', 'emit', 'exec', 'defend', 'archive'];

      for (const cmd of validCommands) {
        const result = await routeSubcommand(cmd, []);
        assert.strictEqual(result.success, true, `${cmd} should be valid`);
        assert.strictEqual(result.subcommand, cmd);
      }
    });

    it('should reject invalid subcommand', async () => {
      const result = await routeSubcommand('invalid', []);

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Unknown subcommand'));
    });

    it('should be case-insensitive', async () => {
      const result = await routeSubcommand('SPEC', ['feature']);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.subcommand, 'spec');
    });

    it('should pass options through', async () => {
      const options = { quick: true, fix: true };
      const result = await routeSubcommand('defend', [], options);

      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.options, options);
    });
  });

  describe('executeSmartEntry', () => {
    it('should report uninitialized when no config', async () => {
      // AC-001: 无参数执行全量检查 - 未初始化场景
      const result = await executeSmartEntry({ projectPath: testDir });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.initialized, false);
      assert.ok(result.suggestion.includes('/mob-seed:init'));
    });

    it('should return status when initialized', async () => {
      // 初始化测试项目
      const seedDir = path.join(testDir, '.seed');
      fs.mkdirSync(seedDir, { recursive: true });
      fs.writeFileSync(
        path.join(seedDir, 'config.json'),
        JSON.stringify({ version: '1.0.0', paths: { specs: 'specs' } })
      );

      const result = await executeSmartEntry({ projectPath: testDir });

      assert.strictEqual(result.success, true);
      assert.ok(result.status);
      assert.ok(result.suggestions);
    });

    it('should execute quick mode faster', async () => {
      // AC-003: --quick 模式秒级完成
      const seedDir = path.join(testDir, '.seed');
      fs.mkdirSync(seedDir, { recursive: true });
      fs.writeFileSync(
        path.join(seedDir, 'config.json'),
        JSON.stringify({ version: '1.0.0', paths: { specs: 'specs' } })
      );

      const start = Date.now();
      const result = await executeSmartEntry({ projectPath: testDir, quick: true });
      const elapsed = Date.now() - start;

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.mode, 'quick');
      assert.ok(elapsed < 3000, 'Quick mode should complete in < 3 seconds');
    });
  });

  describe('collectStatus', () => {
    it('should return empty status when not initialized', async () => {
      const status = await collectStatus(testDir);

      assert.strictEqual(status.initialized, false);
      assert.strictEqual(status.specs.total, 0);
    });

    it('should count spec files', async () => {
      // 初始化测试项目
      const seedDir = path.join(testDir, '.seed');
      const specsDir = path.join(testDir, 'specs');
      fs.mkdirSync(seedDir, { recursive: true });
      fs.mkdirSync(specsDir, { recursive: true });
      fs.writeFileSync(
        path.join(seedDir, 'config.json'),
        JSON.stringify({ version: '1.0.0', paths: { specs: 'specs' } })
      );

      // 创建测试规格文件
      fs.writeFileSync(
        path.join(specsDir, 'test.fspec.md'),
        '# Test Spec\n> 状态: draft\n- [ ] AC-001: Test'
      );

      const status = await collectStatus(testDir);

      assert.strictEqual(status.initialized, true);
      assert.strictEqual(status.specs.total, 1);
      assert.strictEqual(status.specs.draft, 1);
      assert.strictEqual(status.ac.total, 1);
      assert.strictEqual(status.ac.completed, 0);
    });

    it('should count completed ACs', async () => {
      const seedDir = path.join(testDir, '.seed');
      const specsDir = path.join(testDir, 'specs');
      fs.mkdirSync(seedDir, { recursive: true });
      fs.mkdirSync(specsDir, { recursive: true });
      fs.writeFileSync(
        path.join(seedDir, 'config.json'),
        JSON.stringify({ version: '1.0.0', paths: { specs: 'specs' } })
      );

      fs.writeFileSync(
        path.join(specsDir, 'test.fspec.md'),
        '# Test\n> 状态: archived\n- [x] AC-001: Done\n- [ ] AC-002: Pending'
      );

      const status = await collectStatus(testDir);

      assert.strictEqual(status.ac.total, 2);
      assert.strictEqual(status.ac.completed, 1);
      assert.strictEqual(status.specs.archived, 1);
    });

    it('should detect OpenSpec mode', async () => {
      const seedDir = path.join(testDir, '.seed');
      const openspecDir = path.join(testDir, 'openspec', 'specs');
      fs.mkdirSync(seedDir, { recursive: true });
      fs.mkdirSync(openspecDir, { recursive: true });
      fs.writeFileSync(
        path.join(seedDir, 'config.json'),
        JSON.stringify({ version: '1.0.0', openspec: { enabled: true } })
      );

      const status = await collectStatus(testDir);

      assert.strictEqual(status.openspec, true);
    });
  });

  describe('checkSync', () => {
    it('should report error when not initialized', async () => {
      const result = await checkSync(testDir);

      assert.strictEqual(result.checked, false);
      assert.ok(result.issues.length > 0);
    });

    it('should detect unsynced specs', async () => {
      const seedDir = path.join(testDir, '.seed');
      const specsDir = path.join(testDir, 'specs');
      fs.mkdirSync(seedDir, { recursive: true });
      fs.mkdirSync(specsDir, { recursive: true });
      fs.writeFileSync(
        path.join(seedDir, 'config.json'),
        JSON.stringify({ version: '1.0.0', paths: { specs: 'specs' } })
      );

      fs.writeFileSync(
        path.join(specsDir, 'test.fspec.md'),
        '# Test Spec'
      );

      const result = await checkSync(testDir);

      assert.strictEqual(result.checked, true);
      assert.strictEqual(result.specsChecked, 1);
      assert.strictEqual(result.drifted, 1);
      assert.ok(result.issues.some(i => i.message === '未派生'));
    });

    it('should detect synced specs', async () => {
      const seedDir = path.join(testDir, '.seed');
      const specsDir = path.join(testDir, 'specs');
      const outputDir = path.join(testDir, '.seed', 'output', 'test');
      fs.mkdirSync(seedDir, { recursive: true });
      fs.mkdirSync(specsDir, { recursive: true });
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(
        path.join(seedDir, 'config.json'),
        JSON.stringify({ version: '1.0.0', paths: { specs: 'specs' } })
      );

      fs.writeFileSync(path.join(specsDir, 'test.fspec.md'), '# Test Spec');
      fs.writeFileSync(path.join(outputDir, 'seed-manifest.json'), '{}');

      const result = await checkSync(testDir);

      assert.strictEqual(result.synced, 1);
      assert.strictEqual(result.drifted, 0);
    });
  });

  describe('detectDrift', () => {
    it('should return empty when not initialized', async () => {
      const result = await detectDrift(testDir);

      assert.strictEqual(result.checked, false);
      assert.strictEqual(result.total, 0);
    });

    it('should detect missing output files', async () => {
      const seedDir = path.join(testDir, '.seed');
      const outputDir = path.join(testDir, '.seed', 'output', 'test');
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(
        path.join(seedDir, 'config.json'),
        JSON.stringify({ version: '1.0.0' })
      );

      const manifest = {
        outputs: [
          { type: 'code', path: 'src/test.js' },
          { type: 'test', path: 'test/test.test.js' }
        ]
      };
      fs.writeFileSync(
        path.join(outputDir, 'seed-manifest.json'),
        JSON.stringify(manifest)
      );

      const result = await detectDrift(testDir);

      assert.strictEqual(result.total, 2);
      assert.strictEqual(result.missing.length, 2);
    });
  });

  describe('formatStatusPanel', () => {
    it('should format uninitialized state', () => {
      const report = {
        success: false,
        message: 'SEED 未初始化',
        suggestion: '运行 /mob-seed:init'
      };

      const output = formatStatusPanel(report);

      assert.ok(output.includes('SEED 状态面板'));
      assert.ok(output.includes('SEED 未初始化'));
      assert.ok(output.includes('/mob-seed:init'));
    });

    it('should format full status report', () => {
      const report = {
        success: true,
        mode: 'full',
        status: {
          specs: { total: 5, draft: 1, review: 2, implementing: 1, archived: 1 },
          ac: { total: 10, completed: 7 }
        },
        sync: { synced: 3, drifted: 2 },
        drift: { total: 1, missing: [{}], mutations: [] },
        suggestions: [
          { priority: 1, action: 'Test', command: '/test', reason: 'Test reason' }
        ]
      };

      const output = formatStatusPanel(report);

      assert.ok(output.includes('规格状态'));
      assert.ok(output.includes('总计: 5'));
      assert.ok(output.includes('AC 完成度'));
      assert.ok(output.includes('同步状态'));
      assert.ok(output.includes('建议行动'));
    });
  });

  describe('helper functions', () => {
    it('loadSeedConfig should return null when no config', () => {
      const config = loadSeedConfig(testDir);
      assert.strictEqual(config, null);
    });

    it('loadSeedConfig should load valid config', () => {
      const seedDir = path.join(testDir, '.seed');
      fs.mkdirSync(seedDir, { recursive: true });
      fs.writeFileSync(
        path.join(seedDir, 'config.json'),
        JSON.stringify({ openspec: { enabled: true }, custom: true })
      );

      const config = loadSeedConfig(testDir);

      assert.strictEqual(config.openspec.enabled, true);
      assert.strictEqual(config.custom, true);
    });

    it('isOpenSpecMode should detect OpenSpec directory', () => {
      assert.strictEqual(isOpenSpecMode(testDir), false);

      fs.mkdirSync(path.join(testDir, 'openspec'), { recursive: true });
      assert.strictEqual(isOpenSpecMode(testDir), true);
    });

    it('isOpenSpecMode should detect config flag', () => {
      const seedDir = path.join(testDir, '.seed');
      fs.mkdirSync(seedDir, { recursive: true });
      fs.writeFileSync(
        path.join(seedDir, 'config.json'),
        JSON.stringify({ openspec: { enabled: true } })
      );

      assert.strictEqual(isOpenSpecMode(testDir), true);
    });
  });

  describe('constants', () => {
    it('should export all subcommands', () => {
      assert.ok(SUBCOMMANDS.init);
      assert.ok(SUBCOMMANDS.spec);
      assert.ok(SUBCOMMANDS.emit);
      assert.ok(SUBCOMMANDS.exec);
      assert.ok(SUBCOMMANDS.defend);
      assert.ok(SUBCOMMANDS.archive);
    });

    it('should export global options', () => {
      assert.ok(GLOBAL_OPTIONS['--quick']);
      assert.ok(GLOBAL_OPTIONS['--fix']);
      assert.ok(GLOBAL_OPTIONS['--auto']);
      assert.ok(GLOBAL_OPTIONS['--ci']);
      assert.ok(GLOBAL_OPTIONS['--strict']);
    });
  });
});
