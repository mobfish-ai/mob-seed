/**
 * Development Metrics (开发指标)
 *
 * 收集开发过程中的关键指标，包括准确率、覆盖率、迭代次数等。
 *
 * @see openspec/changes/v2.0-seed-complete/specs/ops/metrics.fspec.md
 * @module lib/ops/metrics
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 核心指标目标值
 * @see REQ-001: 指标定义
 */
const METRIC_TARGETS = {
  fspecAccuracy: 0.90,     // ≥90%
  acCoverage: 0.95,        // ≥95%
  firstPassRate: 0.70,     // ≥70%
  avgIterations: 2,        // ≤2次
  efficiency: 1.2          // ≤1.2
};

/**
 * 准确率计算维度权重
 * @see REQ-002: fspec 准确率计算
 */
const ACCURACY_WEIGHTS = {
  requirement: 0.40,  // 需求覆盖
  acceptance: 0.30,   // AC 满足
  scenario: 0.20,     // 场景匹配
  interface: 0.10     // 接口一致
};

/**
 * 指标存储（内存缓存 + 文件存储）
 */
const metricsStore = {
  tasks: {},      // taskId -> metrics
  iterations: {}, // taskId -> iterations[]
  timePoints: {}  // taskId -> { event: timestamp }
};

/**
 * 获取指标存储目录
 */
function getMetricsDir() {
  return process.env.SEED_METRICS_DIR || path.join(process.cwd(), '.seed/metrics');
}

/**
 * 收集任务指标
 *
 * @see REQ-001 AC-002: 自动化数据收集
 *
 * @param {Object} task - 任务对象
 * @param {Object} result - 执行结果
 * @returns {Object} 指标数据
 */
function collectMetrics(task, result) {
  const taskId = task.id || task.taskId || 'unknown';
  const timestamp = new Date().toISOString();

  const metrics = {
    taskId,
    timestamp,
    taskName: task.name || '',
    passed: result.passed || false,
    coverage: result.coverage || 0,
    accuracy: result.accuracy || 0,
    iterations: metricsStore.iterations[taskId]?.length || 1,
    timePoints: metricsStore.timePoints[taskId] || {}
  };

  // 存储到内存
  metricsStore.tasks[taskId] = metrics;

  return metrics;
}

/**
 * 记录迭代
 *
 * @see REQ-003 AC-007: 自动追踪迭代次数
 *
 * @param {string} taskId - 任务 ID
 * @param {Object} iterationResult - 迭代结果
 */
function recordIteration(taskId, iterationResult) {
  if (!metricsStore.iterations[taskId]) {
    metricsStore.iterations[taskId] = [];
  }

  const iteration = {
    number: iterationResult.number || metricsStore.iterations[taskId].length + 1,
    start: iterationResult.start || new Date().toISOString(),
    end: iterationResult.end || new Date().toISOString(),
    result: iterationResult.result || 'unknown',
    failureReason: iterationResult.failureReason || null
  };

  metricsStore.iterations[taskId].push(iteration);
}

/**
 * 记录时间点
 *
 * @see REQ-004 AC-010: 记录关键时间点
 *
 * @param {string} taskId - 任务 ID
 * @param {string} event - 事件名称
 * @param {Date} timestamp - 时间戳
 */
function recordTimePoint(taskId, event, timestamp = new Date()) {
  if (!metricsStore.timePoints[taskId]) {
    metricsStore.timePoints[taskId] = {};
  }

  metricsStore.timePoints[taskId][event] = timestamp instanceof Date
    ? timestamp.toISOString()
    : timestamp;
}

/**
 * 计算 fspec 准确率
 *
 * @see REQ-002 AC-004: 多维度准确率计算
 *
 * @param {Object} fspec - 规格对象
 * @param {Object} implementation - 实现对象
 * @returns {Object} 准确率结果
 */
function calculateAccuracy(fspec, implementation) {
  const dimensions = {};

  // 需求覆盖
  const totalReqs = (fspec.requirements || []).length;
  const implReqs = (implementation.implementedReqs || []).length;
  dimensions.requirement = totalReqs > 0 ? implReqs / totalReqs : 1;

  // AC 满足
  const totalAcs = (fspec.acceptanceCriteria || []).length;
  const passedAcs = (implementation.passedAcs || []).length;
  dimensions.acceptance = totalAcs > 0 ? passedAcs / totalAcs : 1;

  // 场景匹配
  const totalScenarios = (fspec.scenarios || []).length;
  const coveredScenarios = (implementation.coveredScenarios || []).length;
  dimensions.scenario = totalScenarios > 0 ? coveredScenarios / totalScenarios : 1;

  // 接口一致
  const totalExports = (fspec.exports || []).length;
  const matchedExports = (implementation.matchedExports || []).length;
  dimensions.interface = totalExports > 0 ? matchedExports / totalExports : 1;

  // 计算加权总分
  let accuracy = 0;
  for (const [key, weight] of Object.entries(ACCURACY_WEIGHTS)) {
    accuracy += (dimensions[key] || 0) * weight;
  }

  return {
    accuracy: Math.round(accuracy * 100) / 100,
    dimensions,
    details: {
      requirements: { total: totalReqs, implemented: implReqs },
      acceptance: { total: totalAcs, passed: passedAcs },
      scenarios: { total: totalScenarios, covered: coveredScenarios },
      exports: { total: totalExports, matched: matchedExports }
    }
  };
}

