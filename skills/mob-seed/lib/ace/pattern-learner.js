/**
 * 模式学习器
 * @module ace/pattern-learner
 * @see openspec/changes/v3.0-ace-integration/specs/ace/pattern-learning.fspec.md
 *
 * 实现 REQ-001: 历史数据收集 (AC-001 ~ AC-004)
 * 实现 REQ-004: 历史建议增强 (AC-014 ~ AC-017)
 * 实现 REQ-006: 学习数据管理 (AC-022 ~ AC-025)
 * 实现 REQ-007: 学习统计 (AC-026 ~ AC-029)
 */

const fs = require('fs');
const path = require('path');
const { extractFeaturesFromAll, aggregateFeatures } = require('./feature-extractor');
const { matchHistoricalPatterns, findBestMatch } = require('./similarity-matcher');
const { FeedbackCollector, checkRecurrence, EFFECTIVENESS_OPTIONS } = require('./feedback-collector');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 学习样本 (AC-001)
 * @typedef {Object} LearningSample
 * @property {string} id - 样本 ID
 * @property {string} pattern - 模式类型
 * @property {Object} features - 聚合特征
 * @property {string} lesson - 教训描述
 * @property {string[]} actions - 采取的行动
 * @property {boolean} effective - 是否有效解决问题
 * @property {string | null} outcome - 最终结果
 * @property {string} created - 创建时间
 */

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_LEARNING_DIR = '.seed/learning';
const SAMPLES_FILE = 'samples.json';
const STATS_FILE = 'stats.json';
const DEFAULT_RETENTION_DAYS = 365;

// ============================================================================
// 模式学习器类
// ============================================================================

/**
 * 模式学习器
 */
