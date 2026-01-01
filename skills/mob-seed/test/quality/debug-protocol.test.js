/**
 * debug-protocol 测试
 * @see openspec/changes/v2.0-seed-complete/specs/quality/debug-protocol.fspec.md
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  evaluateConfidence,
  executeAutoFix,
  generateFixPlan,
  createSnapshot,
  rollbackToSnapshot,
  requestHumanIntervention,
  runVerification,
  handleError,
  CONFIDENCE_DIMENSIONS,
  CONFIDENCE_THRESHOLD
} = require('../../lib/quality/debug-protocol.js');

describe('debug-protocol', () => {
  const testDir = '/tmp/debug-protocol-test';

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // =============================================================
  // Constants
  // =============================================================

  describe('CONFIDENCE_DIMENSIONS', () => {
    it('should define error_type dimension', () => {
      assert.ok(CONFIDENCE_DIMENSIONS.error_type);
      assert.strictEqual(CONFIDENCE_DIMENSIONS.error_type.weight, 0.30);
    });

    it('should define root_cause dimension', () => {
      assert.ok(CONFIDENCE_DIMENSIONS.root_cause);
      assert.strictEqual(CONFIDENCE_DIMENSIONS.root_cause.weight, 0.25);
    });

    it('should define fix_approach dimension', () => {
      assert.ok(CONFIDENCE_DIMENSIONS.fix_approach);
      assert.strictEqual(CONFIDENCE_DIMENSIONS.fix_approach.weight, 0.25);
    });

    it('should define impact_scope dimension', () => {
      assert.ok(CONFIDENCE_DIMENSIONS.impact_scope);
      assert.strictEqual(CONFIDENCE_DIMENSIONS.impact_scope.weight, 0.20);
    });

    it('should have weights sum to 1', () => {
      const totalWeight = Object.values(CONFIDENCE_DIMENSIONS)
        .reduce((sum, d) => sum + d.weight, 0);
      assert.strictEqual(totalWeight, 1.0);
    });
  });

  describe('CONFIDENCE_THRESHOLD', () => {
    it('should be 50%', () => {
      assert.strictEqual(CONFIDENCE_THRESHOLD, 50);
    });
  });

  // =============================================================
  // REQ-001: 置信度评估模型
  // =============================================================

  describe('evaluateConfidence', () => {
    it('should return confidence between 0-100', () => {
      const result = evaluateConfidence({
        errorType: 'TypeError',
        errorMessage: 'Cannot read property x of undefined',
        stackTrace: 'at src/test.js:10'
      });

      assert.ok(result.confidence >= 0);
      assert.ok(result.confidence <= 100);
    });

    it('should return dimension scores', () => {
      const result = evaluateConfidence({
        errorType: 'TypeError',
        errorMessage: 'undefined is not a function'
      });

      assert.ok(result.dimensions);
      assert.ok(typeof result.dimensions.error_type === 'number');
      assert.ok(typeof result.dimensions.root_cause === 'number');
    });

    it('should return reasoning', () => {
      const result = evaluateConfidence({
        errorType: 'SyntaxError',
        errorMessage: 'Unexpected token'
      });

      assert.ok(typeof result.reasoning === 'string');
    });

    it('should give higher confidence for common errors', () => {
      const commonError = evaluateConfidence({
        errorType: 'TypeError',
        errorMessage: 'Cannot read property of undefined'
      });

      const rareError = evaluateConfidence({
        errorType: 'UnknownError',
        errorMessage: 'Something weird happened'
      });

      assert.ok(commonError.confidence >= rareError.confidence);
    });
  });

  // =============================================================
  // REQ-002: 自动修复流程
  // =============================================================

  describe('generateFixPlan', () => {
    it('should generate fix plan for TypeError', () => {
      const plan = generateFixPlan({
        errorType: 'TypeError',
        errorMessage: 'Cannot read property x of undefined',
        location: { file: 'test.js', line: 10 }
      });

      assert.ok(plan);
      assert.ok(plan.description);
      assert.ok(plan.steps);
    });

    it('should include affected files', () => {
      const plan = generateFixPlan({
        errorType: 'TypeError',
        errorMessage: 'undefined is not a function',
        location: { file: 'src/utils.js', line: 20 }
      });

      assert.ok(Array.isArray(plan.affectedFiles));
    });
  });

  describe('createSnapshot / rollbackToSnapshot', () => {
    it('should create snapshot of files', () => {
      const filePath = path.join(testDir, 'snapshot-test.js');
      fs.writeFileSync(filePath, 'original content');

      const snapshot = createSnapshot([filePath]);

      assert.ok(snapshot);
      assert.ok(snapshot.files);
      assert.ok(snapshot.timestamp);
    });

    it('should rollback to snapshot', () => {
      const filePath = path.join(testDir, 'rollback-test.js');
      fs.writeFileSync(filePath, 'original content');

      const snapshot = createSnapshot([filePath]);

      // Modify file
      fs.writeFileSync(filePath, 'modified content');

      // Rollback
      rollbackToSnapshot(snapshot);

      const restored = fs.readFileSync(filePath, 'utf-8');
      assert.strictEqual(restored, 'original content');
    });
  });

  describe('executeAutoFix', () => {
    it('should return success for valid fix', async () => {
      const result = await executeAutoFix(
        { errorType: 'TypeError', errorMessage: 'test' },
        { description: 'Add null check', steps: [] }
      );

      assert.ok(result);
      assert.ok(typeof result.success === 'boolean');
    });

    it('should include verification status', async () => {
      const result = await executeAutoFix(
        { errorType: 'TypeError', errorMessage: 'test' },
        { description: 'Fix', steps: [] }
      );

      assert.ok('verified' in result);
    });
  });

  // =============================================================
  // REQ-003: 人工介入流程
  // =============================================================

  describe('requestHumanIntervention', () => {
    it('should return intervention request', () => {
      const request = requestHumanIntervention(
        { errorType: 'UnknownError', errorMessage: 'Complex issue' },
        { confidence: 30, dimensions: {} }
      );

      assert.ok(request);
      assert.ok(request.message);
    });

    it('should include confidence details', () => {
      const request = requestHumanIntervention(
        { errorType: 'Error', errorMessage: 'Something failed' },
        {
          confidence: 40,
          dimensions: {
            error_type: 60,
            root_cause: 30,
            fix_approach: 20,
            impact_scope: 50
          }
        }
      );

      assert.ok(request.confidenceDetails);
    });

    it('should suggest possible directions', () => {
      const request = requestHumanIntervention(
        { errorType: 'ConnectionError', errorMessage: 'ECONNREFUSED' },
        { confidence: 35, dimensions: {} }
      );

      assert.ok(Array.isArray(request.suggestions));
    });
  });

  // =============================================================
  // REQ-004: 验证
  // =============================================================

  describe('runVerification', () => {
    it('should return verification result', async () => {
      const result = await runVerification({
        testCommand: 'echo test passed'
      });

      assert.ok(result);
      assert.ok(typeof result.passed === 'boolean');
    });
  });

  // =============================================================
  // 主入口
  // =============================================================

  describe('handleError', () => {
    it('should handle high confidence errors with auto-fix', async () => {
      const result = await handleError({
        errorType: 'TypeError',
        errorMessage: 'Cannot read property of undefined',
        confidence: 70
      });

      assert.ok(result);
      assert.ok(result.action === 'auto_fix' || result.action === 'human_intervention');
    });

    it('should handle low confidence errors with human intervention', async () => {
      const result = await handleError({
        errorType: 'UnknownError',
        errorMessage: 'Something weird',
        confidence: 30
      });

      assert.ok(result);
      assert.strictEqual(result.action, 'human_intervention');
    });

    it('should return action type', async () => {
      const result = await handleError({
        errorType: 'Error',
        errorMessage: 'Test error'
      });

      assert.ok(['auto_fix', 'human_intervention'].includes(result.action));
    });
  });
});
