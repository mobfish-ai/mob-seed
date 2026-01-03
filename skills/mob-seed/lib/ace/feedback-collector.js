/**
 * 反馈收集器
 * @module ace/feedback-collector
 * @see openspec/changes/v3.0-ace-integration/specs/ace/pattern-learning.fspec.md
 *
 * 实现 REQ-005: 反馈闭环 (AC-018 ~ AC-021)
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 效果反馈
 * @typedef {Object} EffectivenessFeedback
 * @property {string} proposal - 提案名称
 * @property {string} reflection_id - 反思 ID
 * @property {string} archived_at - 归档时间
 * @property {string | null} feedback_at - 反馈时间
 * @property {'fully_resolved' | 'partially_resolved' | 'not_resolved' | 'pending'} effectiveness - 有效性
 * @property {string | null} notes - 备注
 */

/**
 * 复发检测结果
 * @typedef {Object} RecurrenceResult
 * @property {boolean} recurrence - 是否复发
 * @property {string | null} originalReflection - 原始反思 ID
 * @property {number} similarity - 相似度
 */

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_FEEDBACK_PATH = '.seed/learning/feedback.json';

const EFFECTIVENESS_OPTIONS = {
  FULLY_RESOLVED: 'fully_resolved',
  PARTIALLY_RESOLVED: 'partially_resolved',
  NOT_RESOLVED: 'not_resolved',
  PENDING: 'pending'
};

// ============================================================================
// 反馈收集器类
// ============================================================================

/**
 * 反馈收集器
 */
class FeedbackCollector {
  /**
   * @param {string} projectRoot - 项目根目录
   */
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.feedbackPath = path.join(projectRoot, DEFAULT_FEEDBACK_PATH);
  }

  /**
   * 加载反馈记录
   * @returns {Object}
   */
  load() {
    try {
      if (fs.existsSync(this.feedbackPath)) {
        const content = fs.readFileSync(this.feedbackPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`加载反馈记录失败: ${error.message}`);
    }

    return {};
  }

  /**
   * 保存反馈记录
   * @param {Object} feedback - 反馈记录
   */
  save(feedback) {
    const dir = path.dirname(this.feedbackPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.feedbackPath, JSON.stringify(feedback, null, 2), 'utf-8');
  }

  /**
   * 创建待反馈记录 (AC-018)
   * @param {string} reflectionId - 反思 ID
   * @param {string} proposalName - 提案名称
   * @returns {EffectivenessFeedback}
   */
  createPendingFeedback(reflectionId, proposalName) {
    const feedback = this.load();

    const record = {
      proposal: proposalName,
      reflection_id: reflectionId,
      archived_at: new Date().toISOString(),
      feedback_at: null,
      effectiveness: EFFECTIVENESS_OPTIONS.PENDING,
      notes: null
    };

    feedback[reflectionId] = record;
    this.save(feedback);

    return record;
  }

  /**
   * 提交效果反馈 (AC-019)
   * @param {string} reflectionId - 反思 ID
   * @param {string} effectiveness - 有效性评估
   * @param {string} [notes] - 备注
   * @returns {EffectivenessFeedback | null}
   */
  submitFeedback(reflectionId, effectiveness, notes = null) {
    const feedback = this.load();

    if (!feedback[reflectionId]) {
      return null;
    }

    feedback[reflectionId].feedback_at = new Date().toISOString();
    feedback[reflectionId].effectiveness = effectiveness;
    feedback[reflectionId].notes = notes;

    this.save(feedback);

    return feedback[reflectionId];
  }

  /**
   * 获取反馈记录
   * @param {string} reflectionId - 反思 ID
   * @returns {EffectivenessFeedback | null}
   */
  getFeedback(reflectionId) {
    const feedback = this.load();
    return feedback[reflectionId] || null;
  }

  /**
   * 获取待反馈列表
   * @returns {EffectivenessFeedback[]}
   */
  getPendingFeedback() {
    const feedback = this.load();

    return Object.values(feedback).filter(
      f => f.effectiveness === EFFECTIVENESS_OPTIONS.PENDING
    );
  }

  /**
   * 获取所有已解决的模式 (AC-020)
   * @returns {EffectivenessFeedback[]}
   */
  getResolvedPatterns() {
    const feedback = this.load();

    return Object.values(feedback).filter(
      f => f.effectiveness === EFFECTIVENESS_OPTIONS.FULLY_RESOLVED
    );
  }

  /**
   * 标记问题复发 (AC-021)
   * @param {string} reflectionId - 原始反思 ID
   * @param {string} newReflectionId - 新反思 ID
   * @returns {boolean}
   */
  markRecurrence(reflectionId, newReflectionId) {
    const feedback = this.load();

    if (!feedback[reflectionId]) {
      return false;
    }

    // 更新原始记录
    feedback[reflectionId].effectiveness = EFFECTIVENESS_OPTIONS.NOT_RESOLVED;
    feedback[reflectionId].notes = (feedback[reflectionId].notes || '') +
      `\n[复发] 在 ${new Date().toISOString()} 检测到复发，新反思: ${newReflectionId}`;

    this.save(feedback);

    return true;
  }

  /**
   * 获取效果统计
   * @returns {Object}
   */
  getStats() {
    const feedback = this.load();
    const records = Object.values(feedback);

    const total = records.length;
    const resolved = records.filter(r => r.effectiveness === EFFECTIVENESS_OPTIONS.FULLY_RESOLVED).length;
    const partial = records.filter(r => r.effectiveness === EFFECTIVENESS_OPTIONS.PARTIALLY_RESOLVED).length;
    const notResolved = records.filter(r => r.effectiveness === EFFECTIVENESS_OPTIONS.NOT_RESOLVED).length;
    const pending = records.filter(r => r.effectiveness === EFFECTIVENESS_OPTIONS.PENDING).length;

    return {
      total,
      resolved,
      partial,
      notResolved,
      pending,
      resolutionRate: total > 0 ? (resolved / total) : 0,
      recurrenceRate: total > 0 ? (notResolved / total) : 0
    };
  }
}

