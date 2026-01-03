/**
 * 特征提取器
 * @module ace/feature-extractor
 * @see openspec/changes/v3.0-ace-integration/specs/ace/pattern-learning.fspec.md
 *
 * 实现 REQ-002: 模式特征提取 (AC-005 ~ AC-009)
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 观察特征
 * @typedef {Object} ObservationFeatures
 * @property {string} type - 观察类型
 * @property {string} module - 模块/目录
 * @property {string | null} errorType - 错误类型
 * @property {string[]} keywords - 关键词列表
 * @property {string} timeCluster - 时间聚类标识
 * @property {string | null} spec - 关联规格
 */

// ============================================================================
// 停用词列表
// ============================================================================

const STOP_WORDS = new Set([
  // English
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'both', 'either', 'neither',
  'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also',
  'now', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'any', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
  'of', 'at', 'by', 'from', 'in', 'into', 'on', 'to', 'with', 'about',
  'against', 'between', 'during', 'without', 'before', 'after', 'above', 'below',
  // Chinese stop words
  '的', '是', '在', '了', '和', '与', '或', '但', '如果', '因为',
  '所以', '这', '那', '有', '没有', '不', '也', '就', '都', '而',
  '及', '等', '被', '把', '让', '给', '对', '向', '从', '到'
]);

// ============================================================================
// 错误类型映射
// ============================================================================

const ERROR_TYPE_PATTERNS = [
  // 具体错误模式优先（这些比泛型错误名更具体）
  { pattern: /null|undefined/i, type: 'NullError' },
  { pattern: /cannot read propert/i, type: 'NullError' },
  { pattern: /is not a function/i, type: 'TypeError' },
  { pattern: /is not defined/i, type: 'ReferenceError' },
  { pattern: /timeout|timed out/i, type: 'TimeoutError' },
  { pattern: /connection|network/i, type: 'NetworkError' },
  { pattern: /permission|access denied/i, type: 'PermissionError' },
  { pattern: /assertion|\bexpect\(/i, type: 'AssertionError' },
  { pattern: /ENOENT|not found|missing/i, type: 'NotFoundError' },
  { pattern: /JSON\.parse|parse error|ParseError/i, type: 'ParseError' },
  // 泛型错误类型名（后匹配）
  { pattern: /TypeError/i, type: 'TypeError' },
  { pattern: /ReferenceError/i, type: 'ReferenceError' },
  { pattern: /SyntaxError/i, type: 'SyntaxError' },
  { pattern: /RangeError/i, type: 'RangeError' }
];

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 提取观察特征 (AC-005 ~ AC-009)
 * @param {Object} observation - 观察对象
 * @returns {ObservationFeatures}
 */
function extractFeatures(observation) {
  if (!observation || typeof observation !== 'object') {
    return {
      type: 'unknown',
      module: 'unknown',
      errorType: null,
      keywords: [],
      timeCluster: 'unknown',
      spec: null
    };
  }

  return {
    // AC-005: 类型特征
    type: extractType(observation),
    // AC-006: 模块特征
    module: extractModule(observation.context?.file),
    // AC-007: 错误类型特征
    errorType: extractErrorType(observation.context?.error_message),
    // AC-008: 关键词特征
    keywords: extractKeywords(observation.description),
    // AC-009: 时间聚类特征
    timeCluster: calculateTimeCluster(observation.created),
    // 规格关联
    spec: observation.related_spec || null
  };
}

/**
 * AC-005: 提取类型特征
 * @param {Object} observation - 观察对象
 * @returns {string}
 */
function extractType(observation) {
  if (!observation) {
    return 'unknown';
  }

  // 直接返回类型
  if (observation.type) {
    return observation.type;
  }

  // 从上下文推断
  const context = observation.context || {};

  if (context.test_name || context.test_file) {
    return 'test_failure';
  }

  if (context.spec_file) {
    return 'spec_drift';
  }

  if (context.coverage) {
    return 'coverage_gap';
  }

  return 'general';
}

/**
 * AC-006: 提取模块特征
 * @param {string} filePath - 文件路径
 * @returns {string}
 */
function extractModule(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return 'unknown';
  }

  // 移除文件名，保留目录路径
  const parts = filePath.split('/').filter(p => p && p !== '.');

  // 查找有意义的目录名
  const meaningfulDirs = ['lib', 'src', 'test', 'app', 'components', 'services', 'utils', 'helpers'];

  for (let i = 0; i < parts.length - 1; i++) {
    if (meaningfulDirs.includes(parts[i])) {
      // 返回该目录及其子目录
      return parts.slice(i, Math.min(i + 2, parts.length - 1)).join('/');
    }
  }

  // 返回最后两级目录
  if (parts.length >= 2) {
    return parts.slice(-3, -1).join('/');
  }

  // 单个元素：检查是否为文件名
  if (parts.length === 1) {
    // 如果看起来像文件名（包含扩展名），返回 root
    if (parts[0].includes('.')) {
      return 'root';
    }
    // 否则返回目录名本身
    return parts[0];
  }

  return 'root';
}

