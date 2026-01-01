/**
 * flow-router 测试
 * @see openspec/changes/v2.0-seed-complete/specs/workflow/flow-router.fspec.md
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  executeFlow,
  executeQuickFlow,
  executeStandardFlow,
  executeFullFlow,
  getCurrentStage,
  advanceStage,
  revertStage,
  skipStage,
  saveFlowState,
  loadFlowState,
  getActiveFlows,
  getFlowOutputDir,
  generateFlowSummary,
  FLOW_STAGES
} = require('../../lib/workflow/flow-router.js');

describe('flow-router', () => {
  const testDir = '/tmp/flow-router-test';
  const stateDir = path.join(testDir, '.seed');

  beforeEach(() => {
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // =============================================================
  // REQ-001: Quick Flow 实现
  // =============================================================

  describe('FLOW_STAGES', () => {
    it('should define quick flow stages', () => {
      assert.deepStrictEqual(FLOW_STAGES.quick, ['understand', 'implement', 'verify']);
    });

    it('should define standard flow stages', () => {
      assert.deepStrictEqual(FLOW_STAGES.standard, ['analyze', 'design', 'implement', 'test', 'document']);
    });

    it('should define full flow stages', () => {
      assert.deepStrictEqual(FLOW_STAGES.full, ['research', 'spec', 'design', 'implement', 'test', 'document', 'review']);
    });
  });

  describe('executeFlow', () => {
    it('should route to quick flow', async () => {
      const result = await executeFlow('quick', { task: 'test', baseDir: testDir });
      assert.strictEqual(result.flowType, 'quick');
    });

    it('should route to standard flow', async () => {
      const result = await executeFlow('standard', { task: 'test', baseDir: testDir });
      assert.strictEqual(result.flowType, 'standard');
    });

    it('should route to full flow', async () => {
      const result = await executeFlow('full', { task: 'test', baseDir: testDir });
      assert.strictEqual(result.flowType, 'full');
    });

    it('should throw for unknown flow type', async () => {
      await assert.rejects(
        () => executeFlow('unknown', { task: 'test' }),
        /Unknown flow type/
      );
    });
  });

  describe('executeQuickFlow', () => {
    it('should return result with flowType quick', async () => {
      const result = await executeQuickFlow({ task: 'test', baseDir: testDir });
      assert.strictEqual(result.flowType, 'quick');
    });

    it('should include stages in result', async () => {
      const result = await executeQuickFlow({ task: 'test', baseDir: testDir });
      assert.ok(Array.isArray(result.stages));
      assert.strictEqual(result.stages.length, 3);
    });

    it('should generate flow id', async () => {
      const result = await executeQuickFlow({ task: 'test', baseDir: testDir });
      assert.ok(result.flowId);
      assert.ok(result.flowId.startsWith('flow-'));
    });
  });

  describe('executeStandardFlow', () => {
    it('should return result with flowType standard', async () => {
      const result = await executeStandardFlow({ task: 'test', baseDir: testDir });
      assert.strictEqual(result.flowType, 'standard');
    });

    it('should have 5 stages', async () => {
      const result = await executeStandardFlow({ task: 'test', baseDir: testDir });
      assert.strictEqual(result.stages.length, 5);
    });
  });

  describe('executeFullFlow', () => {
    it('should return result with flowType full', async () => {
      const result = await executeFullFlow({ task: 'test', baseDir: testDir });
      assert.strictEqual(result.flowType, 'full');
    });

    it('should have 7 stages', async () => {
      const result = await executeFullFlow({ task: 'test', baseDir: testDir });
      assert.strictEqual(result.stages.length, 7);
    });
  });

  // =============================================================
  // REQ-004: 流程状态管理
  // =============================================================

  describe('saveFlowState / loadFlowState', () => {
    it('should save and load flow state', () => {
      const flowId = 'flow-test-123';
      const state = {
        flowType: 'quick',
        currentStage: 'implement',
        completedStages: ['understand'],
        startTime: new Date().toISOString()
      };

      saveFlowState(flowId, state, testDir);
      const loaded = loadFlowState(flowId, testDir);

      assert.deepStrictEqual(loaded.flowType, state.flowType);
      assert.deepStrictEqual(loaded.currentStage, state.currentStage);
    });

    it('should return null for non-existent flow', () => {
      const result = loadFlowState('non-existent', testDir);
      assert.strictEqual(result, null);
    });
  });

  describe('getCurrentStage', () => {
    it('should return current stage from saved state', () => {
      const flowId = 'flow-test-456';
      const state = {
        flowType: 'standard',
        currentStage: 'design',
        completedStages: ['analyze']
      };
      saveFlowState(flowId, state, testDir);

      const stage = getCurrentStage(flowId, testDir);
      assert.strictEqual(stage.name, 'design');
      assert.strictEqual(stage.index, 1);
    });

    it('should return null for non-existent flow', () => {
      const stage = getCurrentStage('non-existent', testDir);
      assert.strictEqual(stage, null);
    });
  });

  // =============================================================
  // REQ-005: 阶段转换控制
  // =============================================================

  describe('advanceStage', () => {
    it('should advance to next stage', () => {
      const flowId = 'flow-advance-test';
      const state = {
        flowType: 'quick',
        currentStage: 'understand',
        completedStages: []
      };
      saveFlowState(flowId, state, testDir);

      const newStage = advanceStage(flowId, testDir);
      assert.strictEqual(newStage.name, 'implement');
    });

    it('should mark previous stage as completed', () => {
      const flowId = 'flow-advance-test2';
      const state = {
        flowType: 'quick',
        currentStage: 'understand',
        completedStages: []
      };
      saveFlowState(flowId, state, testDir);

      advanceStage(flowId, testDir);
      const loaded = loadFlowState(flowId, testDir);
      assert.ok(loaded.completedStages.includes('understand'));
    });

    it('should return completed status for last stage', () => {
      const flowId = 'flow-last-stage';
      const state = {
        flowType: 'quick',
        currentStage: 'verify',
        completedStages: ['understand', 'implement']
      };
      saveFlowState(flowId, state, testDir);

      const result = advanceStage(flowId, testDir);
      assert.strictEqual(result.completed, true);
    });
  });

  describe('revertStage', () => {
    it('should revert to specified stage', () => {
      const flowId = 'flow-revert-test';
      const state = {
        flowType: 'standard',
        currentStage: 'implement',
        completedStages: ['analyze', 'design']
      };
      saveFlowState(flowId, state, testDir);

      const result = revertStage(flowId, 'design', testDir);
      assert.strictEqual(result.name, 'design');
    });

    it('should keep completed stages before target', () => {
      const flowId = 'flow-revert-test2';
      const state = {
        flowType: 'standard',
        currentStage: 'test',
        completedStages: ['analyze', 'design', 'implement']
      };
      saveFlowState(flowId, state, testDir);

      revertStage(flowId, 'design', testDir);
      const loaded = loadFlowState(flowId, testDir);
      assert.deepStrictEqual(loaded.completedStages, ['analyze']);
    });
  });

  describe('skipStage', () => {
    it('should skip specified stage', () => {
      const flowId = 'flow-skip-test';
      const state = {
        flowType: 'standard',
        currentStage: 'design',
        completedStages: ['analyze'],
        skippedStages: []
      };
      saveFlowState(flowId, state, testDir);

      skipStage(flowId, 'design', 'Not needed for this task', testDir);
      const loaded = loadFlowState(flowId, testDir);
      assert.ok(loaded.skippedStages.includes('design'));
    });

    it('should record skip reason', () => {
      const flowId = 'flow-skip-test2';
      const state = {
        flowType: 'standard',
        currentStage: 'design',
        completedStages: ['analyze'],
        skippedStages: [],
        skipReasons: {}
      };
      saveFlowState(flowId, state, testDir);

      skipStage(flowId, 'design', 'Simple fix', testDir);
      const loaded = loadFlowState(flowId, testDir);
      assert.strictEqual(loaded.skipReasons.design, 'Simple fix');
    });
  });

  // =============================================================
  // REQ-006: 流程输出管理
  // =============================================================

  describe('getFlowOutputDir', () => {
    it('should return output directory path', () => {
      const dir = getFlowOutputDir('flow-123', testDir);
      assert.ok(dir.includes('output/flow/flow-123'));
    });
  });

  describe('getActiveFlows', () => {
    it('should return list of active flows', () => {
      const state1 = { flowType: 'quick', currentStage: 'implement', completedStages: [] };
      const state2 = { flowType: 'standard', currentStage: 'design', completedStages: [] };
      saveFlowState('flow-active-1', state1, testDir);
      saveFlowState('flow-active-2', state2, testDir);

      const active = getActiveFlows(testDir);
      assert.ok(active.length >= 2);
    });

    it('should not include completed flows', () => {
      const state = { flowType: 'quick', currentStage: null, completedStages: ['understand', 'implement', 'verify'], completed: true };
      saveFlowState('flow-completed', state, testDir);

      const active = getActiveFlows(testDir);
      assert.ok(!active.some(f => f.flowId === 'flow-completed'));
    });
  });

  describe('generateFlowSummary', () => {
    it('should generate markdown summary', () => {
      const state = {
        flowType: 'quick',
        currentStage: 'verify',
        completedStages: ['understand', 'implement'],
        startTime: new Date().toISOString()
      };
      saveFlowState('flow-summary-test', state, testDir);

      const summary = generateFlowSummary('flow-summary-test', testDir);
      assert.ok(summary.includes('# Flow Summary'));
      assert.ok(summary.includes('quick'));
    });
  });
});
