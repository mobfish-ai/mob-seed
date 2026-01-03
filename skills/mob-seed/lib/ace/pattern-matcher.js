/**
 * 规则匹配式反思
 * @module ace/pattern-matcher
 * @see openspec/changes/v3.0-ace-integration/specs/ace/pattern-matcher.fspec.md
 *
 * 从多个观察中自动识别共性模式，生成反思建议
 */

const fs = require('fs');
const path = require('path');
const { PATTERN_TYPES } = require('./reflection');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 反思建议
 * @typedef {Object} ReflectionCandidate
 * @property {string} pattern - 模式类型
 * @property {string[]} observations - 匹配的观察ID
 * @property {number} confidence - 置信度 (0-1)
 * @property {string} suggestedLesson - 建议的教训描述
 * @property {string[]} suggestedActions - 建议的行动
 * @property {Object} [metadata] - 额外元数据
 */

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  thresholds: {
    same_type: 3,
    same_spec: 2,
    time_window_hours: 24,
    keyword_similarity: 0.7
  }
};

// ============================================================================
// 类型聚合模式 (REQ-001)
// ============================================================================

/**
 * 类型聚合模式匹配 (AC-001, AC-002, AC-003, AC-004)
 * @param {Object[]} observations - 观察列表
 * @param {number} [threshold=3] - 阈值
 * @returns {ReflectionCandidate[]} 匹配结果
 */
function matchTypeAggregation(observations, threshold = 3) {
  // AC-002: 只处理 triaged 状态的观察
  const triaged = observations.filter(obs => obs.status === 'triaged');

  // 按 type 分组
  const groups = {};
  for (const obs of triaged) {
    if (!obs.type) continue;
    if (!groups[obs.type]) {
      groups[obs.type] = [];
    }
    groups[obs.type].push(obs);
  }

  // AC-003, AC-004: 找出数量 >= threshold 的分组
  const candidates = [];
  for (const [type, group] of Object.entries(groups)) {
    if (group.length >= threshold) {
      const obsIds = group.map(o => o.id);
      const confidence = Math.min(1, group.length / (threshold * 2));

      candidates.push({
        pattern: PATTERN_TYPES.TYPE_AGGREGATION,
        observations: obsIds,
        confidence,
        suggestedLesson: `${group.length} 个 ${type} 类型观察，可能需要统一处理策略`,
        suggestedActions: [
          `分析 ${type} 类型问题的共性`,
          '考虑在 mission.md 中添加相关处理原则',
          '创建专门的规格处理这类问题'
        ],
        metadata: { type, count: group.length }
      });
    }
  }

  return candidates;
}

// ============================================================================
// 规格聚合模式 (REQ-002)
// ============================================================================

/**
 * 规格聚合模式匹配 (AC-005, AC-006, AC-007, AC-008)
 * @param {Object[]} observations - 观察列表
 * @param {number} [threshold=2] - 阈值
 * @returns {ReflectionCandidate[]} 匹配结果
 */
function matchSpecAggregation(observations, threshold = 2) {
  // AC-006: 按 related_spec 字段分组
  const groups = {};
  for (const obs of observations) {
    const spec = obs.spec || obs.related_spec || obs.context?.file;
    if (!spec) continue;
    if (!groups[spec]) {
      groups[spec] = [];
    }
    groups[spec].push(obs);
  }

  // AC-007, AC-008: 找出数量 >= threshold 的分组
  const candidates = [];
  for (const [spec, group] of Object.entries(groups)) {
    if (group.length >= threshold) {
      const obsIds = group.map(o => o.id);
      const confidence = Math.min(1, group.length / (threshold * 2.5));

      candidates.push({
        pattern: PATTERN_TYPES.SPEC_AGGREGATION,
        observations: obsIds,
        confidence,
        suggestedLesson: `规格 ${path.basename(spec)} 相关的 ${group.length} 个问题，考虑修订规格`,
        suggestedActions: [
          `审查规格文件: ${spec}`,
          '检查规格是否覆盖了边界条件',
          '考虑补充验收标准'
        ],
        metadata: { spec, count: group.length }
      });
    }
  }

  return candidates;
}

// ============================================================================
// 时间窗口聚合模式 (REQ-003)
// ============================================================================

