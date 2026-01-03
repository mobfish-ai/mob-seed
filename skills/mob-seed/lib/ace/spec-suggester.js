/**
 * 规格建议器
 * @module ace/spec-suggester
 * @see openspec/changes/v3.0-ace-integration/specs/ace/auto-propose.fspec.md
 *
 * 实现 REQ-003: fspec 关联建议 (AC-009 ~ AC-012)
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 规格建议
 * @typedef {Object} SpecSuggestion
 * @property {'modify' | 'create'} type - 操作类型
 * @property {string} spec - 规格文件名
 * @property {string} reason - 建议原因
 * @property {'high' | 'medium' | 'low'} priority - 优先级
 */

// ============================================================================
// 关键词提取
// ============================================================================

/**
 * 提取主题关键词（用于生成规格名称）
 * @param {string} text - 文本内容
 * @returns {string}
 */
function extractTopic(text) {
  if (!text || typeof text !== 'string') {
    return 'untitled';
  }

  // 中文关键词映射
  const chineseKeywords = {
    '空值': 'null-handling',
    'null': 'null-handling',
    'undefined': 'undefined-handling',
    '错误': 'error-handling',
    '异常': 'exception-handling',
    '验证': 'validation',
    '校验': 'validation',
    '类型': 'type-checking',
    '边界': 'boundary-checking',
    '缓存': 'caching',
    '性能': 'performance',
    '安全': 'security',
    '认证': 'authentication',
    '授权': 'authorization',
    '日志': 'logging',
    '配置': 'configuration',
    '测试': 'testing',
    '文档': 'documentation'
  };

  // 检查中文关键词
  for (const [keyword, topic] of Object.entries(chineseKeywords)) {
    if (text.includes(keyword)) {
      return topic;
    }
  }

  // 尝试提取英文关键词
  const englishMatch = text.match(/\b([a-z]{3,}[-_]?[a-z]*)\b/gi);
  if (englishMatch) {
    // 使用第一个有意义的英文词
    const meaningful = englishMatch.find(w =>
      w.length >= 4 &&
      !['this', 'that', 'with', 'from', 'into', 'have', 'been', 'should'].includes(w.toLowerCase())
    );
    if (meaningful) {
      return meaningful.toLowerCase().replace(/_/g, '-');
    }
  }

  return 'improvement';
}

/**
 * 从文件路径提取模块名
 * @param {string} filePath - 文件路径
 * @returns {string}
 */
function extractModuleFromPath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return 'unknown';
  }

  // 提取目录名作为模块名
  const parts = filePath.split('/').filter(p => p && p !== '.');
  if (parts.length >= 2) {
    // 返回倒数第二个部分（通常是模块目录）
    return parts[parts.length - 2];
  }

  return parts[0] || 'unknown';
}

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 统计观察关联的规格 (AC-009)
 * @param {Object[]} observations - 观察列表
 * @returns {Map<string, number>}
 */
function countSpecOccurrences(observations) {
  const counts = new Map();

  for (const obs of observations) {
    if (obs.related_spec) {
      const current = counts.get(obs.related_spec) || 0;
      counts.set(obs.related_spec, current + 1);
    }
  }

  return counts;
}

/**
 * 识别需要新建规格的场景 (AC-011)
 * @param {Object} reflection - 反思对象
 * @returns {boolean}
 */
function needsNewSpec(reflection) {
  if (!reflection || !reflection.lesson) {
    return false;
  }

  const lesson = reflection.lesson.toLowerCase();

  // 关键词检测
  const newSpecKeywords = [
    '统一', 'unified', 'standardize',
    '策略', 'strategy', 'policy',
    '规范', 'specification', 'standard',
    '缺乏', 'missing', 'lacking',
    '没有', 'no ', 'not have',
    '需要新', 'need new', 'create new',
    '建立', 'establish',
    '定义', 'define'
  ];

  return newSpecKeywords.some(keyword => lesson.includes(keyword));
}

/**
 * 生成规格建议 (AC-010, AC-012)
 * @param {Object} reflection - 反思对象
 * @param {Object[]} observations - 观察列表
 * @returns {SpecSuggestion[]}
 */