// ============================================================================
// 复发检测
// ============================================================================

/**
 * 检查是否为问题复发 (AC-020)
 * @param {Object} reflection - 新反思
 * @param {Object[]} resolvedPatterns - 已解决的模式列表
 * @param {function} matchFn - 匹配函数
 * @returns {RecurrenceResult}
 */
function checkRecurrence(reflection, resolvedPatterns, matchFn) {
  if (!reflection || !Array.isArray(resolvedPatterns) || resolvedPatterns.length === 0) {
    return { recurrence: false, originalReflection: null, similarity: 0 };
  }

  for (const pattern of resolvedPatterns) {
    const similarity = matchFn ? matchFn(reflection, pattern) : simpleSimilarity(reflection, pattern);

    if (similarity > 0.7) {
      return {
        recurrence: true,
        originalReflection: pattern.reflection_id,
        similarity
      };
    }
  }

  return { recurrence: false, originalReflection: null, similarity: 0 };
}

/**
 * 简单相似度计算（用于复发检测）
 * @param {Object} a - 反思 A
 * @param {Object} b - 反思 B
 * @returns {number}
 */
function simpleSimilarity(a, b) {
  let weightedScore = 0;
  let totalWeight = 0;

  // 模式匹配（权重 0.7 - 模式完全匹配是强信号）
  const patternWeight = 0.7;
  if (a.pattern && b.pattern) {
    weightedScore += patternWeight * (a.pattern === b.pattern ? 1 : 0);
    totalWeight += patternWeight;
  }

  // 教训关键词重叠（权重 0.3）
  const keywordWeight = 0.3;
  if (a.lesson && b.lesson) {
    const kwA = extractSimpleKeywords(a.lesson);
    const kwB = extractSimpleKeywords(b.lesson);
    const overlap = kwA.filter(k => kwB.includes(k)).length;
    const union = new Set([...kwA, ...kwB]).size;
    const keywordScore = union > 0 ? overlap / union : 0;
    weightedScore += keywordWeight * keywordScore;
    totalWeight += keywordWeight;
  }

  return totalWeight > 0 ? weightedScore / totalWeight : 0;
}

/**
 * 简单关键词提取
 * @param {string} text - 文本
 * @returns {string[]}
 */
function extractSimpleKeywords(text) {
  if (!text) return [];

  return text
    .toLowerCase()
    .split(/[\s\W]+/)
    .filter(w => w.length > 2);
}

// ============================================================================
// 反馈提示生成
// ============================================================================

/**
 * 生成反馈请求提示
 * @param {string} proposalName - 提案名称
 * @returns {string}
 */
function generateFeedbackPrompt(proposalName) {
  return `
📊 效果反馈: ${proposalName}

该提案已归档，请评估效果:

问题是否已解决?
  [1] 完全解决 - 无后续同类问题
  [2] 部分解决 - 问题减少但未消除
  [3] 未解决 - 问题仍然存在
  [4] 跳过评估

选择 (1-4): `;
}

/**
 * 解析反馈选择
 * @param {string | number} choice - 用户选择
 * @returns {string}
 */
function parseFeedbackChoice(choice) {
  const c = String(choice).trim();

  switch (c) {
    case '1':
      return EFFECTIVENESS_OPTIONS.FULLY_RESOLVED;
    case '2':
      return EFFECTIVENESS_OPTIONS.PARTIALLY_RESOLVED;
    case '3':
      return EFFECTIVENESS_OPTIONS.NOT_RESOLVED;
    case '4':
    default:
      return EFFECTIVENESS_OPTIONS.PENDING;
  }
}

/**
 * 格式化反馈统计
 * @param {Object} stats - 统计数据
 * @returns {string}
 */
function formatFeedbackStats(stats) {
  const lines = [
    '📊 反馈统计',
    '',
    `总记录数: ${stats.total}`,
    `├── 完全解决: ${stats.resolved} (${(stats.resolutionRate * 100).toFixed(1)}%)`,
    `├── 部分解决: ${stats.partial}`,
    `├── 未解决: ${stats.notResolved}`,
    `└── 待反馈: ${stats.pending}`,
    '',
    `问题复发率: ${(stats.recurrenceRate * 100).toFixed(1)}%`
  ];

  return lines.join('\n');
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  FeedbackCollector,

  // 复发检测
  checkRecurrence,
  simpleSimilarity,
  extractSimpleKeywords,

  // 提示生成
  generateFeedbackPrompt,
  parseFeedbackChoice,
  formatFeedbackStats,

  // 常量
  EFFECTIVENESS_OPTIONS,
  DEFAULT_FEEDBACK_PATH
};