/**
 * 时间窗口聚合模式匹配 (AC-009, AC-010, AC-011, AC-012)
 * @param {Object[]} observations - 观察列表
 * @param {number} [windowHours=24] - 时间窗口（小时）
 * @param {number} [threshold=2] - 阈值
 * @returns {ReflectionCandidate[]} 匹配结果
 */
function matchTimeClustering(observations, windowHours = 24, threshold = 2) {
  // AC-010: 按模块/文件分组
  const groups = {};
  for (const obs of observations) {
    const module = obs.context?.file || obs.spec || obs.related_spec || 'unknown';
    if (!groups[module]) {
      groups[module] = [];
    }
    groups[module].push(obs);
  }

  const candidates = [];
  const windowMs = windowHours * 60 * 60 * 1000;

  // AC-011, AC-012: 在每个分组内按时间窗口聚合
  for (const [module, group] of Object.entries(groups)) {
    if (group.length < threshold) continue;

    // 按时间排序
    const sorted = group.sort((a, b) =>
      new Date(a.created).getTime() - new Date(b.created).getTime()
    );

    // 滑动窗口查找聚类
    for (let i = 0; i < sorted.length; i++) {
      const windowStart = new Date(sorted[i].created).getTime();
      const windowEnd = windowStart + windowMs;

      const inWindow = sorted.filter(obs => {
        const time = new Date(obs.created).getTime();
        return time >= windowStart && time <= windowEnd;
      });

      if (inWindow.length >= threshold) {
        const obsIds = inWindow.map(o => o.id);
        const confidence = Math.min(1, inWindow.length / (threshold * 2));

        // 避免重复（检查是否已有相同观察集）
        const key = obsIds.sort().join(',');
        const exists = candidates.some(c =>
          c.pattern === PATTERN_TYPES.TIME_CLUSTERING &&
          c.observations.sort().join(',') === key
        );

        if (!exists) {
          candidates.push({
            pattern: PATTERN_TYPES.TIME_CLUSTERING,
            observations: obsIds,
            confidence,
            suggestedLesson: `${path.basename(module)} 模块在短时间内出现 ${inWindow.length} 个问题`,
            suggestedActions: [
              `审查模块: ${module}`,
              '检查最近的变更是否引入问题',
              '考虑增加测试覆盖'
            ],
            metadata: { module, count: inWindow.length, windowHours }
          });
        }
      }
    }
  }

  return candidates;
}

// ============================================================================
// 关键词相似度模式 (REQ-004)
// ============================================================================

/**
 * 计算 Jaccard 相似度 (AC-014)
 * @param {string} text1 - 文本1
 * @param {string} text2 - 文本2
 * @returns {number} 相似度 (0-1)
 */
function jaccardSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;

  // 分词（支持中英文）
  const tokenize = (text) => {
    return text
      .toLowerCase()
      .split(/[\s,.\-_:;!?()[\]{}'"]+/)
      .filter(t => t.length > 1);
  };

  const set1 = new Set(tokenize(text1));
  const set2 = new Set(tokenize(text2));

  if (set1.size === 0 || set2.size === 0) return 0;

  // 计算交集和并集
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * 关键词相似度模式匹配 (AC-013, AC-014, AC-015, AC-016)
 * @param {Object[]} observations - 观察列表
 * @param {number} [threshold=0.7] - 相似度阈值
 * @returns {ReflectionCandidate[]} 匹配结果
 */
function matchKeywordSimilarity(observations, threshold = 0.7) {
  if (observations.length < 2) return [];

  // 构建相似度矩阵并聚类
  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < observations.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = [observations[i]];
    assigned.add(i);

    const text1 = observations[i].description || observations[i].context?.error || '';

    for (let j = i + 1; j < observations.length; j++) {
      if (assigned.has(j)) continue;

      const text2 = observations[j].description || observations[j].context?.error || '';
      const similarity = jaccardSimilarity(text1, text2);

      if (similarity >= threshold) {
        cluster.push(observations[j]);
        assigned.add(j);
      }
    }

    if (cluster.length >= 2) {
      clusters.push(cluster);
    }
  }

  // AC-016: 返回相似观察的聚类
  return clusters.map(cluster => {
    const obsIds = cluster.map(o => o.id);

    // 提取共同关键词
    const allTokens = cluster.flatMap(o => {
      const text = o.description || o.context?.error || '';
      return text.toLowerCase().split(/[\s,.\-_:;!?()[\]{}'"]+/).filter(t => t.length > 1);
    });

    const tokenCounts = {};
    allTokens.forEach(t => {
      tokenCounts[t] = (tokenCounts[t] || 0) + 1;
    });

    const keywords = Object.entries(tokenCounts)
      .filter(([, count]) => count >= cluster.length * 0.5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    const confidence = Math.min(1, cluster.length / 4);

    return {
      pattern: PATTERN_TYPES.KEYWORD_SIMILARITY,
      observations: obsIds,
      confidence,
      suggestedLesson: `多个观察包含相似描述: ${keywords.join(', ')}`,
      suggestedActions: [
        '分析这些问题的共同根因',
        '考虑创建通用解决方案',
        '更新相关文档或规范'
      ],
      metadata: { keywords, count: cluster.length }
    };
  });
}

// ============================================================================
// 组合模式匹配 (REQ-005)
// ============================================================================

/**
 * 模式匹配器类 (AC-017)
 */
class PatternMatcher {
  /**
   * @param {Object} [config] - 配置
   */
  constructor(config = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      thresholds: {
        ...DEFAULT_CONFIG.thresholds,
        ...config.thresholds
      }
    };
  }

  /**
   * 执行所有模式匹配 (AC-018)
   * @param {Object[]} observations - 观察列表
   * @returns {ReflectionCandidate[]} 所有匹配结果
   */
  runAllPatterns(observations) {
    const candidates = [];
    const { thresholds } = this.config;

    // 1. 类型聚合
    candidates.push(...matchTypeAggregation(observations, thresholds.same_type));

    // 2. 规格聚合
    candidates.push(...matchSpecAggregation(observations, thresholds.same_spec));

    // 3. 时间窗口
    candidates.push(...matchTimeClustering(
      observations,
      thresholds.time_window_hours,
      thresholds.same_spec
    ));

    // 4. 关键词相似
    candidates.push(...matchKeywordSimilarity(observations, thresholds.keyword_similarity));

    // AC-019: 去除重复的匹配结果
    const deduplicated = this.deduplicateCandidates(candidates);

    // AC-020: 按置信度排序
    return deduplicated.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 去重候选 (AC-019)
   * @param {ReflectionCandidate[]} candidates - 候选列表
   * @returns {ReflectionCandidate[]} 去重后的列表
   */
  deduplicateCandidates(candidates) {
    const seen = new Map();

    for (const candidate of candidates) {
      const key = candidate.observations.slice().sort().join(',');

      if (!seen.has(key) || seen.get(key).confidence < candidate.confidence) {
        seen.set(key, candidate);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * 只运行指定模式
   * @param {Object[]} observations - 观察列表
   * @param {string[]} patterns - 模式类型列表
   * @returns {ReflectionCandidate[]} 匹配结果
   */
  runPatterns(observations, patterns) {
    const candidates = [];
    const { thresholds } = this.config;

    if (patterns.includes(PATTERN_TYPES.TYPE_AGGREGATION)) {
      candidates.push(...matchTypeAggregation(observations, thresholds.same_type));
    }

    if (patterns.includes(PATTERN_TYPES.SPEC_AGGREGATION)) {
      candidates.push(...matchSpecAggregation(observations, thresholds.same_spec));
    }

    if (patterns.includes(PATTERN_TYPES.TIME_CLUSTERING)) {
      candidates.push(...matchTimeClustering(
        observations,
        thresholds.time_window_hours,
        thresholds.same_spec
      ));
    }

    if (patterns.includes(PATTERN_TYPES.KEYWORD_SIMILARITY)) {
      candidates.push(...matchKeywordSimilarity(observations, thresholds.keyword_similarity));
    }

    const deduplicated = this.deduplicateCandidates(candidates);
    return deduplicated.sort((a, b) => b.confidence - a.confidence);
  }
}

// ============================================================================
// 反思建议生成 (REQ-006)
// ============================================================================

/**
 * 教训模板
 */
const LESSON_TEMPLATES = {
  [PATTERN_TYPES.TYPE_AGGREGATION]: (meta) =>
    `${meta.count} 个 ${meta.type} 类型观察，可能需要统一处理策略`,

  [PATTERN_TYPES.SPEC_AGGREGATION]: (meta) =>
    `规格 ${path.basename(meta.spec)} 相关的 ${meta.count} 个问题，考虑修订规格`,

  [PATTERN_TYPES.TIME_CLUSTERING]: (meta) =>
    `${path.basename(meta.module)} 模块在短时间内出现 ${meta.count} 个问题`,

  [PATTERN_TYPES.KEYWORD_SIMILARITY]: (meta) =>
    `多个观察包含相似描述: ${meta.keywords.join(', ')}`
};

/**
 * 生成反思建议 (AC-021, AC-022, AC-023, AC-024)
 * @param {string} pattern - 模式类型
 * @param {string[]} observationIds - 观察ID列表
 * @param {Object} metadata - 元数据
 * @returns {ReflectionCandidate} 反思建议
 */
function generateCandidate(pattern, observationIds, metadata) {
  const lessonTemplate = LESSON_TEMPLATES[pattern];
  const suggestedLesson = lessonTemplate ? lessonTemplate(metadata) : '发现模式匹配';

  // AC-024: 置信度基于观察数量
  const confidence = Math.min(1, observationIds.length / 5);

  // AC-023: 生成建议行动
  const suggestedActions = [];

  switch (pattern) {
    case PATTERN_TYPES.TYPE_AGGREGATION:
      suggestedActions.push(
        `分析 ${metadata.type} 类型问题的共性`,
        '考虑在 mission.md 中添加相关处理原则',
        '创建专门的规格处理这类问题'
      );
      break;

    case PATTERN_TYPES.SPEC_AGGREGATION:
      suggestedActions.push(
        `审查规格文件: ${metadata.spec}`,
        '检查规格是否覆盖了边界条件',
        '考虑补充验收标准'
      );
      break;

    case PATTERN_TYPES.TIME_CLUSTERING:
      suggestedActions.push(
        `审查模块: ${metadata.module}`,
        '检查最近的变更是否引入问题',
        '考虑增加测试覆盖'
      );
      break;

    case PATTERN_TYPES.KEYWORD_SIMILARITY:
      suggestedActions.push(
        '分析这些问题的共同根因',
        '考虑创建通用解决方案',
        '更新相关文档或规范'
      );
      break;

    default:
      suggestedActions.push('分析模式并采取相应行动');
  }

  return {
    pattern,
    observations: observationIds,
    confidence,
    suggestedLesson,
    suggestedActions,
    metadata
  };
}

// ============================================================================
// 配置加载 (REQ-007)
// ============================================================================

/**
 * 从配置文件加载阈值 (AC-025, AC-026)
 * @param {string} projectRoot - 项目根目录
 * @returns {Object} 配置对象
 */
function loadConfig(projectRoot) {
  const configPath = path.join(projectRoot, '.seed', 'config.json');

  let userConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      userConfig = config.ace?.reflect || {};
    } catch (e) {
      // 配置解析失败，使用默认值
    }
  }

  // AC-026: 配置缺失时使用默认值
  return {
    ...DEFAULT_CONFIG,
    thresholds: {
      ...DEFAULT_CONFIG.thresholds,
      ...userConfig.thresholds
    },
    ...userConfig
  };
}

/**
 * 创建配置化的匹配器 (AC-027)
 * @param {string} projectRoot - 项目根目录
 * @param {Object} [overrides] - 运行时覆盖
 * @returns {PatternMatcher} 匹配器实例
 */
function createMatcher(projectRoot, overrides = {}) {
  const config = loadConfig(projectRoot);

  return new PatternMatcher({
    ...config,
    thresholds: {
      ...config.thresholds,
      ...overrides.thresholds
    },
    ...overrides
  });
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 单独匹配器
  matchTypeAggregation,
  matchSpecAggregation,
  matchTimeClustering,
  matchKeywordSimilarity,

  // 工具函数
  jaccardSimilarity,
  generateCandidate,

  // 类
  PatternMatcher,

  // 配置
  DEFAULT_CONFIG,
  loadConfig,
  createMatcher
};
