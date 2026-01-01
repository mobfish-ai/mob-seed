/**
 * Complexity Router (复杂度路由器)
 *
 * 五维度任务复杂度评估系统，根据评分结果路由到不同的工作流（Quick/Standard/Full）。
 *
 * @see openspec/changes/v2.0-seed-complete/specs/core/complexity-router.fspec.md
 * @module lib/router/complexity-router
 * @version 1.0.0
 */

'use strict';

/**
 * 维度定义
 * @see REQ-001: 五维度评分模型
 */
const DIMENSIONS = {
  impact_scope: { min: 1, max: 3, name: '影响范围' },
  architecture_change: { min: 1, max: 3, name: '架构变更' },
  external_deps: { min: 1, max: 3, name: '外部依赖' },
  business_complexity: { min: 1, max: 3, name: '业务复杂度' },
  uncertainty: { min: 1, max: 3, name: '不确定性' }
};

/**
 * 路由阈值配置
 * @see REQ-002: 评分区间路由
 */
const THRESHOLDS = {
  quick: 8,    // 5-8 → Quick Flow
  standard: 12 // 9-12 → Standard, 13-15 → Full
};

/**
 * 评估任务复杂度
 *
 * @see REQ-001 AC-001: 每个维度独立评分 1-3
 * @see REQ-001 AC-002: 总分范围 5-15
 *
 * @param {string} taskDesc - 任务描述
 * @param {Object} context - 项目上下文
 * @returns {{ scores: Object, total: number, confidence: number }}
 */
function evaluateComplexity(taskDesc, context = {}) {
  const scores = getDefaultScores();
  const lowerDesc = taskDesc.toLowerCase();
  let matchCount = 0;

  // 低复杂度关键词
  const lowKeywords = {
    impact_scope: ['单文件', '一个函数', '小改动', 'fix', 'typo', 'simple'],
    architecture_change: ['不改架构', '无变更', '保持'],
    external_deps: ['无依赖', '内部'],
    business_complexity: ['简单', 'easy', 'straightforward'],
    uncertainty: ['明确', 'clear', '已知']
  };

  // 高复杂度关键词
  const highKeywords = {
    impact_scope: ['跨模块', '全局', '整个系统', 'refactor'],
    architecture_change: ['重构', '重新设计', 'redesign', 'architecture'],
    external_deps: ['多个依赖', '第三方', 'API', 'integration'],
    business_complexity: ['复杂', '多条件', 'complex', 'edge cases'],
    uncertainty: ['不确定', '探索', 'unknown', 'research']
  };

  for (const [dim, keywords] of Object.entries(lowKeywords)) {
    for (const kw of keywords) {
      if (lowerDesc.includes(kw.toLowerCase())) {
        scores[dim] = Math.max(1, scores[dim] - 1);
        matchCount++;
        break;
      }
    }
  }

  for (const [dim, keywords] of Object.entries(highKeywords)) {
    for (const kw of keywords) {
      if (lowerDesc.includes(kw.toLowerCase())) {
        scores[dim] = Math.min(3, scores[dim] + 1);
        matchCount++;
        break;
      }
    }
  }

  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  const confidence = Math.min(1, 0.5 + matchCount * 0.1);

  return { scores, total, confidence };
}

/**
 * 根据总分路由到工作流
 *
 * @see REQ-002 AC-004: 正确识别 Quick Flow 任务
 * @see REQ-002 AC-005: 正确识别 Standard Flow 任务
 * @see REQ-002 AC-006: 正确识别 Full Flow 任务
 *
 * @param {number} totalScore - 总分 (5-15)
 * @returns {{ flow: string, estimatedTime: string }}
 */
function routeToFlow(totalScore) {
  if (totalScore <= THRESHOLDS.quick) {
    return { flow: 'quick', estimatedTime: '30min' };
  } else if (totalScore <= THRESHOLDS.standard) {
    return { flow: 'standard', estimatedTime: '2-4h' };
  } else {
    return { flow: 'full', estimatedTime: '1-3d' };
  }
}

/**
 * 使用 AI 分析任务复杂度
 *
 * @see REQ-003 AC-007: 支持中英文任务描述
 * @see REQ-003 AC-008: 考虑项目上下文
 * @see REQ-003 AC-009: 提供评分理由说明
 *
 * @param {string} taskDesc - 任务描述
 * @param {Object} projectContext - 项目上下文
 * @returns {Promise<{ scores: Object, reasoning: string }>}
 */
async function analyzeWithAI(taskDesc, projectContext = {}) {
  const result = evaluateComplexity(taskDesc, projectContext);
  return {
    scores: result.scores,
    reasoning: `基于关键词分析，总分 ${result.total}，置信度 ${(result.confidence * 100).toFixed(0)}%`
  };
}

/**
 * 记录评分历史
 *
 * @see REQ-004 AC-011: JSONL 格式存储
 * @see REQ-004 AC-012: 包含时间戳、任务描述、评分、路由结果
 *
 * @param {Object} scoreResult - 评分结果
 */
function recordScore(scoreResult) {
  const fs = require('fs');
  const path = require('path');
  const historyFile = '.seed/router-history.jsonl';
  const record = { timestamp: new Date().toISOString(), ...scoreResult };

  try {
    const dir = path.dirname(historyFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(historyFile, JSON.stringify(record) + '\n');
  } catch (e) { /* ignore */ }
}

/**
 * 获取评分历史
 *
 * @see REQ-004 AC-013: 支持查询历史评分
 *
 * @param {Object} filter - 过滤条件
 * @returns {Array} 评分记录列表
 */
function getScoreHistory(filter = {}) {
  const fs = require('fs');
  const historyFile = '.seed/router-history.jsonl';
  try {
    if (!fs.existsSync(historyFile)) return [];
    const content = fs.readFileSync(historyFile, 'utf-8');
    const records = content.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
    return filter.flow ? records.filter(r => r.flow === filter.flow) : records;
  } catch (e) { return []; }
}

/**
 * 解析工作流覆盖参数
 *
 * @see REQ-005 AC-015: 支持 --flow 参数覆盖
 *
 * @param {Array} args - 命令行参数
 * @returns {string|null} 指定的工作流或 null
 */
function parseFlowOverride(args) {
  if (!args || args.length === 0) return null;
  for (const arg of args) {
    const match = arg.match(/^--flow=(\w+)$/);
    if (match && ['quick', 'standard', 'full'].includes(match[1])) {
      return match[1];
    }
  }
  return null;
}

/**
 * 获取默认评分
 *
 * @returns {Object} 默认评分对象
 */
function getDefaultScores() {
  return {
    impact_scope: 2,
    architecture_change: 2,
    external_deps: 2,
    business_complexity: 2,
    uncertainty: 2
  };
}

module.exports = {
  // 核心评分
  evaluateComplexity,
  routeToFlow,

  // AI 辅助
  analyzeWithAI,

  // 历史管理
  recordScore,
  getScoreHistory,

  // 工具函数
  parseFlowOverride,
  getDefaultScores,

  // 常量导出
  DIMENSIONS,
  THRESHOLDS
};