/**
 * AC-007: 提取错误类型特征
 * @param {string} errorMessage - 错误信息
 * @returns {string | null}
 */
function extractErrorType(errorMessage) {
  if (!errorMessage || typeof errorMessage !== 'string') {
    return null;
  }

  for (const { pattern, type } of ERROR_TYPE_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return type;
    }
  }

  // 尝试提取 Error 类名
  const errorMatch = errorMessage.match(/(\w+Error)/);
  if (errorMatch) {
    return errorMatch[1];
  }

  return 'UnknownError';
}

/**
 * AC-008: 提取关键词特征
 * @param {string} text - 文本内容
 * @returns {string[]}
 */
function extractKeywords(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // 分词
  const words = text
    .toLowerCase()
    .split(/[\s\W]+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  // 去重并限制数量
  const unique = [...new Set(words)];

  return unique.slice(0, 10);
}

/**
 * AC-009: 计算时间聚类特征
 * @param {string | Date} created - 创建时间
 * @returns {string}
 */
function calculateTimeCluster(created) {
  if (!created) {
    return 'unknown';
  }

  const date = created instanceof Date ? created : new Date(created);

  if (isNaN(date.getTime())) {
    return 'unknown';
  }

  // 返回日期字符串作为聚类标识（同一天的观察聚为一类）
  return date.toISOString().split('T')[0];
}

/**
 * 批量提取特征
 * @param {Object[]} observations - 观察列表
 * @returns {ObservationFeatures[]}
 */
function extractFeaturesFromAll(observations) {
  if (!Array.isArray(observations)) {
    return [];
  }

  return observations.map(extractFeatures);
}

/**
 * 聚合特征（用于反思级别的特征）
 * @param {ObservationFeatures[]} features - 特征列表
 * @returns {Object}
 */
function aggregateFeatures(features) {
  if (!Array.isArray(features) || features.length === 0) {
    return {
      types: [],
      modules: [],
      errorTypes: [],
      keywords: [],
      timeClusters: [],
      specs: []
    };
  }

  // 统计各维度
  const types = {};
  const modules = {};
  const errorTypes = {};
  const keywordCounts = {};
  const timeClusters = {};
  const specs = {};

  for (const f of features) {
    // 类型
    types[f.type] = (types[f.type] || 0) + 1;

    // 模块
    modules[f.module] = (modules[f.module] || 0) + 1;

    // 错误类型
    if (f.errorType) {
      errorTypes[f.errorType] = (errorTypes[f.errorType] || 0) + 1;
    }

    // 关键词
    for (const kw of f.keywords) {
      keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
    }

    // 时间聚类
    timeClusters[f.timeCluster] = (timeClusters[f.timeCluster] || 0) + 1;

    // 规格
    if (f.spec) {
      specs[f.spec] = (specs[f.spec] || 0) + 1;
    }
  }

  // 排序返回
  const sortByCount = obj =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key);

  return {
    types: sortByCount(types),
    modules: sortByCount(modules),
    errorTypes: sortByCount(errorTypes),
    keywords: sortByCount(keywordCounts).slice(0, 15),
    timeClusters: sortByCount(timeClusters),
    specs: sortByCount(specs)
  };
}

/**
 * 计算时间密度（判断观察是密集还是分散）
 * @param {string[]} timeClusters - 时间聚类列表
 * @returns {'dense' | 'sparse' | 'single'}
 */
function calculateTimeDensity(timeClusters) {
  if (!Array.isArray(timeClusters) || timeClusters.length === 0) {
    return 'single';
  }

  if (timeClusters.length === 1) {
    return 'single';
  }

  // 解析日期并排序
  const dates = timeClusters
    .filter(t => t !== 'unknown')
    .map(t => new Date(t))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a - b);

  if (dates.length < 2) {
    return 'single';
  }

  // 计算时间跨度（天）
  const spanMs = dates[dates.length - 1] - dates[0];
  const spanDays = spanMs / (1000 * 60 * 60 * 24);

  // 计算平均间隔
  const avgGapDays = spanDays / (dates.length - 1);

  if (avgGapDays <= 1) {
    return 'dense';  // 平均间隔 <= 1 天
  } else if (avgGapDays <= 7) {
    return 'sparse'; // 平均间隔 1-7 天
  } else {
    return 'sparse'; // 更分散
  }
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 核心函数
  extractFeatures,
  extractFeaturesFromAll,
  aggregateFeatures,

  // 单项提取
  extractType,
  extractModule,
  extractErrorType,
  extractKeywords,
  calculateTimeCluster,
  calculateTimeDensity,

  // 常量
  STOP_WORDS,
  ERROR_TYPE_PATTERNS
};
