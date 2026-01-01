/**
 * complexity-router 测试
 * @see openspec/changes/v2.0-seed-complete/specs/core/complexity-router.fspec.md
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  evaluateComplexity,
  routeToFlow,
  getDefaultScores,
  parseFlowOverride,
  DIMENSIONS,
  THRESHOLDS
} = require('../../lib/router/complexity-router.js');

describe('complexity-router', () => {
  // =============================================================
  // REQ-001: 五维度评分模型
  // =============================================================

  describe('evaluateComplexity', () => {
    it('should return scores for all 5 dimensions', () => {
      const result = evaluateComplexity('添加一个简单的工具函数');

      assert.ok(result.scores, 'Should have scores');
      assert.ok(result.scores.impact_scope, 'Should have impact_scope');
      assert.ok(result.scores.architecture_change, 'Should have architecture_change');
      assert.ok(result.scores.external_deps, 'Should have external_deps');
      assert.ok(result.scores.business_complexity, 'Should have business_complexity');
      assert.ok(result.scores.uncertainty, 'Should have uncertainty');
    });

    it('should have scores between 1-3', () => {
      const result = evaluateComplexity('重构整个认证系统');

      for (const [dim, score] of Object.entries(result.scores)) {
        assert.ok(score >= 1 && score <= 3, `${dim} should be 1-3, got ${score}`);
      }
    });

    it('should calculate total score 5-15', () => {
      const result = evaluateComplexity('修复一个小 bug');

      assert.ok(result.total >= 5 && result.total <= 15,
        `Total should be 5-15, got ${result.total}`);
    });

    it('should return confidence level', () => {
      const result = evaluateComplexity('做一些改进');

      assert.ok(typeof result.confidence === 'number', 'Should have confidence');
      assert.ok(result.confidence >= 0 && result.confidence <= 1,
        `Confidence should be 0-1, got ${result.confidence}`);
    });
  });

  describe('getDefaultScores', () => {
    it('should return default scores (all 2)', () => {
      const defaults = getDefaultScores();

      assert.strictEqual(defaults.impact_scope, 2);
      assert.strictEqual(defaults.architecture_change, 2);
      assert.strictEqual(defaults.external_deps, 2);
      assert.strictEqual(defaults.business_complexity, 2);
      assert.strictEqual(defaults.uncertainty, 2);
    });
  });

  // =============================================================
  // REQ-002: 评分区间路由
  // =============================================================

  describe('routeToFlow', () => {
    it('should route score 5 to quick flow', () => {
      const result = routeToFlow(5);
      assert.strictEqual(result.flow, 'quick');
    });

    it('should route score 8 to quick flow', () => {
      const result = routeToFlow(8);
      assert.strictEqual(result.flow, 'quick');
    });

    it('should route score 9 to standard flow', () => {
      const result = routeToFlow(9);
      assert.strictEqual(result.flow, 'standard');
    });

    it('should route score 12 to standard flow', () => {
      const result = routeToFlow(12);
      assert.strictEqual(result.flow, 'standard');
    });

    it('should route score 13 to full flow', () => {
      const result = routeToFlow(13);
      assert.strictEqual(result.flow, 'full');
    });

    it('should route score 15 to full flow', () => {
      const result = routeToFlow(15);
      assert.strictEqual(result.flow, 'full');
    });

    it('should include estimated time', () => {
      const quick = routeToFlow(5);
      const standard = routeToFlow(10);
      const full = routeToFlow(14);

      assert.ok(quick.estimatedTime, 'Quick should have estimatedTime');
      assert.ok(standard.estimatedTime, 'Standard should have estimatedTime');
      assert.ok(full.estimatedTime, 'Full should have estimatedTime');
    });
  });

  // =============================================================
  // REQ-005: 边界情况处理
  // =============================================================

  describe('parseFlowOverride', () => {
    it('should parse --flow=quick', () => {
      const result = parseFlowOverride(['--flow=quick']);
      assert.strictEqual(result, 'quick');
    });

    it('should parse --flow=standard', () => {
      const result = parseFlowOverride(['--flow=standard']);
      assert.strictEqual(result, 'standard');
    });

    it('should parse --flow=full', () => {
      const result = parseFlowOverride(['--flow=full']);
      assert.strictEqual(result, 'full');
    });

    it('should return null if no override', () => {
      const result = parseFlowOverride(['--other=value']);
      assert.strictEqual(result, null);
    });

    it('should return null for empty args', () => {
      const result = parseFlowOverride([]);
      assert.strictEqual(result, null);
    });
  });

  describe('THRESHOLDS', () => {
    it('should have quick threshold at 8', () => {
      assert.strictEqual(THRESHOLDS.quick, 8);
    });

    it('should have standard threshold at 12', () => {
      assert.strictEqual(THRESHOLDS.standard, 12);
    });
  });
});
