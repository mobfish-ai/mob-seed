/**
 * version-updater.js 测试
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

// 保存原始 cwd
const originalCwd = process.cwd();

// 切换到项目根目录以便找到 package.json
const projectRoot = path.resolve(__dirname, '../../../../');
process.chdir(projectRoot);

const {
  getUpdateDetails,
  executeUpdate,
  formatUpdateResult
} = require('../../lib/runtime/version-updater');

// 测试后恢复 cwd
process.on('exit', () => {
  process.chdir(originalCwd);
});

describe('version-updater', () => {

  describe('getUpdateDetails', () => {

    it('should return claude command for user-plugin scenario', () => {
      const details = getUpdateDetails('user-plugin');
      assert.strictEqual(details.cmd, 'claude');
      assert.deepStrictEqual(details.args, ['plugins', 'update', 'mob-seed']);
    });

    it('should return npm -g for user-env scenario', () => {
      const details = getUpdateDetails('user-env');
      assert.strictEqual(details.cmd, 'npm');
      assert.deepStrictEqual(details.args, ['update', '-g', 'mob-seed']);
    });

    it('should return git pull for dogfooding scenario', () => {
      const details = getUpdateDetails('dogfooding');
      assert.strictEqual(details.cmd, 'git');
      assert.deepStrictEqual(details.args, ['pull']);
    });

    it('should return npm update for compat scenario', () => {
      const details = getUpdateDetails('compat');
      assert.strictEqual(details.cmd, 'npm');
      assert.deepStrictEqual(details.args, ['update', 'mob-seed']);
    });

    it('should return npm update for unknown scenario', () => {
      const details = getUpdateDetails('unknown');
      assert.strictEqual(details.cmd, 'npm');
    });

  });

  describe('executeUpdate', () => {

    it('should return dry-run result without executing', async () => {
      const result = await executeUpdate('dogfooding', { dryRun: true });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.dryRun, true);
      assert.ok(result.command.includes('git pull'));
    });

  });

  describe('formatUpdateResult', () => {

    it('should format dry-run result', () => {
      const result = {
        dryRun: true,
        updated: true,
        currentVersion: '3.4.0',
        latestVersion: '3.5.0',
        scenario: 'dogfooding',
        updateCommand: 'git pull'
      };
      const output = formatUpdateResult(result);
      assert.ok(output.includes('预览'));
      assert.ok(output.includes('3.4.0'));
      assert.ok(output.includes('3.5.0'));
    });

    it('should format successful update result', () => {
      const result = {
        updated: true,
        hasUpdate: true,
        currentVersion: '3.4.0',
        latestVersion: '3.5.0',
        scenario: 'dogfooding',
        updateCommand: 'git pull'
      };
      const output = formatUpdateResult(result);
      assert.ok(output.includes('✅'));
      assert.ok(output.includes('完成'));
    });

    it('should format no-update result', () => {
      const result = {
        updated: false,
        hasUpdate: false,
        currentVersion: '3.5.0',
        latestVersion: '3.5.0',
        scenario: 'dogfooding',
        updateCommand: 'git pull'
      };
      const output = formatUpdateResult(result);
      assert.ok(output.includes('最新版本'));
    });

    it('should format error result', () => {
      const result = {
        updated: false,
        hasUpdate: true,
        currentVersion: '3.4.0',
        latestVersion: '3.5.0',
        scenario: 'dogfooding',
        updateCommand: 'git pull',
        error: 'Network error'
      };
      const output = formatUpdateResult(result);
      assert.ok(output.includes('❌'));
      assert.ok(output.includes('Network error'));
    });

  });

});