class PatternLearner {
  /**
   * @param {string} projectRoot - 项目根目录
   */
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.learningDir = path.join(projectRoot, DEFAULT_LEARNING_DIR);
    this.samplesPath = path.join(this.learningDir, SAMPLES_FILE);
    this.statsPath = path.join(this.learningDir, STATS_FILE);
    this.feedbackCollector = new FeedbackCollector(projectRoot);
  }

  // ==========================================================================
  // REQ-001: 历史数据收集 (AC-001 ~ AC-004)
  // ==========================================================================

  /**
   * 加载学习样本
   * @returns {LearningSample[]}
   */
  loadSamples() {
    try {
      if (fs.existsSync(this.samplesPath)) {
        const content = fs.readFileSync(this.samplesPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`加载学习样本失败: ${error.message}`);
    }

    return [];
  }

  /**
   * 保存学习样本
   * @param {LearningSample[]} samples - 样本列表
   */
  saveSamples(samples) {
    if (!fs.existsSync(this.learningDir)) {
      fs.mkdirSync(this.learningDir, { recursive: true });
    }

    fs.writeFileSync(this.samplesPath, JSON.stringify(samples, null, 2), 'utf-8');
  }

  /**
   * 收集学习样本 (AC-002: 反思接受时收集)
   * @param {Object} reflection - 反思对象
   * @param {Object[]} observations - 关联的观察列表
   * @returns {LearningSample}
   */
  collectSample(reflection, observations) {
    // 提取特征
    const featuresList = extractFeaturesFromAll(observations);
    const aggregated = aggregateFeatures(featuresList);

    // 创建样本
    const sample = {
      id: reflection.id || `sample-${Date.now()}`,
      pattern: reflection.pattern || 'general',
      features: aggregated,
      lesson: reflection.lesson || '',
      actions: reflection.suggested_actions || [],
      effective: null,  // 待后续确认
      outcome: null,
      created: new Date().toISOString()
    };

    // 添加到样本库
    const samples = this.loadSamples();
    samples.push(sample);
    this.saveSamples(samples);

    return sample;
  }

  /**
   * 更新样本有效性 (AC-003: 提案归档时更新)
   * @param {string} sampleId - 样本 ID
   * @param {boolean} effective - 是否有效
   * @param {string} [outcome] - 结果描述
   * @returns {boolean}
   */
  updateEffectiveness(sampleId, effective, outcome = null) {
    const samples = this.loadSamples();
    const sample = samples.find(s => s.id === sampleId);

    if (!sample) {
      return false;
    }

    sample.effective = effective;
    sample.outcome = outcome;

    this.saveSamples(samples);
    return true;
  }

  /**
   * 标记问题复发 (AC-004)
   * @param {string} sampleId - 原样本 ID
   * @param {string} newSampleId - 新样本 ID
   * @returns {boolean}
   */
  markRecurrence(sampleId, newSampleId) {
    const samples = this.loadSamples();
    const sample = samples.find(s => s.id === sampleId);

    if (!sample) {
      return false;
    }

    sample.effective = false;
    sample.outcome = `问题复发，新样本: ${newSampleId}`;

    this.saveSamples(samples);

    // 同步更新反馈记录
    this.feedbackCollector.markRecurrence(sampleId, newSampleId);

    return true;
  }

  // ==========================================================================
  // REQ-004: 历史建议增强 (AC-014 ~ AC-017)
  // ==========================================================================

  /**
   * 增强候选反思 (AC-014 ~ AC-017)
   * @param {Object} candidate - 反思候选
   * @param {Object[]} observations - 观察列表
   * @param {Object} [config] - 配置
   * @returns {Object}
   */
  enhanceWithHistory(candidate, observations, config = {}) {
    const samples = this.loadSamples();

    // 只使用有效样本
    const effectiveSamples = samples.filter(s => s.effective !== false);

    if (effectiveSamples.length === 0) {
      return candidate;
    }

    // 匹配历史模式
    const matches = matchHistoricalPatterns(observations, effectiveSamples, config);

    if (matches.length === 0) {
      return candidate;
    }

    const bestMatch = matches[0];

    // AC-014: 附加历史参考
    // AC-015: 显示历史案例详情
    // AC-016: 调整置信度
    // AC-017: 显示有效性
    return {
      ...candidate,
      historical: {
        reference: bestMatch.sample.id,
        similarity: bestMatch.similarity,
        previousLesson: bestMatch.sample.lesson,
        previousActions: bestMatch.sample.actions,
        wasEffective: bestMatch.sample.effective,
        date: bestMatch.sample.created
      },
      confidence: this.adjustConfidence(
        candidate.confidence || 0.5,
        bestMatch.similarity,
        bestMatch.sample.effective
      )
    };
  }

  /**
   * 调整置信度
   * @param {number} base - 基础置信度
   * @param {number} similarity - 相似度
   * @param {boolean} wasEffective - 历史是否有效
   * @returns {number}
   */
  adjustConfidence(base, similarity, wasEffective) {
    if (wasEffective) {
      // 历史有效，提升置信度
      return Math.min(1.0, base + similarity * 0.1);
    } else if (wasEffective === false) {
      // 历史无效，降低置信度
      return Math.max(0.3, base - similarity * 0.1);
    }

    // 未知有效性，保持原置信度
    return base;
  }

  /**
   * 批量增强候选列表
   * @param {Object[]} candidates - 候选列表
   * @param {Map<string, Object[]>} observationsMap - 观察映射
   * @returns {Object[]}
   */
  batchEnhance(candidates, observationsMap) {
    return candidates.map(candidate => {
      const observations = observationsMap.get(candidate.id) || [];
      return this.enhanceWithHistory(candidate, observations);
    });
  }

  // ==========================================================================
  // REQ-006: 学习数据管理 (AC-022 ~ AC-025)
  // ==========================================================================

  /**
   * 脱敏样本 (AC-023)
   * @param {LearningSample} sample - 原始样本
   * @returns {LearningSample}
   */
  sanitizeSample(sample) {
    return {
      id: sample.id,
      pattern: sample.pattern,
      features: {
        types: sample.features?.types || [],
        modules: sample.features?.modules?.map(m => m.split('/')[0]) || [],  // 只保留顶级目录
        errorTypes: sample.features?.errorTypes || [],
        keywords: sample.features?.keywords?.slice(0, 5) || [],  // 限制关键词数量
        timeClusters: [],  // 移除时间信息
        specs: sample.features?.specs || []
      },
      lesson: this.generalizeLesson(sample.lesson),
      actions: sample.actions?.map(a => this.generalizeAction(a)) || [],
      effective: sample.effective,
      outcome: null,  // 移除详细结果
      created: sample.created?.split('T')[0] || null  // 只保留日期
    };
  }

  /**
   * 泛化教训描述
   * @param {string} lesson - 教训
   * @returns {string}
   */
  generalizeLesson(lesson) {
    if (!lesson) return '';

    // 移除具体文件名
    let generalized = lesson.replace(/\b[\w-]+\.(js|ts|json|md)\b/gi, '[file]');

    // 移除具体函数/变量名
    generalized = generalized.replace(/`[^`]+`/g, '[code]');

    // 移除具体数字
    generalized = generalized.replace(/\b\d{4,}\b/g, '[number]');

    return generalized;
  }

  /**
   * 泛化行动描述
   * @param {string} action - 行动
   * @returns {string}
   */
  generalizeAction(action) {
    if (!action) return '';

    // 移除具体路径
    let generalized = action.replace(/\/[\w\/.-]+/g, '[path]');

    // 移除具体名称
    generalized = generalized.replace(/`[^`]+`/g, '[name]');

    return generalized;
  }

  /**
   * 清理过期数据 (AC-024, AC-025)
   * @param {number} [retentionDays] - 保留天数
   * @returns {{removed: number, kept: number}}
   */
  cleanupOldData(retentionDays = DEFAULT_RETENTION_DAYS) {
    const samples = this.loadSamples();
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const keptSamples = samples.filter(s => {
      const createdTime = new Date(s.created).getTime();

      // AC-025: 保留有效样本不过期
      if (s.effective === true) {
        return true;
      }

      // 保留未过期的样本
      return createdTime > cutoff;
    });

    this.saveSamples(keptSamples);

    return {
      removed: samples.length - keptSamples.length,
      kept: keptSamples.length
    };
  }

  /**
   * 导出学习数据（用于备份或迁移）
   * @param {boolean} [sanitize] - 是否脱敏
   * @returns {Object}
   */
  exportData(sanitize = false) {
    const samples = this.loadSamples();
    const feedback = this.feedbackCollector.load();

    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      samples: sanitize ? samples.map(s => this.sanitizeSample(s)) : samples,
      feedback: sanitize ? {} : feedback,
      stats: this.getStats()
    };
  }

  /**
   * 导入学习数据
   * @param {Object} data - 导入数据
   * @returns {{samples: number, feedback: number}}
   */
  importData(data) {
    if (!data || !data.samples) {
      return { samples: 0, feedback: 0 };
    }

    // 合并样本（去重）
    const existing = this.loadSamples();
    const existingIds = new Set(existing.map(s => s.id));

    const newSamples = data.samples.filter(s => !existingIds.has(s.id));
    const merged = [...existing, ...newSamples];

    this.saveSamples(merged);

    // 合并反馈
    let feedbackCount = 0;
    if (data.feedback) {
      const existingFeedback = this.feedbackCollector.load();
      const mergedFeedback = { ...existingFeedback, ...data.feedback };
      this.feedbackCollector.save(mergedFeedback);
      feedbackCount = Object.keys(data.feedback).length;
    }

    return {
      samples: newSamples.length,
      feedback: feedbackCount
    };
  }

  // ==========================================================================
  // REQ-007: 学习统计 (AC-026 ~ AC-029)
  // ==========================================================================

  /**
   * 获取学习统计 (AC-026 ~ AC-029)
   * @returns {Object}
   */
  getStats() {
    const samples = this.loadSamples();
    const feedbackStats = this.feedbackCollector.getStats();

    // AC-026: 样本数量和有效率
    const total = samples.length;
    const effective = samples.filter(s => s.effective === true).length;
    const effectivenessRate = total > 0 ? effective / total : 0;

    // AC-027: 最常见模式
    const patternCounts = {};
    for (const s of samples) {
      patternCounts[s.pattern] = (patternCounts[s.pattern] || 0) + 1;
    }
    const topPatterns = Object.entries(patternCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, count }));

    // AC-028: 最有效策略
    const strategyCounts = {};
    const strategySuccess = {};

    for (const s of samples) {
      for (const action of s.actions || []) {
        const strategy = this.extractStrategy(action);
        strategyCounts[strategy] = (strategyCounts[strategy] || 0) + 1;

        if (s.effective === true) {
          strategySuccess[strategy] = (strategySuccess[strategy] || 0) + 1;
        }
      }
    }

    const topStrategies = Object.entries(strategyCounts)
      .filter(([, count]) => count >= 2)  // 至少出现 2 次
      .map(([strategy, count]) => ({
        strategy,
        count,
        successRate: strategySuccess[strategy] ? strategySuccess[strategy] / count : 0
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    // AC-029: 问题复发率
    const recurrenceRate = feedbackStats.recurrenceRate;

    return {
      totalSamples: total,
      effectiveSamples: effective,
      effectivenessRate,
      topPatterns,
      topStrategies,
      recurrenceRate,
      feedback: feedbackStats
    };
  }

  /**
   * 提取策略类型
   * @param {string} action - 行动描述
   * @returns {string}
   */
  extractStrategy(action) {
    if (!action) return 'other';

    const actionLower = action.toLowerCase();

    if (actionLower.includes('规范') || actionLower.includes('规格') || actionLower.includes('spec')) {
      return '创建规范/规格';
    }

    if (actionLower.includes('工具') || actionLower.includes('函数') || actionLower.includes('utility')) {
      return '添加工具函数';
    }

    if (actionLower.includes('测试') || actionLower.includes('test')) {
      return '增加测试覆盖';
    }

    if (actionLower.includes('重构') || actionLower.includes('refactor')) {
      return '重构代码';
    }

    if (actionLower.includes('文档') || actionLower.includes('doc')) {
      return '更新文档';
    }

    if (actionLower.includes('配置') || actionLower.includes('config')) {
      return '调整配置';
    }

    return 'other';
  }

  /**
   * 格式化统计输出
   * @param {Object} stats - 统计数据
   * @returns {string}
   */
  formatStats(stats) {
    const lines = [
      '📊 学习统计',
      '',
      `样本总数: ${stats.totalSamples}`,
      `有效样本: ${stats.effectiveSamples} (${(stats.effectivenessRate * 100).toFixed(1)}%)`,
      ''
    ];

    if (stats.topPatterns.length > 0) {
      lines.push('最常见模式:');
      stats.topPatterns.forEach((p, i) => {
        lines.push(`  ${i + 1}. ${p.pattern} (${p.count} 次)`);
      });
      lines.push('');
    }

    if (stats.topStrategies.length > 0) {
      lines.push('最有效策略:');
      stats.topStrategies.forEach((s, i) => {
        lines.push(`  ${i + 1}. ${s.strategy} → ${(s.successRate * 100).toFixed(0)}% 有效`);
      });
      lines.push('');
    }

    lines.push(`问题复发率: ${(stats.recurrenceRate * 100).toFixed(1)}%`);

    return lines.join('\n');
  }
}

// ============================================================================
// 格式化函数
// ============================================================================

/**
 * 格式化历史参考显示
 * @param {Object} historical - 历史参考
 * @returns {string}
 */
function formatHistoricalReference(historical) {
  if (!historical) {
    return '';
  }

  const effectiveIcon = historical.wasEffective ? '✅' : '❌';
  const similarity = (historical.similarity * 100).toFixed(0);

  const lines = [
    `📚 历史参考 (相似度 ${similarity}%):`,
    '┌─────────────────────────────────────────┐',
    `│ 历史案例 ${historical.reference}`,
    `│ 创建时间: ${historical.date?.split('T')[0] || 'N/A'}`,
    '│',
    '│ 当时教训:',
    `│   "${historical.previousLesson?.slice(0, 40) || 'N/A'}"`,
    '│',
    '│ 采取行动:'
  ];

  for (const action of (historical.previousActions || []).slice(0, 3)) {
    lines.push(`│   ${effectiveIcon} ${action.slice(0, 35)}`);
  }

  lines.push('│');
  lines.push(`│ 结果: ${historical.wasEffective ? '有效' : '无效'}`);
  lines.push('└─────────────────────────────────────────┘');

  return lines.join('\n');
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  PatternLearner,

  // 格式化
  formatHistoricalReference,

  // 常量
  DEFAULT_LEARNING_DIR,
  SAMPLES_FILE,
  STATS_FILE,
  DEFAULT_RETENTION_DAYS
};
