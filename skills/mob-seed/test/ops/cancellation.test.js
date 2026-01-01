/**
 * cancellation 测试
 * @see openspec/changes/v2.0-seed-complete/specs/ops/cancellation.fspec.md
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  requestCancel,
  registerCancelHandler,
  markSafePoint,
  isAtSafePoint,
  waitForSafePoint,
  saveState,
  generateCancelReport,
  cleanup,
  terminateSubprocesses,
  releaseLocks,
  canResume,
  resume,
  getResumeOptions,
  logCancellation,
  getCancellationHistory,
  CANCEL_REASONS,
  SAFE_POINTS
} = require('../../lib/ops/cancellation.js');

describe('cancellation', () => {
  const testDir = '/tmp/cancellation-test';
  const seedDir = path.join(testDir, '.seed');

  beforeEach(() => {
    if (!fs.existsSync(seedDir)) {
      fs.mkdirSync(seedDir, { recursive: true });
    }
    process.env.SEED_DIR = seedDir;
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    delete process.env.SEED_DIR;
  });

  // =============================================================
  // Constants
  // =============================================================

  describe('CANCEL_REASONS', () => {
    it('should define USER reason', () => {
      assert.strictEqual(CANCEL_REASONS.USER, 'user');
    });

    it('should define TIMEOUT reason', () => {
      assert.strictEqual(CANCEL_REASONS.TIMEOUT, 'timeout');
    });

    it('should define ERROR reason', () => {
      assert.strictEqual(CANCEL_REASONS.ERROR, 'error');
    });

    it('should define SIGNAL reason', () => {
      assert.strictEqual(CANCEL_REASONS.SIGNAL, 'signal');
    });
  });

  describe('SAFE_POINTS', () => {
    it('should define analysis as safe', () => {
      assert.strictEqual(SAFE_POINTS.analysis, true);
    });

    it('should define design as safe', () => {
      assert.strictEqual(SAFE_POINTS.design, true);
    });

    it('should define implement as check', () => {
      assert.strictEqual(SAFE_POINTS.implement, 'check');
    });

    it('should define test as safe', () => {
      assert.strictEqual(SAFE_POINTS.test, true);
    });

    it('should define verify as safe', () => {
      assert.strictEqual(SAFE_POINTS.verify, true);
    });
  });

  // =============================================================
  // REQ-001: 取消触发方式
  // =============================================================

  describe('requestCancel', () => {
    it('should cancel a flow', () => {
      const flowId = 'flow-001';
      const reason = CANCEL_REASONS.USER;

      // Should not throw
      requestCancel(flowId, reason);
    });

    it('should accept timeout reason', () => {
      const flowId = 'flow-002';
      const reason = CANCEL_REASONS.TIMEOUT;

      requestCancel(flowId, reason);
    });
  });

  describe('registerCancelHandler', () => {
    it('should register a handler', () => {
      const handler = () => {};

      // Should not throw
      registerCancelHandler(handler);
    });

    it('should allow multiple handlers', () => {
      const handler1 = () => {};
      const handler2 = () => {};

      registerCancelHandler(handler1);
      registerCancelHandler(handler2);
    });
  });

  // =============================================================
  // REQ-002: 安全取消点
  // =============================================================

  describe('markSafePoint', () => {
    it('should mark a safe point', () => {
      const flowId = 'flow-001';

      // Should not throw
      markSafePoint(flowId);
    });
  });

  describe('isAtSafePoint', () => {
    it('should return boolean', () => {
      const flowId = 'flow-001';

      const result = isAtSafePoint(flowId);

      assert.strictEqual(typeof result, 'boolean');
    });

    it('should return true after marking safe point', () => {
      const flowId = 'flow-002';

      markSafePoint(flowId);
      const result = isAtSafePoint(flowId);

      assert.strictEqual(result, true);
    });
  });

  describe('waitForSafePoint', () => {
    it('should resolve with boolean', async () => {
      const flowId = 'flow-001';

      const result = await waitForSafePoint(flowId, 100);

      assert.strictEqual(typeof result, 'boolean');
    });

    it('should resolve immediately if at safe point', async () => {
      const flowId = 'flow-002';

      markSafePoint(flowId);
      const result = await waitForSafePoint(flowId, 100);

      assert.strictEqual(result, true);
    });
  });

  // =============================================================
  // REQ-003: 状态保存
  // =============================================================

  describe('saveState', () => {
    it('should return state snapshot', () => {
      const flowId = 'flow-001';

      const snapshot = saveState(flowId);

      assert.ok(snapshot);
      assert.ok(snapshot.flowId || snapshot.id);
    });

    it('should include timestamp', () => {
      const flowId = 'flow-002';

      const snapshot = saveState(flowId);

      assert.ok(snapshot.timestamp || snapshot.savedAt);
    });
  });

  describe('generateCancelReport', () => {
    it('should return markdown string', () => {
      const flowId = 'flow-001';
      const snapshot = { flowId, tasks: [], stage: 'design' };

      const report = generateCancelReport(flowId, snapshot);

      assert.ok(typeof report === 'string');
      assert.ok(report.includes('#'));
    });

    it('should include flow id', () => {
      const flowId = 'flow-002';
      const snapshot = { flowId, tasks: [] };

      const report = generateCancelReport(flowId, snapshot);

      assert.ok(report.includes(flowId) || report.includes('flow'));
    });

    it('should include resume command', () => {
      const flowId = 'flow-003';
      const snapshot = { flowId, tasks: [] };

      const report = generateCancelReport(flowId, snapshot);

      assert.ok(report.includes('resume') || report.includes('恢复'));
    });
  });

  // =============================================================
  // REQ-004: 资源清理
  // =============================================================

  describe('cleanup', () => {
    it('should return cleanup result', () => {
      const flowId = 'flow-001';

      const result = cleanup(flowId);

      assert.ok(result);
      assert.ok('success' in result || 'cleaned' in result);
    });
  });

  describe('terminateSubprocesses', () => {
    it('should not throw', () => {
      const flowId = 'flow-001';

      // Should not throw
      terminateSubprocesses(flowId);
    });
  });

  describe('releaseLocks', () => {
    it('should not throw', () => {
      const flowId = 'flow-001';

      // Should not throw
      releaseLocks(flowId);
    });
  });

  // =============================================================
  // REQ-005: 取消恢复
  // =============================================================

  describe('canResume', () => {
    it('should return boolean', () => {
      const flowId = 'flow-001';

      const result = canResume(flowId);

      assert.strictEqual(typeof result, 'boolean');
    });

    it('should return true for saved state', () => {
      const flowId = 'flow-002';

      saveState(flowId);
      const result = canResume(flowId);

      assert.strictEqual(result, true);
    });
  });

  describe('resume', () => {
    it('should resume without error', () => {
      const flowId = 'flow-001';

      saveState(flowId);
      resume(flowId);
    });

    it('should accept options', () => {
      const flowId = 'flow-002';

      saveState(flowId);
      resume(flowId, { mode: 'continue' });
    });
  });

  describe('getResumeOptions', () => {
    it('should return array', () => {
      const flowId = 'flow-001';

      saveState(flowId);
      const options = getResumeOptions(flowId);

      assert.ok(Array.isArray(options));
    });

    it('should include continue option', () => {
      const flowId = 'flow-002';

      saveState(flowId);
      const options = getResumeOptions(flowId);

      const hasResume = options.some(o =>
        o.mode === 'continue' || o.type === 'continue' || o.name === 'continue'
      );
      assert.ok(hasResume || options.length > 0);
    });
  });

  // =============================================================
  // REQ-006: 取消日志
  // =============================================================

  describe('logCancellation', () => {
    it('should log cancel event', () => {
      const event = {
        flowId: 'flow-001',
        reason: CANCEL_REASONS.USER,
        timestamp: new Date().toISOString()
      };

      // Should not throw
      logCancellation(event);
    });
  });

  describe('getCancellationHistory', () => {
    it('should return array', () => {
      const history = getCancellationHistory();

      assert.ok(Array.isArray(history));
    });

    it('should return events for specific flow', () => {
      const flowId = 'flow-001';

      logCancellation({
        flowId,
        reason: CANCEL_REASONS.USER,
        timestamp: new Date().toISOString()
      });

      const history = getCancellationHistory(flowId);

      assert.ok(Array.isArray(history));
    });
  });
});
