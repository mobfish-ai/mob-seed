/**
 * Reflect 命令处理器
 * @module ace/reflect-handler
 * @see openspec/changes/v3.0-ace-integration/specs/ace/reflect-handler.fspec.md
 *
 * 实现 `/mob-seed:spec reflect` 子操作，触发反思分析并展示结果
 */

const fs = require('fs');
const path = require('path');
const { listObservations } = require('./observation');
const { PATTERN_TYPES, createReflection, saveReflection, loadReflection, listReflections, updateIndex, REFLECTION_STATUS, transition } = require('./reflection');
const { createMatcher, PatternMatcher } = require('./pattern-matcher');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Reflect 命令选项
 * @typedef {Object} ReflectOptions
 * @property {boolean} [auto=false] - 自动接受高置信度反思
 * @property {number} [minConfidence=0.5] - 最低置信度阈值
 * @property {string[]} [patterns] - 指定模式类型
 * @property {boolean} [list=false] - 列表模式
 * @property {string} [show] - 查看指定反思
 * @property {string} [accept] - 接受指定反思
 * @property {string} [reject] - 拒绝指定反思
 * @property {string} [reason] - 拒绝理由
 */

/**
 * 处理结果
 * @typedef {Object} ReflectResult
 * @property {boolean} success - 是否成功
 * @property {string} message - 结果消息
 * @property {Object} [data] - 相关数据
 */

// ============================================================================
// 主要触发 (REQ-001)
// ============================================================================

/**
 * 触发反思分析 (AC-001, AC-002, AC-003, AC-004)
 * @param {string} projectRoot - 项目根目录
 * @param {ReflectOptions} options - 选项
 * @returns {ReflectResult} 处理结果
 */
function handleReflect(projectRoot, options = {}) {
  const {
    auto = false,
    minConfidence = 0.5,
    patterns,
    list = false,
    show,
    accept,
    reject,
    reason
  } = options;

  // 路由到不同操作
  if (list) {
    return handleList(projectRoot);
  }

  if (show) {
    return handleShow(projectRoot, show);
  }

  if (accept) {
    return handleAccept(projectRoot, accept);
  }

  if (reject) {
    return handleReject(projectRoot, reject, reason);
  }

  // 默认：触发反思分析
  return triggerAnalysis(projectRoot, { auto, minConfidence, patterns });
}

/**
 * 触发分析流程
 * @param {string} projectRoot - 项目根目录
 * @param {Object} options - 选项
 * @returns {ReflectResult} 处理结果
 */
function triggerAnalysis(projectRoot, options = {}) {
  const { auto = false, minConfidence = 0.5, patterns } = options;

  // AC-002: 读取 triaged 状态的观察
  const observations = listObservations(projectRoot, { status: 'triaged' });

  if (observations.length === 0) {
    return handleEmptyObservations(projectRoot);
  }

  // AC-003: 调用 PatternMatcher 进行分析
  const matcher = createMatcher(projectRoot);
  let candidates;

  if (patterns && patterns.length > 0) {
    candidates = matcher.runPatterns(observations, patterns);
  } else {
    candidates = matcher.runAllPatterns(observations);
  }

  // 过滤低置信度
  candidates = candidates.filter(c => c.confidence >= minConfidence);

  if (candidates.length === 0) {
    return handleEmptyResults(projectRoot, observations.length);
  }

  // AC-004: 返回反思建议列表
  const result = {
    success: true,
    message: formatCandidates(candidates),
    data: {
      candidates,
      count: candidates.length
    }
  };

  // 自动模式处理
  if (auto) {
    const autoResult = handleAutoAccept(projectRoot, candidates, options);
    result.message += '\n\n' + autoResult.message;
    result.data.autoAccepted = autoResult.data?.created || [];
  }

  return result;
}

// ============================================================================
// 交互式确认 (REQ-002)
// ============================================================================

/**
 * 格式化候选列表 (AC-005, AC-006)
 * @param {Object[]} candidates - 候选列表
 * @returns {string} 格式化输出
 */