function suggestSpecs(reflection, observations) {
  const suggestions = [];

  // AC-009: 统计规格出现次数
  const specCounts = countSpecOccurrences(observations);

  // AC-010: 建议修改高频规格
  for (const [spec, count] of specCounts.entries()) {
    suggestions.push({
      type: 'modify',
      spec,
      reason: `${count} 个相关观察`,
      priority: count >= 2 ? 'high' : 'medium'
    });
  }

  // AC-011: 识别需要新建规格的场景
  if (needsNewSpec(reflection)) {
    const topic = extractTopic(reflection.lesson);
    const newSpecName = `${topic}.fspec.md`;

    // 检查是否已经存在
    const exists = Array.from(specCounts.keys()).some(s =>
      s.toLowerCase().includes(topic.toLowerCase())
    );

    if (!exists) {
      suggestions.push({
        type: 'create',
        spec: newSpecName,
        reason: '需要新规格定义统一策略',
        priority: 'high'
      });
    }
  }

  // 基于模式分析的额外建议
  if (reflection.pattern) {
    const patternBasedSpec = suggestFromPattern(reflection.pattern, specCounts);
    if (patternBasedSpec) {
      const exists = suggestions.some(s => s.spec === patternBasedSpec.spec);
      if (!exists) {
        suggestions.push(patternBasedSpec);
      }
    }
  }

  // AC-012: 按优先级排序
  return sortByPriority(suggestions);
}

/**
 * 基于模式建议规格
 * @param {string} pattern - 模式名称
 * @param {Map<string, number>} existingSpecs - 现有规格
 * @returns {SpecSuggestion | null}
 */
function suggestFromPattern(pattern, existingSpecs) {
  if (!pattern) {
    return null;
  }

  // 模式到规格的映射
  const patternMapping = {
    'test_failure': { topic: 'test-coverage', reason: '增加测试覆盖' },
    'spec_drift': { topic: 'spec-sync', reason: '保持规格同步' },
    'coverage_gap': { topic: 'coverage-policy', reason: '定义覆盖率策略' },
    'null_handling': { topic: 'null-handling', reason: '统一空值处理' },
    'error_handling': { topic: 'error-handling', reason: '统一错误处理' },
    'type_mismatch': { topic: 'type-safety', reason: '增强类型安全' }
  };

  const mapping = patternMapping[pattern];
  if (!mapping) {
    return null;
  }

  // 检查是否已有相关规格
  const hasRelated = Array.from(existingSpecs.keys()).some(s =>
    s.toLowerCase().includes(mapping.topic)
  );

  if (hasRelated) {
    return null;
  }

  return {
    type: 'create',
    spec: `${mapping.topic}.fspec.md`,
    reason: mapping.reason,
    priority: 'medium'
  };
}

/**
 * 按优先级排序
 * @param {SpecSuggestion[]} suggestions - 建议列表
 * @returns {SpecSuggestion[]}
 */
function sortByPriority(suggestions) {
  const priorityOrder = { high: 0, medium: 1, low: 2 };

  return [...suggestions].sort((a, b) => {
    const orderDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (orderDiff !== 0) {
      return orderDiff;
    }
    // 同优先级时，create 优先于 modify
    if (a.type !== b.type) {
      return a.type === 'create' ? -1 : 1;
    }
    return 0;
  });
}

/**
 * 格式化规格建议为 Markdown
 * @param {SpecSuggestion[]} suggestions - 建议列表
 * @returns {string}
 */
function formatSuggestionsAsMarkdown(suggestions) {
  if (!suggestions || suggestions.length === 0) {
    return '无规格变更建议';
  }

  const lines = [];

  for (const s of suggestions) {
    const action = s.type === 'modify' ? '修改' : '新建';
    const priority = s.priority === 'high' ? '🔴' : s.priority === 'medium' ? '🟡' : '🟢';
    lines.push(`- ${priority} ${action} \`${s.spec}\`: ${s.reason}`);
  }

  return lines.join('\n');
}

/**
 * 从规格名称提取模块信息
 * @param {string} specName - 规格文件名
 * @returns {{module: string, feature: string}}
 */
function parseSpecName(specName) {
  if (!specName || typeof specName !== 'string') {
    return { module: 'unknown', feature: 'unknown' };
  }

  // 移除扩展名
  const name = specName.replace(/\.fspec\.md$/, '');

  // 尝试分割模块和特性
  const parts = name.split(/[-_/]/);

  if (parts.length >= 2) {
    return {
      module: parts[0],
      feature: parts.slice(1).join('-')
    };
  }

  return {
    module: 'core',
    feature: name
  };
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 核心函数
  suggestSpecs,
  countSpecOccurrences,
  needsNewSpec,

  // 辅助函数
  extractTopic,
  extractModuleFromPath,
  suggestFromPattern,
  sortByPriority,
  formatSuggestionsAsMarkdown,
  parseSpecName
};
