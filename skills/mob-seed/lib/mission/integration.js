/**
 * Mission Integration - SEED 阶段集成检查
 *
 * 将项目使命声明集成到 SEED 各阶段，确保开发过程与项目使命保持对齐。
 *
 * @module mission/integration
 * @see openspec/changes/v2.1-release-automation/specs/mission/integration.fspec.md
 */

const path = require('path');
const loader = require('./loader');

// 会话级缓存
const missionCache = new Map();

// 阶段检查配置
const PHASE_CHECKS = {
  spec: {
    name: '规格定义',
    checkContent: '规格是否符合核心原则？是否触犯反目标？',
    keywords: {
      positive: ['简单', 'simple', '清晰', 'clear', '单一职责', 'single'],
      negative: ['复杂', 'complex', '魔法', 'magic', '过度', 'over']
    }
  },
  emit: {
    name: '派生执行',
    checkContent: '派生策略是否符合简单优先原则？',
    keywords: {
      positive: ['直接', 'direct', '简单', 'simple', '最小', 'minimal'],
      negative: ['抽象', 'abstract', '复杂', 'complex', '多层', 'layer']
    }
  },
  exec: {
    name: '执行测试',
    checkContent: '测试覆盖是否满足质量要求？',
    keywords: {
      positive: ['测试', 'test', '验证', 'verify', '覆盖', 'coverage'],
      negative: ['跳过', 'skip', '忽略', 'ignore', '临时', 'temporary']
    }
  },
  defend: {
    name: '守护检查',
    checkContent: '变更是否偏离使命？对齐分数达标？',
    keywords: {
      positive: ['同步', 'sync', '一致', 'consistent', '规格', 'spec'],
      negative: ['偏离', 'drift', '不同步', 'unsync', '跳过', 'skip']
    }
  }
};

// 违规建议映射
const VIOLATION_SUGGESTIONS = {
  feature_creep: '建议拆分为独立提案',
  over_engineering: '建议简化实现',
  sync_breaking: '强制要求先更新规格',
  black_box_magic: '建议添加清晰注释和文档',
  ai_replacement_mindset: '建议增加人工确认点'
};

/**
 * 加载 Mission 文件（带缓存）
 * @param {string} projectRoot - 项目根目录
 * @returns {object|null} Mission 对象或 null
 */
function loadMission(projectRoot) {
  // 规范化路径作为缓存键
  const cacheKey = path.resolve(projectRoot);

  // 检查缓存
  if (missionCache.has(cacheKey)) {
    return missionCache.get(cacheKey);
  }

  // 使用 loader 加载
  const mission = loader.loadMission({ startDir: projectRoot });

  if (mission) {
    // 缓存结果
    missionCache.set(cacheKey, mission);
  }

  return mission;
}

/**
 * 解析 Mission 核心结构
 * @param {string} content - Mission 文件内容
 * @returns {object} Mission 核心结构 { principles, antiGoals, evolution, alignment }
 */
function parseMissionCore(content) {
  const result = {
    principles: [],
    antiGoals: [],
    evolution: null,
    alignment: null
  };

  if (!content) {
    return result;
  }

  // 提取 YAML frontmatter
  const { frontmatter } = loader.extractFrontmatter(content);

  if (!frontmatter) {
    return result;
  }

  // 使用正则直接提取数组项（更可靠）
  const principleMatch = frontmatter.match(/principle_ids:\s*\n((?:\s*-\s*\w+\s*\n?)+)/);
  if (principleMatch) {
    const items = principleMatch[1].match(/-\s*(\w+)/g);
    if (items) {
      result.principles = items.map(item => item.replace(/^-\s*/, '').trim());
    }
  }

  const antiGoalMatch = frontmatter.match(/anti_goal_ids:\s*\n((?:\s*-\s*\w+\s*\n?)+)/);
  if (antiGoalMatch) {
    const items = antiGoalMatch[1].match(/-\s*(\w+)/g);
    if (items) {
      result.antiGoals = items.map(item => item.replace(/^-\s*/, '').trim());
    }
  }

  // 尝试解析 evolution
  const evolutionMatch = frontmatter.match(/evolution:\s*\n((?:\s+\w+:.*\n?)+)/);
  if (evolutionMatch) {
    try {
      const parsed = loader.parseYaml('evolution:\n' + evolutionMatch[1]);
      result.evolution = parsed.evolution;
    } catch (e) {
      // 忽略解析错误
    }
  }

  // 尝试解析 alignment
  const alignmentMatch = frontmatter.match(/alignment:\s*\n((?:\s+\w+:.*\n?)+)/);
  if (alignmentMatch) {
    try {
      const parsed = loader.parseYaml('alignment:\n' + alignmentMatch[1]);
      result.alignment = parsed.alignment;
    } catch (e) {
      // 忽略解析错误
    }
  }

  return result;
}

/**
 * 评估对齐度
 * @param {object} mission - Mission 对象
 * @param {object} context - 上下文
 * @param {string} context.description - 操作描述
 * @param {string} [context.phase] - SEED 阶段
 * @param {string[]} [context.files] - 涉及的文件
 * @returns {object} AlignmentResult
 */