function formatCandidates(candidates) {
  const lines = [];
  lines.push(`💡 发现 ${candidates.length} 个反思建议`);
  lines.push('');

  candidates.forEach((candidate, index) => {
    const num = index + 1;
    const confPercent = Math.round(candidate.confidence * 100);
    const patternLabel = getPatternLabel(candidate.pattern);

    lines.push(`[${num}] ${patternLabel} (${candidate.observations.length} 个观察)`);
    lines.push(`    置信度: ${confPercent}%`);
    lines.push(`    教训: ${candidate.suggestedLesson}`);
    lines.push(`    观察: ${candidate.observations.join(', ')}`);
    lines.push('');
  });

  lines.push('操作指南:');
  lines.push('  使用 --accept-index <n> 接受第 n 个建议');
  lines.push('  使用 --reject-index <n> 拒绝第 n 个建议');

  return lines.join('\n');
}

/**
 * 获取模式标签
 * @param {string} pattern - 模式类型
 * @returns {string} 标签
 */
function getPatternLabel(pattern) {
  const labels = {
    [PATTERN_TYPES.TYPE_AGGREGATION]: '类型聚合',
    [PATTERN_TYPES.SPEC_AGGREGATION]: '规格聚合',
    [PATTERN_TYPES.TIME_CLUSTERING]: '时间聚类',
    [PATTERN_TYPES.KEYWORD_SIMILARITY]: '关键词相似',
    [PATTERN_TYPES.MANUAL]: '手动创建'
  };
  return labels[pattern] || pattern;
}

/**
 * 接受候选并创建反思 (AC-008, AC-009, AC-010, AC-011, AC-012)
 * @param {string} projectRoot - 项目根目录
 * @param {Object} candidate - 候选对象
 * @param {Object[]} observations - 观察列表（用于追溯）
 * @returns {Object} 创建的反思
 */
function acceptCandidate(projectRoot, candidate, observations = []) {
  // AC-009: 调用 createReflection() 创建反思
  const reflection = createReflection({
    observations: candidate.observations,
    pattern: candidate.pattern,
    lesson: candidate.suggestedLesson,
    analysis: generateAnalysis(candidate),
    suggestedActions: candidate.suggestedActions,
    source: 'auto'
  });

  // AC-011: 自动填充来源追溯表
  const observationDetails = {};
  for (const obsId of candidate.observations) {
    const obs = observations.find(o => o.id === obsId);
    if (obs) {
      observationDetails[obsId] = {
        type: obs.type,
        description: obs.description
      };
    }
  }

  // AC-010: 反思文件包含教训、分析、建议行动
  const filePath = saveReflection(projectRoot, reflection, observationDetails);

  // AC-012: 更新索引文件
  updateIndex(projectRoot);

  return { reflection, filePath };
}

/**
 * 生成分析说明
 * @param {Object} candidate - 候选对象
 * @returns {string} 分析说明
 */
function generateAnalysis(candidate) {
  const lines = [];

  lines.push(`- ${candidate.observations.length} 个观察被识别为 ${getPatternLabel(candidate.pattern)} 模式`);

  if (candidate.metadata) {
    if (candidate.metadata.type) {
      lines.push(`- 观察类型: ${candidate.metadata.type}`);
    }
    if (candidate.metadata.spec) {
      lines.push(`- 关联规格: ${candidate.metadata.spec}`);
    }
    if (candidate.metadata.keywords) {
      lines.push(`- 关键词: ${candidate.metadata.keywords.join(', ')}`);
    }
  }

  lines.push(`- 置信度: ${Math.round(candidate.confidence * 100)}%`);

  return lines.join('\n');
}

// ============================================================================
// 自动模式 (REQ-004)
// ============================================================================

/**
 * 自动接受高置信度反思 (AC-013, AC-014, AC-015)
 * @param {string} projectRoot - 项目根目录
 * @param {Object[]} candidates - 候选列表
 * @param {Object} options - 选项
 * @returns {ReflectResult} 处理结果
 */
function handleAutoAccept(projectRoot, candidates, options = {}) {
  const autoThreshold = options.autoAcceptThreshold || 0.9;
  const observations = listObservations(projectRoot, { status: 'triaged' });

  const created = [];

  for (const candidate of candidates) {
    if (candidate.confidence >= autoThreshold) {
      const { reflection, filePath } = acceptCandidate(projectRoot, candidate, observations);
      created.push({
        id: reflection.id,
        pattern: candidate.pattern,
        confidence: candidate.confidence
      });
    }
  }

  if (created.length === 0) {
    return {
      success: true,
      message: `自动模式: 无候选达到阈值 ${Math.round(autoThreshold * 100)}%`,
      data: { created: [] }
    };
  }

  const lines = [];
  lines.push(`🤖 自动接受了 ${created.length} 个反思:`);
  created.forEach(c => {
    lines.push(`  - ${c.id} (${getPatternLabel(c.pattern)}, ${Math.round(c.confidence * 100)}%)`);
  });

  return {
    success: true,
    message: lines.join('\n'),
    data: { created }
  };
}