/**
 * 计算工作流效率
 *
 * @param {number} estimated - 预估时间（分钟）
 * @param {number} actual - 实际时间（分钟）
 * @returns {number} 效率值（>1 为低效，<1 为高效）
 */
function calculateEfficiency(estimated, actual) {
  if (!estimated || estimated <= 0) {
    return 0; // 无法计算
  }
  return Math.round((actual / estimated) * 100) / 100;
}

/**
 * 聚合指标数据
 *
 * @see REQ-006 AC-018: 定期数据聚合
 *
 * @param {string} period - 聚合周期 (daily/weekly/monthly)
 * @returns {Object} 聚合后的指标
 */
function aggregateMetrics(period) {
  const tasks = Object.values(metricsStore.tasks);
  const taskCount = tasks.length;

  if (taskCount === 0) {
    return {
      period,
      taskCount: 0,
      averageAccuracy: 0,
      averageCoverage: 0,
      firstPassRate: 0,
      averageIterations: 0
    };
  }

  // 计算各项平均值
  const totalAccuracy = tasks.reduce((sum, t) => sum + (t.accuracy || 0), 0);
  const totalCoverage = tasks.reduce((sum, t) => sum + (t.coverage || 0), 0);
  const passedFirst = tasks.filter(t => t.iterations === 1 && t.passed).length;
  const totalIterations = tasks.reduce((sum, t) => sum + (t.iterations || 1), 0);

  return {
    period,
    taskCount,
    averageAccuracy: Math.round((totalAccuracy / taskCount) * 100) / 100,
    averageCoverage: Math.round((totalCoverage / taskCount) * 100) / 100,
    firstPassRate: Math.round((passedFirst / taskCount) * 100) / 100,
    averageIterations: Math.round((totalIterations / taskCount) * 10) / 10
  };
}

/**
 * 生成指标报告
 *
 * @see REQ-005 AC-013: 生成 Markdown 报告
 *
 * @param {Object} timeRange - 时间范围 { start, end }
 * @param {Object} options - 报告选项
 * @returns {string} Markdown 格式报告
 */
function generateReport(timeRange, options = {}) {
  const startDate = timeRange.start instanceof Date
    ? timeRange.start.toISOString().split('T')[0]
    : timeRange.start;
  const endDate = timeRange.end instanceof Date
    ? timeRange.end.toISOString().split('T')[0]
    : timeRange.end;

  const aggregated = aggregateMetrics('report');

  const lines = [
    '# 开发指标报告',
    '',
    `> 时间范围: ${startDate} ~ ${endDate}`,
    `> 任务数量: ${aggregated.taskCount}`,
    '',
    '## 核心指标',
    '',
    '| 指标 | 当前值 | 目标值 | 状态 |',
    '|------|--------|--------|------|',
    `| fspec 准确率 | ${Math.round(aggregated.averageAccuracy * 100)}% | ≥${Math.round(METRIC_TARGETS.fspecAccuracy * 100)}% | ${aggregated.averageAccuracy >= METRIC_TARGETS.fspecAccuracy ? '✅' : '⚠️'} |`,
    `| AC 覆盖率 | ${Math.round(aggregated.averageCoverage * 100)}% | ≥${Math.round(METRIC_TARGETS.acCoverage * 100)}% | ${aggregated.averageCoverage >= METRIC_TARGETS.acCoverage ? '✅' : '⚠️'} |`,
    `| 首次通过率 | ${Math.round(aggregated.firstPassRate * 100)}% | ≥${Math.round(METRIC_TARGETS.firstPassRate * 100)}% | ${aggregated.firstPassRate >= METRIC_TARGETS.firstPassRate ? '✅' : '⚠️'} |`,
    `| 平均迭代次数 | ${aggregated.averageIterations} | ≤${METRIC_TARGETS.avgIterations} | ${aggregated.averageIterations <= METRIC_TARGETS.avgIterations ? '✅' : '⚠️'} |`,
    ''
  ];

  return lines.join('\n');
}

/**
 * 生成仪表盘数据
 *
 * @returns {Object} 仪表盘数据
 */