function evaluateAlignment(mission, context) {
  // 使用 loader 的评估函数
  const baseResult = loader.evaluateAlignment(mission, {
    description: context.description,
    type: context.phase
  });

  // 扩展结果
  return {
    total: baseResult.total,
    meetsThreshold: baseResult.meetsThreshold,
    violations: baseResult.violations || [],
    warnings: [],
    suggestions: baseResult.violations?.map(v => VIOLATION_SUGGESTIONS[v] || '请审查此操作') || [],
    breakdown: baseResult.breakdown
  };
}

/**
 * 检查阶段对齐
 * @param {string} phase - SEED 阶段 (spec|emit|exec|defend)
 * @param {object} context - 操作上下文
 * @param {string} context.description - 操作描述
 * @param {object} [options] - 选项
 * @param {string} [options.projectRoot] - 项目根目录
 * @param {boolean} [options.strict] - 严格模式
 * @returns {object} PhaseCheckResult
 */
function checkPhaseAlignment(phase, context, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const strict = options.strict || false;

  // 加载 Mission
  const mission = loadMission(projectRoot);

  const result = {
    phase,
    aligned: true,
    score: 1.0,
    violations: [],
    warnings: [],
    suggestions: [],
    blocked: false,
    blockReason: null
  };

  // 如果没有 Mission，默认通过
  if (!mission) {
    result.warnings.push('未找到 Mission 文件，跳过对齐检查');
    return result;
  }

  // 获取阶段配置
  const phaseConfig = PHASE_CHECKS[phase];
  if (!phaseConfig) {
    result.warnings.push(`未知阶段: ${phase}`);
    return result;
  }

  // 评估对齐度
  const alignment = evaluateAlignment(mission, {
    ...context,
    phase
  });

  result.score = alignment.total;
  result.violations = alignment.violations;

  // 检查描述中的关键词
  const desc = (context.description || '').toLowerCase();

  // 正面关键词检查
  const hasPositive = phaseConfig.keywords.positive.some(k => desc.includes(k.toLowerCase()));
  if (hasPositive) {
    result.score = Math.min(1, result.score + 0.1);
  }

  // 负面关键词检查
  const negativeMatches = phaseConfig.keywords.negative.filter(k => desc.includes(k.toLowerCase()));
  if (negativeMatches.length > 0) {
    result.score = Math.max(0, result.score - 0.1 * negativeMatches.length);
    result.warnings.push(`检测到可能的问题关键词: ${negativeMatches.join(', ')}`);
  }

  // 检查反目标
  let antiGoalIds = mission.anti_goal_ids || [];
  // 确保是数组
  if (!Array.isArray(antiGoalIds)) {
    antiGoalIds = [];
  }

  // feature_creep 检测
  if (antiGoalIds.includes('feature_creep')) {
    const creepKeywords = ['新增功能', '添加功能', 'add feature', '更多', 'more'];
    if (creepKeywords.some(k => desc.includes(k.toLowerCase()))) {
      if (!result.violations.includes('feature_creep')) {
        result.violations.push('feature_creep');
      }
      result.suggestions.push('建议拆分为独立提案');
      result.score = Math.max(0, result.score - 0.2);
    }
  }

  // over_engineering 检测
  if (antiGoalIds.includes('over_engineering')) {
    const overKeywords = ['复杂', 'complex', '抽象', 'abstract', '多层', 'layer'];
    if (overKeywords.some(k => desc.includes(k.toLowerCase()))) {
      if (!result.violations.includes('over_engineering')) {
        result.violations.push('over_engineering');
      }
      result.suggestions.push('建议简化实现');
      result.score = Math.max(0, result.score - 0.2);
    }
  }

  // 阈值检查
  const threshold = mission.evolution?.min_alignment_score || 0.7;

  if (result.score < threshold) {
    result.aligned = false;
    result.warnings.push(`⚠️ 对齐分数 ${result.score.toFixed(2)} < 阈值 ${threshold}`);
  }

  // strict 模式: 分数 < 0.5 阻止操作
  if (strict && result.score < 0.5) {
    result.blocked = true;
    result.blockReason = `对齐分数 ${result.score.toFixed(2)} 低于最低要求 0.5，需要人工审核`;
    result.suggestions.push('请检查操作是否符合项目使命');
  }

  // 为违规添加建议
  for (const violation of result.violations) {
    const suggestion = VIOLATION_SUGGESTIONS[violation];
    if (suggestion && !result.suggestions.includes(suggestion)) {
      result.suggestions.push(suggestion);
    }
  }

  return result;
}

/**
 * 获取缓存的 Mission
 * @param {string} projectRoot - 项目根目录
 * @returns {object|null} 缓存的 Mission 或 null
 */
function getCachedMission(projectRoot) {
  const cacheKey = path.resolve(projectRoot);
  return missionCache.get(cacheKey) || null;
}

/**
 * 清除所有缓存
 */
function clearCache() {
  missionCache.clear();
}

/**
 * 获取缓存统计
 * @returns {object} { size, keys }
 */
function getCacheStats() {
  return {
    size: missionCache.size,
    keys: Array.from(missionCache.keys())
  };
}

module.exports = {
  loadMission,
  parseMissionCore,
  // 向后兼容别名
  parseACE: parseMissionCore,
  evaluateAlignment,
  checkPhaseAlignment,
  getCachedMission,
  clearCache,
  getCacheStats,
  // 常量导出
  PHASE_CHECKS,
  VIOLATION_SUGGESTIONS
};
