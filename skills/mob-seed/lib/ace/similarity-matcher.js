/**
 * 相似度匹配器
 * @module ace/similarity-matcher
 * @see openspec/changes/v3.0-ace-integration/specs/ace/pattern-learning.fspec.md
 *
 * 实现 REQ-003: 相似度匹配 (AC-010 ~ AC-013)
 */

const { extractFeaturesFromAll, aggregateFeatures } = require('./feature-extractor');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 匹配结果
 * @typedef {Object} MatchResult
 * @property {Object} sample - 历史样本
 * @property {number} similarity - 相似度 (0-1)
 * @property {string} suggestedLesson - 建议教训
 * @property {string[]} suggestedActions - 建议行动
 * @property {boolean} wasEffective - 历史是否有效
 */

/**
 * 匹配配置
 * @typedef {Object} MatchConfig
 * @property {number} [threshold] - 相似度阈值 (默认 0.6)
 * @property {number} [maxResults] - 最大返回结果数 (默认 5)
 * @property {Object} [weights] - 权重配置
 */

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG = {
  threshold: 0.6,
  maxResults: 5,
  weights: {
    type: 0.3,       // 类型匹配权重
    keyword: 0.3,    // 关键词相似度权重
    module: 0.2,     // 模块匹配权重
    errorType: 0.2   // 错误类型匹配权重
  }
};

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 匹配历史模式 (AC-010 ~ AC-013)
 * @param {Object[]} observations - 当前观察列表
 * @param {Object[]} historySamples - 历史样本列表
 * @param {MatchConfig} [config] - 配置
 * @returns {MatchResult[]}
 */
function matchHistoricalPatterns(observations, historySamples, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!Array.isArray(observations) || observations.length === 0) {
    return [];
  }

  if (!Array.isArray(historySamples) || historySamples.length === 0) {
    return [];
  }

  // 提取当前特征
  const currentFeatures = extractFeaturesFromAll(observations);
  const aggregatedCurrent = aggregateFeatures(currentFeatures);

  const matches = [];

  for (const sample of historySamples) {
    // 确保样本有特征
    const sampleFeatures = sample.features || aggregateFeatures(
      extractFeaturesFromAll(sample.observations || [])
    );

    // AC-010, AC-011: 计算多维度加权相似度
    const similarity = calculateSimilarity(aggregatedCurrent, sampleFeatures, cfg.weights);

    // AC-013: 应用阈值过滤
    if (similarity >= cfg.threshold) {
      matches.push({
        sample,
        similarity,
        suggestedLesson: sample.lesson,
        suggestedActions: sample.actions || [],
        wasEffective: sample.effective !== false
      });
    }
  }

  // AC-012: 按相似度排序
  matches.sort((a, b) => b.similarity - a.similarity);

  return matches.slice(0, cfg.maxResults);
}

/**
 * 计算综合相似度 (AC-010, AC-011)
 * @param {Object} current - 当前聚合特征
 * @param {Object} historical - 历史聚合特征
 * @param {Object} weights - 权重配置
 * @returns {number}
 */
function calculateSimilarity(current, historical, weights = DEFAULT_CONFIG.weights) {
  let score = 0;
  let totalWeight = 0;

  // 类型匹配
  if (weights.type > 0) {
    const typeScore = hasTypeOverlap(current.types, historical.types) ? 1 : 0;
    score += weights.type * typeScore;
    totalWeight += weights.type;
  }

  // 关键词相似度 (Jaccard)
  if (weights.keyword > 0) {
    const keywordScore = jaccardSimilarity(current.keywords, historical.keywords);
    score += weights.keyword * keywordScore;
    totalWeight += weights.keyword;
  }

  // 模块匹配
  if (weights.module > 0) {
    const moduleScore = hasModuleOverlap(current.modules, historical.modules) ? 1 : 0;
    score += weights.module * moduleScore;
    totalWeight += weights.module;
  }

  // 错误类型匹配
  if (weights.errorType > 0) {
    const errorScore = hasErrorTypeOverlap(current.errorTypes, historical.errorTypes) ? 1 : 0;
    score += weights.errorType * errorScore;
    totalWeight += weights.errorType;
  }

  return totalWeight > 0 ? score / totalWeight : 0;
}

/**
 * 检查类型是否有重叠
 * @param {string[]} current - 当前类型列表
 * @param {string[]} historical - 历史类型列表
 * @returns {boolean}
 */
function hasTypeOverlap(current, historical) {
  if (!Array.isArray(current) || !Array.isArray(historical)) {
    return false;
  }

  const histSet = new Set(historical);
  return current.some(t => histSet.has(t));
}