// ============================================================================
// 空结果处理 (REQ-005)
// ============================================================================

/**
 * 处理空观察情况 (AC-016, AC-017, AC-018)
 * @param {string} projectRoot - 项目根目录
 * @returns {ReflectResult} 处理结果
 */
function handleEmptyObservations(projectRoot) {
  const allObs = listObservations(projectRoot);
  const rawCount = allObs.filter(o => o.status === 'raw').length;

  const lines = [];
  lines.push('📊 反思分析完成');
  lines.push('');
  lines.push('未找到 triaged 状态的观察。');
  lines.push('');
  lines.push('可能原因:');
  lines.push(`- 没有 triaged 观察（当前 raw: ${rawCount}）`);
  lines.push('- 需要先对观察进行分类');
  lines.push('');
  lines.push('建议:');
  lines.push('- 运行 /mob-seed:spec triage 对观察进行分类');
  lines.push('- 或手动添加观察: /mob-seed:spec observe');

  return {
    success: true,
    message: lines.join('\n'),
    data: { rawCount, triagedCount: 0 }
  };
}

/**
 * 处理无匹配情况
 * @param {string} projectRoot - 项目根目录
 * @param {number} observationCount - 观察数量
 * @returns {ReflectResult} 处理结果
 */
function handleEmptyResults(projectRoot, observationCount) {
  const lines = [];
  lines.push('📊 反思分析完成');
  lines.push('');
  lines.push('未发现新的模式匹配。');
  lines.push('');
  lines.push('可能原因:');
  lines.push(`- triaged 观察数量不足（当前: ${observationCount}，类型聚合阈值: 3）`);
  lines.push('- 观察类型分散，无明显聚合');
  lines.push('');
  lines.push('建议:');
  lines.push('- 继续收集更多观察');
  lines.push('- 尝试手动添加观察: /mob-seed:spec observe');

  return {
    success: true,
    message: lines.join('\n'),
    data: { observationCount, matchCount: 0 }
  };
}

// ============================================================================
// 列表和查看 (REQ-006)
// ============================================================================

/**
 * 列出反思 (AC-019, AC-020)
 * @param {string} projectRoot - 项目根目录
 * @returns {ReflectResult} 处理结果
 */
function handleList(projectRoot) {
  const reflections = listReflections(projectRoot);

  if (reflections.length === 0) {
    return {
      success: true,
      message: '📋 反思列表\n\n暂无反思记录。\n\n使用 /mob-seed:spec reflect 进行反思分析。',
      data: { reflections: [] }
    };
  }

  const lines = [];
  lines.push('📋 反思列表');
  lines.push('');
  lines.push('| ID | 状态 | 模式 | 观察数 | 创建时间 |');
  lines.push('|----|------|------|--------|---------|');

  for (const ref of reflections) {
    const timeAgo = formatTimeAgo(new Date(ref.created));
    const patternLabel = getPatternLabel(ref.pattern);
    const obsCount = ref.observations?.length || 0;

    lines.push(`| ${ref.id} | ${ref.status} | ${patternLabel} | ${obsCount} | ${timeAgo} |`);
  }

  // 统计
  const stats = {
    total: reflections.length,
    draft: reflections.filter(r => r.status === 'draft').length,
    accepted: reflections.filter(r => r.status === 'accepted').length,
    rejected: reflections.filter(r => r.status === 'rejected').length
  };

  lines.push('');
  lines.push(`统计: ${stats.total} total (${stats.accepted} accepted, ${stats.draft} draft, ${stats.rejected} rejected)`);

  return {
    success: true,
    message: lines.join('\n'),
    data: { reflections, stats }
  };
}

/**
 * 查看反思详情 (AC-021, AC-022)
 * @param {string} projectRoot - 项目根目录
 * @param {string} reflectionId - 反思ID
 * @returns {ReflectResult} 处理结果
 */
