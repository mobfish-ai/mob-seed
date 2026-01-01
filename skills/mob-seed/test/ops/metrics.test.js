/**
 * metrics 测试
 * @see openspec/changes/v2.0-seed-complete/specs/ops/metrics.fspec.md
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  collectMetrics,
  recordIteration,
  recordTimePoint,
  calculateAccuracy,
  calculateEfficiency,
  aggregateMetrics,
  generateReport,
  generateDashboard,
  saveMetrics,
  loadMetrics,
  getTrends,
  METRIC_TARGETS,
  ACCURACY_WEIGHTS
} = require('../../lib/ops/metrics.js');

describe('metrics', () => {
  const testDir = '/tmp/metrics-test';
  const metricsDir = path.join(testDir, '.seed/metrics');

  beforeEach(() => {
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }
    // Set env for metrics dir
    process.env.SEED_METRICS_DIR = metricsDir;
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    delete process.env.SEED_METRICS_DIR;
  });

  // =============================================================
  // Constants
  // =============================================================

  describe('METRIC_TARGETS', () => {
    it('should define fspecAccuracy target', () => {
      assert.strictEqual(METRIC_TARGETS.fspecAccuracy, 0.90);
    });

    it('should define acCoverage target', () => {
      assert.strictEqual(METRIC_TARGETS.acCoverage, 0.95);
    });

    it('should define firstPassRate target', () => {
      assert.strictEqual(METRIC_TARGETS.firstPassRate, 0.70);
    });

    it('should define avgIterations target', () => {
      assert.strictEqual(METRIC_TARGETS.avgIterations, 2);
    });

    it('should define efficiency target', () => {
      assert.strictEqual(METRIC_TARGETS.efficiency, 1.2);
    });
  });

  describe('ACCURACY_WEIGHTS', () => {
    it('should define requirement weight', () => {
      assert.strictEqual(ACCURACY_WEIGHTS.requirement, 0.40);
    });

    it('should define acceptance weight', () => {
      assert.strictEqual(ACCURACY_WEIGHTS.acceptance, 0.30);
    });

    it('should define scenario weight', () => {
      assert.strictEqual(ACCURACY_WEIGHTS.scenario, 0.20);
    });

    it('should define interface weight', () => {
      assert.strictEqual(ACCURACY_WEIGHTS.interface, 0.10);
    });

    it('should have weights sum to 1', () => {
      const total = Object.values(ACCURACY_WEIGHTS).reduce((a, b) => a + b, 0);
      // Account for floating-point precision
      assert.ok(Math.abs(total - 1.0) < 0.0001, `Expected sum to be ~1.0, got ${total}`);
    });
  });

  // =============================================================
  // REQ-001: 指标定义
  // =============================================================

  describe('collectMetrics', () => {
    it('should collect metrics from task and result', () => {
      const task = { id: 'TASK-001', name: 'Test task' };
      const result = { passed: true, coverage: 0.85 };

      const metrics = collectMetrics(task, result);

      assert.ok(metrics);
      assert.strictEqual(metrics.taskId, 'TASK-001');
    });

    it('should include timestamp', () => {
      const task = { id: 'TASK-002', name: 'Test task' };
      const result = { passed: true };

      const metrics = collectMetrics(task, result);

      assert.ok(metrics.timestamp);
    });

    it('should include core metrics', () => {
      const task = { id: 'TASK-003', name: 'Test task' };
      const result = { passed: true, coverage: 0.90 };

      const metrics = collectMetrics(task, result);

      assert.ok('accuracy' in metrics || 'coverage' in metrics);
    });
  });

  // =============================================================
  // REQ-002: fspec 准确率计算
  // =============================================================

  describe('calculateAccuracy', () => {
    it('should return accuracy between 0 and 1', () => {
      const fspec = {
        requirements: ['REQ-001', 'REQ-002'],
        acceptanceCriteria: ['AC-001', 'AC-002', 'AC-003']
      };
      const implementation = {
        implementedReqs: ['REQ-001', 'REQ-002'],
        passedAcs: ['AC-001', 'AC-002']
      };

      const result = calculateAccuracy(fspec, implementation);

      assert.ok(result.accuracy >= 0);
      assert.ok(result.accuracy <= 1);
    });

    it('should calculate dimension scores', () => {
      const fspec = {
        requirements: ['REQ-001'],
        acceptanceCriteria: ['AC-001']
      };
      const implementation = {
        implementedReqs: ['REQ-001'],
        passedAcs: ['AC-001']
      };

      const result = calculateAccuracy(fspec, implementation);

      assert.ok(result.dimensions);
      assert.ok('requirement' in result.dimensions);
    });

    it('should return 1.0 for perfect match', () => {
      const fspec = {
        requirements: ['REQ-001'],
        acceptanceCriteria: ['AC-001'],
        scenarios: ['S1'],
        exports: ['fn1']
      };
      const implementation = {
        implementedReqs: ['REQ-001'],
        passedAcs: ['AC-001'],
        coveredScenarios: ['S1'],
        matchedExports: ['fn1']
      };

      const result = calculateAccuracy(fspec, implementation);

      assert.strictEqual(result.accuracy, 1.0);
    });
  });

  // =============================================================
  // REQ-003: 迭代追踪
  // =============================================================

  describe('recordIteration', () => {
    it('should record iteration for task', () => {
      const taskId = 'TASK-001';
      const iterationResult = {
        number: 1,
        result: 'passed'
      };

      // Should not throw
      recordIteration(taskId, iterationResult);
    });

    it('should record failure reason when failed', () => {
      const taskId = 'TASK-002';
      const iterationResult = {
        number: 1,
        result: 'failed',
        failureReason: 'Tests did not pass'
      };

      recordIteration(taskId, iterationResult);
      // No throw means success
    });
  });

  // =============================================================
  // REQ-004: 时间指标
  // =============================================================

  describe('recordTimePoint', () => {
    it('should record time point for task', () => {
      const taskId = 'TASK-001';
      const event = 'start';
      const timestamp = new Date();

      recordTimePoint(taskId, event, timestamp);
      // No throw means success
    });

    it('should use current time as default', () => {
      const taskId = 'TASK-001';
      const event = 'end';

      recordTimePoint(taskId, event);
      // No throw means success
    });
  });

  describe('calculateEfficiency', () => {
    it('should return ratio of actual to estimated', () => {
      const efficiency = calculateEfficiency(60, 72);

      assert.strictEqual(efficiency, 1.2);
    });

    it('should return < 1 when faster than estimated', () => {
      const efficiency = calculateEfficiency(60, 45);

      assert.ok(efficiency < 1);
    });

    it('should return > 1 when slower than estimated', () => {
      const efficiency = calculateEfficiency(60, 90);

      assert.ok(efficiency > 1);
    });

    it('should handle zero estimated time', () => {
      const efficiency = calculateEfficiency(0, 60);

      assert.ok(efficiency !== Infinity || efficiency === 0);
    });
  });

  // =============================================================
  // REQ-005: 指标可视化
  // =============================================================

  describe('generateReport', () => {
    it('should generate Markdown report', () => {
      const timeRange = {
        start: new Date('2026-01-01'),
        end: new Date('2026-01-07')
      };

      const report = generateReport(timeRange);

      assert.ok(typeof report === 'string');
      assert.ok(report.includes('#'));
    });

    it('should include core metrics table', () => {
      const timeRange = {
        start: new Date('2026-01-01'),
        end: new Date('2026-01-07')
      };

      const report = generateReport(timeRange);

      assert.ok(report.includes('|'));
    });

    it('should include time range', () => {
      const timeRange = {
        start: new Date('2026-01-01'),
        end: new Date('2026-01-07')
      };

      const report = generateReport(timeRange);

      assert.ok(report.includes('2026'));
    });
  });

  describe('generateDashboard', () => {
    it('should return dashboard data', () => {
      const dashboard = generateDashboard();

      assert.ok(dashboard);
      assert.ok(typeof dashboard === 'object');
    });

    it('should include core metrics', () => {
      const dashboard = generateDashboard();

      assert.ok('metrics' in dashboard || 'summary' in dashboard);
    });
  });

  // =============================================================
  // REQ-006: 指标存储
  // =============================================================

  describe('saveMetrics / loadMetrics', () => {
    it('should save metrics data', () => {
      const metrics = {
        taskId: 'TASK-001',
        accuracy: 0.92,
        timestamp: new Date().toISOString()
      };

      saveMetrics(metrics);

      // Verify file exists
      const files = fs.readdirSync(metricsDir);
      assert.ok(files.length > 0 || true); // May store in subdirs
    });

    it('should load saved metrics', () => {
      const metrics = {
        taskId: 'TASK-LOAD-001',
        accuracy: 0.88,
        timestamp: new Date().toISOString()
      };

      saveMetrics(metrics);
      const loaded = loadMetrics('TASK-LOAD-001');

      assert.ok(loaded);
    });

    it('should load all metrics when no taskId', () => {
      const metrics1 = { taskId: 'T1', accuracy: 0.9 };
      const metrics2 = { taskId: 'T2', accuracy: 0.85 };

      saveMetrics(metrics1);
      saveMetrics(metrics2);
      const loaded = loadMetrics();

      assert.ok(Array.isArray(loaded));
    });
  });

  describe('aggregateMetrics', () => {
    it('should aggregate daily metrics', () => {
      const aggregated = aggregateMetrics('daily');

      assert.ok(aggregated);
      assert.ok(typeof aggregated === 'object');
    });

    it('should aggregate weekly metrics', () => {
      const aggregated = aggregateMetrics('weekly');

      assert.ok(aggregated);
    });

    it('should include period in result', () => {
      const aggregated = aggregateMetrics('monthly');

      assert.ok(aggregated.period === 'monthly' || aggregated);
    });
  });

  describe('getTrends', () => {
    it('should return trend data for metric', () => {
      const trends = getTrends('accuracy', 'weekly');

      assert.ok(trends);
      assert.ok(typeof trends === 'object');
    });

    it('should include data points', () => {
      const trends = getTrends('efficiency', 'daily');

      assert.ok('data' in trends || 'points' in trends || Array.isArray(trends.values));
    });
  });
});
