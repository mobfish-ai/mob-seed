/**
 * Interactive Prompt 单元测试
 *
 * @see openspec/changes/v2.1-release-automation/specs/ux/interactive-mode.fspec.md
 */

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 创建测试环境
function createTestEnvironment() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'interactive-prompt-test-'));
  const seedDir = path.join(tempDir, '.seed');
  fs.mkdirSync(seedDir, { recursive: true });

  return {
    tempDir,
    seedDir,
    cleanup: () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

describe('Interactive Prompt', () => {
  let testEnv;
  let prompt;

  beforeEach(() => {
    testEnv = createTestEnvironment();
    // 清除模块缓存
    const modulePath = require.resolve('../../lib/ux/interactive-prompt.js');
    delete require.cache[modulePath];
    prompt = require('../../lib/ux/interactive-prompt.js');
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe('formatConfirmMessage', () => {
    it('should format confirm message with options', () => {
      const message = prompt.formatConfirmMessage('确认删除文件？', {
        danger: true
      });

      assert.ok(message.includes('确认删除文件'), 'Should include message');
      assert.ok(message.includes('[Y]') || message.includes('[N]'), 'Should include options');
    });
  });

  describe('formatMenu', () => {
    // AC-016: 交互式确认
    it('should format menu with numbered options', () => {
      const options = [
        { label: '派生代码', action: 'emit' },
        { label: '运行测试', action: 'exec' },
        { label: '跳过', action: 'skip' }
      ];

      const menu = prompt.formatMenu('选择操作:', options);

      assert.ok(menu.includes('选择操作'), 'Should include title');
      assert.ok(menu.includes('[1]'), 'Should include numbered options');
      assert.ok(menu.includes('[a]') || menu.includes('全部'), 'Should include all option');
    });

    it('should support batch selection marker', () => {
      const options = [
        { label: '修复问题1', action: 'fix1' },
        { label: '修复问题2', action: 'fix2' }
      ];

      const menu = prompt.formatMenu('选择操作:', options, { allowBatch: true });

      assert.ok(menu.includes('[a]') || menu.includes('全部'), 'Should include batch option');
    });
  });

  describe('parseSelection', () => {
    it('should parse single selection', () => {
      const options = [
        { label: 'Option 1', action: 'opt1' },
        { label: 'Option 2', action: 'opt2' }
      ];

      const result = prompt.parseSelection('1', options);

      assert.deepStrictEqual(result, [{ label: 'Option 1', action: 'opt1' }]);
    });

    it('should parse "a" as all options', () => {
      const options = [
        { label: 'Option 1', action: 'opt1' },
        { label: 'Option 2', action: 'opt2' }
      ];

      const result = prompt.parseSelection('a', options);

      assert.strictEqual(result.length, 2);
    });

    it('should parse "n" as empty selection', () => {
      const options = [{ label: 'Option 1', action: 'opt1' }];

      const result = prompt.parseSelection('n', options);

      assert.deepStrictEqual(result, []);
    });

    it('should parse "q" as quit signal', () => {
      const options = [{ label: 'Option 1', action: 'opt1' }];

      const result = prompt.parseSelection('q', options);

      assert.strictEqual(result, null);
    });
  });

  describe('detectContext', () => {
    // AC-017: 智能上下文
    it('should detect new spec file context', () => {
      const status = {
        newSpecs: ['user-auth.fspec.md'],
        modifiedSpecs: [],
        failedTests: 0,
        acProgress: 0
      };

      const recommendation = prompt.detectContext(status);

      assert.ok(recommendation, 'Should return recommendation');
      assert.strictEqual(recommendation.type, 'new_spec');
      assert.ok(recommendation.message.includes('派生') || recommendation.message.includes('emit'));
    });

    it('should detect modified spec context', () => {
      const status = {
        newSpecs: [],
        modifiedSpecs: ['user-auth.fspec.md'],
        failedTests: 0,
        acProgress: 50
      };

      const recommendation = prompt.detectContext(status);

      assert.ok(recommendation);
      assert.strictEqual(recommendation.type, 'modified_spec');
    });

    it('should detect all AC complete context', () => {
      const status = {
        newSpecs: [],
        modifiedSpecs: [],
        failedTests: 0,
        acProgress: 100
      };

      const recommendation = prompt.detectContext(status);

      assert.ok(recommendation);
      assert.strictEqual(recommendation.type, 'ready_to_archive');
    });

    it('should return null when no specific context', () => {
      const status = {
        newSpecs: [],
        modifiedSpecs: [],
        failedTests: 0,
        acProgress: 50
      };

      const recommendation = prompt.detectContext(status);

      assert.strictEqual(recommendation, null);
    });
  });

  describe('saveCheckpoint / loadCheckpoint', () => {
    // AC-018: 错误恢复
    it('should save and load checkpoint', () => {
      const operation = 'emit';
      const state = {
        file: 'action-suggest.js',
        progress: 50
      };

      prompt.saveCheckpoint(operation, state, { projectRoot: testEnv.tempDir });
      const checkpoint = prompt.loadCheckpoint({ projectRoot: testEnv.tempDir });

      assert.ok(checkpoint);
      assert.strictEqual(checkpoint.operation, 'emit');
      assert.strictEqual(checkpoint.state.file, 'action-suggest.js');
      assert.strictEqual(checkpoint.state.progress, 50);
    });

    it('should return null when no checkpoint', () => {
      const checkpoint = prompt.loadCheckpoint({ projectRoot: testEnv.tempDir });

      assert.strictEqual(checkpoint, null);
    });
  });

  describe('clearCheckpoint', () => {
    it('should clear existing checkpoint', () => {
      prompt.saveCheckpoint('emit', { file: 'test.js' }, { projectRoot: testEnv.tempDir });
      assert.ok(prompt.loadCheckpoint({ projectRoot: testEnv.tempDir }));

      prompt.clearCheckpoint({ projectRoot: testEnv.tempDir });

      assert.strictEqual(prompt.loadCheckpoint({ projectRoot: testEnv.tempDir }), null);
    });
  });

  describe('formatCheckpointPrompt', () => {
    it('should format checkpoint resume prompt', () => {
      const checkpoint = {
        operation: 'emit',
        state: { file: 'action-suggest.js', progress: 50 },
        timestamp: Date.now()
      };

      const formatted = prompt.formatCheckpointPrompt(checkpoint);

      assert.ok(formatted.includes('emit') || formatted.includes('派生'));
      assert.ok(formatted.includes('action-suggest.js'));
      assert.ok(formatted.includes('50%') || formatted.includes('50'));
    });
  });

  describe('Non-TTY fallback', () => {
    it('should provide CI-friendly output format', () => {
      const options = [
        { label: 'Option 1', action: 'opt1' },
        { label: 'Option 2', action: 'opt2' }
      ];

      const output = prompt.formatMenuForCI('选择操作:', options);

      // CI 模式应该更简洁
      assert.ok(output.includes('Option 1'));
      assert.ok(!output.includes('[a]')); // CI 不需要全选
    });
  });
});