function handleShow(projectRoot, reflectionId) {
  const reflection = loadReflection(projectRoot, reflectionId);

  if (!reflection) {
    return {
      success: false,
      message: `❌ 反思不存在: ${reflectionId}`,
      data: null
    };
  }

  const lines = [];
  lines.push(`📝 反思详情: ${reflection.id}`);
  lines.push('');
  lines.push(`状态: ${reflection.status}`);
  lines.push(`模式: ${getPatternLabel(reflection.pattern)}`);
  lines.push(`创建: ${reflection.created}`);
  lines.push(`更新: ${reflection.updated}`);
  lines.push('');
  lines.push('## 教训');
  lines.push(reflection.lesson);

  if (reflection.analysis) {
    lines.push('');
    lines.push('## 分析');
    lines.push(reflection.analysis);
  }

  if (reflection.suggestedActions && reflection.suggestedActions.length > 0) {
    lines.push('');
    lines.push('## 建议行动');
    reflection.suggestedActions.forEach((action, i) => {
      lines.push(`${i + 1}. ${action}`);
    });
  }

  lines.push('');
  lines.push('## 关联观察');
  lines.push(reflection.observations.join(', '));

  return {
    success: true,
    message: lines.join('\n'),
    data: { reflection }
  };
}

// ============================================================================
// 接受和拒绝 (REQ-007)
// ============================================================================

/**
 * 接受反思 (AC-023, AC-026)
 * @param {string} projectRoot - 项目根目录
 * @param {string} reflectionId - 反思ID
 * @returns {ReflectResult} 处理结果
 */
function handleAccept(projectRoot, reflectionId) {
  const reflection = loadReflection(projectRoot, reflectionId);

  if (!reflection) {
    return {
      success: false,
      message: `❌ 反思不存在: ${reflectionId}`,
      data: null
    };
  }

  if (reflection.status !== REFLECTION_STATUS.DRAFT) {
    return {
      success: false,
      message: `❌ 只能接受 draft 状态的反思，当前状态: ${reflection.status}`,
      data: null
    };
  }

  try {
    const updated = transition(reflection, REFLECTION_STATUS.ACCEPTED);
    saveReflection(projectRoot, updated);
    updateIndex(projectRoot);

    return {
      success: true,
      message: `✅ 反思已接受: ${reflectionId}\n\n下一步: 使用 /mob-seed:spec promote 升级为提案`,
      data: { reflection: updated }
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ 接受失败: ${error.message}`,
      data: null
    };
  }
}

/**
 * 拒绝反思 (AC-024, AC-025, AC-026)
 * @param {string} projectRoot - 项目根目录
 * @param {string} reflectionId - 反思ID
 * @param {string} [reason] - 拒绝理由
 * @returns {ReflectResult} 处理结果
 */
function handleReject(projectRoot, reflectionId, reason) {
  const reflection = loadReflection(projectRoot, reflectionId);

  if (!reflection) {
    return {
      success: false,
      message: `❌ 反思不存在: ${reflectionId}`,
      data: null
    };
  }

  if (reflection.status !== REFLECTION_STATUS.DRAFT) {
    return {
      success: false,
      message: `❌ 只能拒绝 draft 状态的反思，当前状态: ${reflection.status}`,
      data: null
    };
  }

  // AC-025: 拒绝需要理由
  if (!reason) {
    return {
      success: false,
      message: '❌ 拒绝反思需要提供理由，使用 --reason "理由"',
      data: null
    };
  }

  try {
    const updated = transition(reflection, REFLECTION_STATUS.REJECTED, { reason });
    saveReflection(projectRoot, updated);
    updateIndex(projectRoot);

    return {
      success: true,
      message: `✅ 反思已拒绝: ${reflectionId}\n理由: ${reason}`,
      data: { reflection: updated }
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ 拒绝失败: ${error.message}`,
      data: null
    };
  }
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 格式化相对时间 (AC-020)
 * @param {Date} date - 日期
 * @returns {string} 相对时间
 */
function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) {
    return `${diffDay} 天前`;
  } else if (diffHour > 0) {
    return `${diffHour} 小时前`;
  } else if (diffMin > 0) {
    return `${diffMin} 分钟前`;
  } else {
    return '刚刚';
  }
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 主处理函数
  handleReflect,

  // 子操作
  triggerAnalysis,
  handleList,
  handleShow,
  handleAccept,
  handleReject,
  handleAutoAccept,

  // 工具函数
  formatCandidates,
  getPatternLabel,
  acceptCandidate,
  formatTimeAgo
};