function generateDashboard() {
  const aggregated = aggregateMetrics('dashboard');

  return {
    summary: {
      taskCount: aggregated.taskCount,
      accuracy: aggregated.averageAccuracy,
      coverage: aggregated.averageCoverage,
      firstPassRate: aggregated.firstPassRate,
      avgIterations: aggregated.averageIterations
    },
    metrics: {
      fspecAccuracy: {
        current: aggregated.averageAccuracy,
        target: METRIC_TARGETS.fspecAccuracy,
        status: aggregated.averageAccuracy >= METRIC_TARGETS.fspecAccuracy ? 'ok' : 'warning'
      },
      acCoverage: {
        current: aggregated.averageCoverage,
        target: METRIC_TARGETS.acCoverage,
        status: aggregated.averageCoverage >= METRIC_TARGETS.acCoverage ? 'ok' : 'warning'
      },
      firstPassRate: {
        current: aggregated.firstPassRate,
        target: METRIC_TARGETS.firstPassRate,
        status: aggregated.firstPassRate >= METRIC_TARGETS.firstPassRate ? 'ok' : 'warning'
      },
      avgIterations: {
        current: aggregated.averageIterations,
        target: METRIC_TARGETS.avgIterations,
        status: aggregated.averageIterations <= METRIC_TARGETS.avgIterations ? 'ok' : 'warning'
      }
    },
    updatedAt: new Date().toISOString()
  };
}

/**
 * 保存指标数据
 *
 * @see REQ-006 AC-017: 支持增量追加
 *
 * @param {Object} metrics - 指标数据
 */
function saveMetrics(metrics) {
  const metricsDir = getMetricsDir();
  const tasksDir = path.join(metricsDir, 'tasks');

  // 确保目录存在
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }

  const taskId = metrics.taskId || 'unknown';
  const filePath = path.join(tasksDir, `${taskId}.json`);

  // 保存到文件
  fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2));

  // 同时更新内存存储
  metricsStore.tasks[taskId] = metrics;
}

/**
 * 加载指标数据
 *
 * @param {string} taskId - 任务 ID（可选，不传则加载全部）
 * @returns {Array<Object>|Object} 指标数据列表或单个指标
 */
function loadMetrics(taskId) {
  const metricsDir = getMetricsDir();
  const tasksDir = path.join(metricsDir, 'tasks');

  if (taskId) {
    // 加载特定任务
    const filePath = path.join(tasksDir, `${taskId}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    // 从内存获取
    return metricsStore.tasks[taskId] || null;
  }

  // 加载所有任务
  const results = [];

  if (fs.existsSync(tasksDir)) {
    const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(tasksDir, file), 'utf-8');
        results.push(JSON.parse(content));
      } catch (e) {
        // 忽略无法解析的文件
      }
    }
  }

  // 合并内存中的数据
  for (const [id, metrics] of Object.entries(metricsStore.tasks)) {
    if (!results.find(r => r.taskId === id)) {
      results.push(metrics);
    }
  }

  return results;
}

/**
 * 获取趋势数据
 *
 * @see REQ-005 AC-014: 包含趋势分析
 *
 * @param {string} metric - 指标名称
 * @param {string} period - 时间周期
 * @returns {Object} 趋势数据
 */
function getTrends(metric, period) {
  const allMetrics = loadMetrics();

  // 根据指标名获取对应字段
  const metricField = {
    accuracy: 'accuracy',
    coverage: 'coverage',
    efficiency: 'efficiency',
    iterations: 'iterations'
  }[metric] || metric;

  // 按时间排序并提取值
  const sorted = allMetrics
    .filter(m => m[metricField] !== undefined)
    .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  const values = sorted.map(m => m[metricField] || 0);
  const timestamps = sorted.map(m => m.timestamp || '');

  // 计算趋势（简单：最后值 vs 第一个值）
  let trend = 'stable';
  if (values.length >= 2) {
    const first = values[0];
    const last = values[values.length - 1];
    if (last > first * 1.05) trend = 'up';
    else if (last < first * 0.95) trend = 'down';
  }

  return {
    metric,
    period,
    values,
    timestamps,
    trend,
    average: values.length > 0
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100
      : 0,
    min: values.length > 0 ? Math.min(...values) : 0,
    max: values.length > 0 ? Math.max(...values) : 0
  };
}

module.exports = {
  // 指标收集
  collectMetrics,
  recordIteration,
  recordTimePoint,

  // 计算
  calculateAccuracy,
  calculateEfficiency,
  aggregateMetrics,

  // 报告
  generateReport,
  generateDashboard,

  // 存储
  saveMetrics,
  loadMetrics,
  getTrends,

  // 常量
  METRIC_TARGETS,
  ACCURACY_WEIGHTS
};