/**
 * 检查模块是否有重叠
 * @param {string[]} current - 当前模块列表
 * @param {string[]} historical - 历史模块列表
 * @returns {boolean}
 */
function hasModuleOverlap(current, historical) {
  if (!Array.isArray(current) || !Array.isArray(historical)) {
    return false;
  }

  // 精确匹配
  const histSet = new Set(historical);
  if (current.some(m => histSet.has(m))) {
    return true;
  }

  // 前缀匹配（如 lib/parser 匹配 lib/parser/core）
  for (const currMod of current) {
    for (const histMod of historical) {
      if (currMod.startsWith(histMod) || histMod.startsWith(currMod)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 检查错误类型是否有重叠
 * @param {string[]} current - 当前错误类型列表
 * @param {string[]} historical - 历史错误类型列表
 * @returns {boolean}
 */
function hasErrorTypeOverlap(current, historical) {
  if (!Array.isArray(current) || !Array.isArray(historical)) {
    return false;
  }

  const histSet = new Set(historical);
  return current.some(e => histSet.has(e));
}

/**
 * Jaccard 相似度计算
 * @param {string[]} a - 集合 A
 * @param {string[]} b - 集合 B
 * @returns {number} 0-1 之间的相似度
 */
function jaccardSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return 0;
  }

  if (a.length === 0 && b.length === 0) {
    return 1;  // 两个空集视为完全相似
  }

  if (a.length === 0 || b.length === 0) {
    return 0;  // 一个空一个非空，相似度为0
  }

  const setA = new Set(a);
  const setB = new Set(b);

  // 计算交集大小
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection++;
    }
  }

  // 计算并集大小
  const union = setA.size + setB.size - intersection;

  return intersection / union;
}

/**
 * 余弦相似度计算（用于 TF-IDF 加权的关键词）
 * @param {Object} a - 词频向量 {word: count}
 * @param {Object} b - 词频向量 {word: count}
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
    return 0;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length === 0 || keysB.length === 0) {
    return 0;
  }

  // 计算点积
  let dotProduct = 0;
  for (const key of keysA) {
    if (key in b) {
      dotProduct += a[key] * b[key];
    }
  }

  // 计算向量模长
  let normA = 0;
  for (const key of keysA) {
    normA += a[key] * a[key];
  }
  normA = Math.sqrt(normA);

  let normB = 0;
  for (const key of keysB) {
    normB += b[key] * b[key];
  }
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * 编辑距离相似度（用于字符串模糊匹配）
 * @param {string} a - 字符串 A
 * @param {string} b - 字符串 B
 * @returns {number} 0-1 之间的相似度
 */
function levenshteinSimilarity(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);

  return 1 - (distance / maxLen);
}

/**
 * Levenshtein 编辑距离
 * @param {string} a - 字符串 A
 * @param {string} b - 字符串 B
 * @returns {number}
 */
function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;

  // 创建距离矩阵
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // 初始化边界
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  // 填充矩阵
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // 删除
          dp[i][j - 1],     // 插入
          dp[i - 1][j - 1]  // 替换
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * 查找最佳匹配
 * @param {Object[]} observations - 当前观察
 * @param {Object[]} historySamples - 历史样本
 * @param {MatchConfig} [config] - 配置
 * @returns {MatchResult | null}
 */
function findBestMatch(observations, historySamples, config = {}) {
  const matches = matchHistoricalPatterns(observations, historySamples, {
    ...config,
    maxResults: 1
  });

  return matches.length > 0 ? matches[0] : null;
}

/**
 * 批量匹配（用于多个反思候选）
 * @param {Object[]} candidates - 反思候选列表（每个包含 observations）
 * @param {Object[]} historySamples - 历史样本
 * @param {MatchConfig} [config] - 配置
 * @returns {Map<string, MatchResult[]>}
 */
function batchMatch(candidates, historySamples, config = {}) {
  const results = new Map();

  for (const candidate of candidates) {
    const id = candidate.id || `candidate-${Date.now()}`;
    const matches = matchHistoricalPatterns(
      candidate.observations || [],
      historySamples,
      config
    );
    results.set(id, matches);
  }

  return results;
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 核心匹配
  matchHistoricalPatterns,
  findBestMatch,
  batchMatch,

  // 相似度计算
  calculateSimilarity,
  jaccardSimilarity,
  cosineSimilarity,
  levenshteinSimilarity,
  levenshteinDistance,

  // 重叠检测
  hasTypeOverlap,
  hasModuleOverlap,
  hasErrorTypeOverlap,

  // 配置
  DEFAULT_CONFIG
};
