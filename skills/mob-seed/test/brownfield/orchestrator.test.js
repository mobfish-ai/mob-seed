/**
 * orchestrator 单元测试
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const orchestrator = require('../../lib/brownfield/orchestrator');

describe('orchestrator', () => {
  const testDir = path.join(__dirname, '../fixtures/orchestrator');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('ExitCode', () => {
    it('should define exit codes', () => {
      assert.strictEqual(orchestrator.ExitCode.SUCCESS, 0);
      assert.strictEqual(orchestrator.ExitCode.PARTIAL_SUCCESS, 1);
      assert.strictEqual(orchestrator.ExitCode.SYSTEM_ERROR, 2);
      assert.strictEqual(orchestrator.ExitCode.CONFIG_ERROR, 3);
      assert.strictEqual(orchestrator.ExitCode.INVALID_INPUT, 4);
      assert.strictEqual(orchestrator.ExitCode.TIMEOUT, 124);
      assert.strictEqual(orchestrator.ExitCode.INTERRUPTED, 130);
    });
  });

  describe('MigrationPhase', () => {
    it('should define migration phases', () => {
      assert.strictEqual(orchestrator.MigrationPhase.DETECTING, 'detecting');
      assert.strictEqual(orchestrator.MigrationPhase.EXTRACTING, 'extracting');
      assert.strictEqual(orchestrator.MigrationPhase.ENRICHING, 'enriching');
      assert.strictEqual(orchestrator.MigrationPhase.VALIDATING, 'validating');
      assert.strictEqual(orchestrator.MigrationPhase.REPORTING, 'reporting');
      assert.strictEqual(orchestrator.MigrationPhase.COMPLETED, 'completed');
    });
  });

  describe('orchestrateMigration', () => {
    it('should return error for invalid project path', async () => {
      const result = await orchestrator.orchestrateMigration({
        projectPath: '/non/existent/path'
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.exitCode, orchestrator.ExitCode.INVALID_INPUT);
      assert.ok(result.error.includes('不存在'));
    });

    it('should return error for empty project', async () => {
      const projectPath = path.join(testDir, 'empty-project');
      fs.mkdirSync(projectPath, { recursive: true });

      const result = await orchestrator.orchestrateMigration({
        projectPath
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.exitCode, orchestrator.ExitCode.INVALID_INPUT);
      assert.ok(result.error.includes('未检测到有效'));
    });

    it('should migrate simple Node.js project', async () => {
      // 创建简单的 Node.js 项目
      const projectPath = path.join(testDir, 'simple-project');
      fs.mkdirSync(path.join(projectPath, 'lib'), { recursive: true });
      fs.writeFileSync(
        path.join(projectPath, 'package.json'),
        JSON.stringify({ name: 'simple-project', version: '1.0.0' })
      );
      fs.writeFileSync(
        path.join(projectPath, 'lib', 'index.js'),
        `/**
 * Simple module
 * @module simple
 */

/**
 * Add two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum
 */
function add(a, b) {
  return a + b;
}

module.exports = { add };
`
      );

      const phases = [];
      const result = await orchestrator.orchestrateMigration({
        projectPath,
        enrichEnabled: false,
        dryRun: true, // 预览模式
        onPhase: (phase, msg) => phases.push({ phase, msg })
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.stats);
      assert.ok(phases.length > 0);
      assert.ok(phases.some(p => p.phase === 'detecting'));
    });

    it('should support dry-run mode', async () => {
      const projectPath = path.join(testDir, 'dryrun-project');
      fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(projectPath, 'package.json'),
        JSON.stringify({ name: 'dryrun-test' })
      );
      fs.writeFileSync(
        path.join(projectPath, 'src', 'app.js'),
        'module.exports = {};'
      );

      const result = await orchestrator.orchestrateMigration({
        projectPath,
        dryRun: true,
        enrichEnabled: false
      });

      // 预览模式不应创建规格文件
      const specsDir = path.join(projectPath, 'openspec', 'specs');
      assert.strictEqual(fs.existsSync(specsDir), false);
      assert.strictEqual(result.reportPath, null);
    });

    it('should call onProgress callback', async () => {
      const projectPath = path.join(testDir, 'progress-project');
      fs.mkdirSync(path.join(projectPath, 'lib'), { recursive: true });
      fs.writeFileSync(
        path.join(projectPath, 'package.json'),
        JSON.stringify({ name: 'progress-test' })
      );
      fs.writeFileSync(path.join(projectPath, 'lib', 'a.js'), 'exports.a = 1;');
      fs.writeFileSync(path.join(projectPath, 'lib', 'b.js'), 'exports.b = 2;');

      const progress = [];
      await orchestrator.orchestrateMigration({
        projectPath,
        dryRun: true,
        enrichEnabled: false,
        onProgress: (current, total, file) => {
          progress.push({ current, total, file });
        }
      });

      assert.ok(progress.length >= 2);
      assert.strictEqual(progress[progress.length - 1].current, progress[progress.length - 1].total);
    });
  });

  describe('checkIncomplete', () => {
    it('should return null if no incomplete state', () => {
      const projectPath = path.join(testDir, 'no-incomplete');
      fs.mkdirSync(projectPath, { recursive: true });

      const result = orchestrator.checkIncomplete(projectPath);

      assert.strictEqual(result, null);
    });

    it('should return summary for incomplete state', () => {
      const projectPath = path.join(testDir, 'has-incomplete');
      fs.mkdirSync(path.join(projectPath, '.seed'), { recursive: true });

      // 创建一个未完成的状态
      const state = {
        version: 1,
        phase: 'extracting',
        startedAt: new Date().toISOString(),
        progress: { total: 100, processed: 50, successful: 45, failed: 5 },
        files: {
          remaining: new Array(50).fill('x.js'),
          completed: [],
          failed: []
        }
      };
      fs.writeFileSync(
        path.join(projectPath, '.seed', 'brownfield-state.json'),
        JSON.stringify(state)
      );

      const result = orchestrator.checkIncomplete(projectPath);

      assert.ok(result);
      assert.strictEqual(result.phase, 'extracting');
      assert.strictEqual(result.progress.total, 100);
      assert.strictEqual(result.progress.processed, 50);
    });
  });

  describe('cancelMigration', () => {
    it('should cancel incomplete migration', () => {
      const projectPath = path.join(testDir, 'cancel-migration');
      fs.mkdirSync(path.join(projectPath, '.seed'), { recursive: true });

      // 创建状态文件
      const state = { version: 1, phase: 'extracting', progress: { total: 10 } };
      fs.writeFileSync(
        path.join(projectPath, '.seed', 'brownfield-state.json'),
        JSON.stringify(state)
      );

      const result = orchestrator.cancelMigration(projectPath);

      assert.strictEqual(result, true);
      assert.strictEqual(
        fs.existsSync(path.join(projectPath, '.seed', 'brownfield-state.json')),
        false
      );
    });

    it('should return true if no state to cancel', () => {
      const projectPath = path.join(testDir, 'no-cancel');
      fs.mkdirSync(projectPath, { recursive: true });

      const result = orchestrator.cancelMigration(projectPath);

      assert.strictEqual(result, true);
    });
  });
});
