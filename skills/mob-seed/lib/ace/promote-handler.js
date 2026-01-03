/**
 * Promote 命令处理器
 * @module ace/promote-handler
 * @see openspec/changes/v3.0-ace-integration/specs/ace/promote-handler.fspec.md
 *
 * 实现 `/mob-seed:spec promote` 子操作，将观察或反思升级为正式变更提案
 */

const fs = require('fs');
const path = require('path');
const {
  loadObservation,
  saveObservation,
  transition: transitionObs,
  OBSERVATION_STATUS,
  listObservations
} = require('./observation');
const {
  loadReflection,
  saveReflection,
  REFLECTION_STATUS
} = require('./reflection');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Promote 选项
 * @typedef {Object} PromoteOptions
 * @property {string} [name] - 自定义提案名称
 * @property {boolean} [asSingle=false] - 合并为单个提案
 * @property {boolean} [dryRun=false] - 预览模式
 */

/**
 * Promote 结果
 * @typedef {Object} PromoteResult
 * @property {boolean} success - 是否成功
 * @property {string} message - 结果消息
 * @property {Object} [data] - 相关数据
 */

// ============================================================================
// 主处理函数 (REQ-001, REQ-002)
// ============================================================================

/**
 * Promote 主处理函数
 * @param {string} projectRoot - 项目根目录
 * @param {string[]} ids - 观察或反思 ID 列表
 * @param {PromoteOptions} options - 选项
 * @returns {PromoteResult} 处理结果
 */
function handlePromote(projectRoot, ids, options = {}) {
  if (!ids || ids.length === 0) {
    return {
      success: false,
      message: '❌ 请提供要 promote 的观察或反思 ID',
      data: null
    };
  }

  const { asSingle = false } = options;

  // 批量 promote
  if (ids.length > 1 && asSingle) {
    return promoteBatch(projectRoot, ids, options);
  }

  // 单个或分别 promote
  if (ids.length === 1 || !asSingle) {
    const results = [];
    for (const id of ids) {
      const result = promoteSingle(projectRoot, id, options);
      results.push(result);
    }

    if (results.length === 1) {
      return results[0];
    }

    const successCount = results.filter(r => r.success).length;
    return {
      success: successCount > 0,
      message: `📝 Promote 完成: ${successCount}/${results.length} 成功`,
      data: { results }
    };
  }

  return { success: false, message: '❌ 未知操作', data: null };
}

/**
 * Promote 单个观察或反思
 * @param {string} projectRoot - 项目根目录
 * @param {string} id - 观察或反思 ID
 * @param {PromoteOptions} options - 选项
 * @returns {PromoteResult} 处理结果
 */
function promoteSingle(projectRoot, id, options = {}) {
  // 判断类型
  if (id.startsWith('obs-')) {
    return promoteObservation(projectRoot, id, options);
  } else if (id.startsWith('ref-')) {
    return promoteReflection(projectRoot, id, options);
  } else {
    return {
      success: false,
      message: `❌ 无法识别 ID 类型: ${id}，应以 obs- 或 ref- 开头`,
      data: null
    };
  }
}

// ============================================================================
// Promote 观察 (REQ-001)
// ============================================================================

/**
 * Promote 观察 (AC-001, AC-002, AC-003, AC-004)
 * @param {string} projectRoot - 项目根目录
 * @param {string} obsId - 观察 ID
 * @param {PromoteOptions} options - 选项
 * @returns {PromoteResult} 处理结果
 */
function promoteObservation(projectRoot, obsId, options = {}) {
  const observation = loadObservation(projectRoot, obsId);

  if (!observation) {
    return {
      success: false,
      message: `❌ 观察不存在: ${obsId}`,
      data: null
    };
  }

  // AC-002: 验证状态为 triaged
  if (observation.status !== OBSERVATION_STATUS.TRIAGED) {
    // AC-003: 拒绝其他状态
    return {
      success: false,
      message: `❌ 只能 promote triaged 状态的观察，当前状态: ${observation.status}`,
      data: null
    };
  }

  // 生成提案名称
  const proposalName = options.name || generateProposalName(observation);

  if (options.dryRun) {
    return {
      success: true,
      message: formatPreview('observation', observation, proposalName),
      data: { type: 'observation', observation, proposalName }
    };
  }

  // AC-004: 创建提案
  const proposalDir = path.join(projectRoot, 'openspec', 'changes', proposalName);
  const proposalPath = path.join(proposalDir, 'proposal.md');

  if (fs.existsSync(proposalDir)) {
    return {
      success: false,
      message: `❌ 提案目录已存在: ${proposalName}`,
      data: null
    };
  }

  // 创建目录
  fs.mkdirSync(proposalDir, { recursive: true });

  // 生成提案内容
  const proposalContent = generateProposalFromObservation(observation, proposalName);
  fs.writeFileSync(proposalPath, proposalContent, 'utf-8');

  // 更新观察状态
  const updated = transitionObs(observation, OBSERVATION_STATUS.PROMOTED);
  updated.proposal_id = proposalName;
  updated.promoted_at = new Date().toISOString();
  saveObservation(projectRoot, updated);

  return {
    success: true,
    message: `✅ 观察已 promote 为提案: ${proposalName}\n\n路径: ${proposalPath}\n\n下一步:\n- 编辑 proposal.md 完善提案\n- 运行 /mob-seed:spec create 创建规格`,
    data: { proposalName, proposalPath, observation: updated }
  };
}

// ============================================================================
// Promote 反思 (REQ-002)
// ============================================================================

/**
 * Promote 反思 (AC-005, AC-006, AC-007, AC-008)
 * @param {string} projectRoot - 项目根目录
 * @param {string} refId - 反思 ID
 * @param {PromoteOptions} options - 选项
 * @returns {PromoteResult} 处理结果
 */
function promoteReflection(projectRoot, refId, options = {}) {
  const reflection = loadReflection(projectRoot, refId);

  if (!reflection) {
    return {
      success: false,
      message: `❌ 反思不存在: ${refId}`,
      data: null
    };
  }

  // AC-006: 验证状态为 accepted
  if (reflection.status !== REFLECTION_STATUS.ACCEPTED) {
    return {
      success: false,
      message: `❌ 只能 promote accepted 状态的反思，当前状态: ${reflection.status}`,
      data: null
    };
  }

  // 生成提案名称
  const proposalName = options.name || generateProposalNameFromReflection(reflection);

  if (options.dryRun) {
    return {
      success: true,
      message: formatPreview('reflection', reflection, proposalName),
      data: { type: 'reflection', reflection, proposalName }
    };
  }

  // 创建提案
  const proposalDir = path.join(projectRoot, 'openspec', 'changes', proposalName);
  const proposalPath = path.join(proposalDir, 'proposal.md');

  if (fs.existsSync(proposalDir)) {
    return {
      success: false,
      message: `❌ 提案目录已存在: ${proposalName}`,
      data: null
    };
  }

  fs.mkdirSync(proposalDir, { recursive: true });

  // AC-007: 将建议行动转换为提案任务
  const proposalContent = generateProposalFromReflection(reflection, proposalName, projectRoot);
  fs.writeFileSync(proposalPath, proposalContent, 'utf-8');

  // 更新反思
  reflection.proposal_id = proposalName;
  saveReflection(projectRoot, reflection);

  // AC-008: 更新关联观察状态
  for (const obsId of reflection.observations) {
    const obs = loadObservation(projectRoot, obsId);
    if (obs && obs.status === OBSERVATION_STATUS.TRIAGED) {
      const updated = transitionObs(obs, OBSERVATION_STATUS.PROMOTED);
      updated.proposal_id = proposalName;
      updated.promoted_at = new Date().toISOString();
      saveObservation(projectRoot, updated);
    }
  }

  return {
    success: true,
    message: `✅ 反思已 promote 为提案: ${proposalName}\n\n路径: ${proposalPath}\n关联观察已更新: ${reflection.observations.length} 个\n\n下一步:\n- 编辑 proposal.md 完善提案\n- 运行 /mob-seed:spec create 创建规格`,
    data: { proposalName, proposalPath, reflection }
  };
}

// ============================================================================
// 批量 Promote (REQ-007)
// ============================================================================

/**
 * 批量 promote 并合并为单个提案 (AC-024, AC-025, AC-026)
 * @param {string} projectRoot - 项目根目录
 * @param {string[]} ids - ID 列表
 * @param {PromoteOptions} options - 选项
 * @returns {PromoteResult} 处理结果
 */
function promoteBatch(projectRoot, ids, options = {}) {
  const observations = [];
  const reflections = [];

  // 收集和验证
  for (const id of ids) {
    if (id.startsWith('obs-')) {
      const obs = loadObservation(projectRoot, id);
      if (!obs) {
        return { success: false, message: `❌ 观察不存在: ${id}`, data: null };
      }
      if (obs.status !== OBSERVATION_STATUS.TRIAGED) {
        return { success: false, message: `❌ 观察 ${id} 状态不是 triaged: ${obs.status}`, data: null };
      }
      observations.push(obs);
    } else if (id.startsWith('ref-')) {
      const ref = loadReflection(projectRoot, id);
      if (!ref) {
        return { success: false, message: `❌ 反思不存在: ${id}`, data: null };
      }
      if (ref.status !== REFLECTION_STATUS.ACCEPTED) {
        return { success: false, message: `❌ 反思 ${id} 状态不是 accepted: ${ref.status}`, data: null };
      }
      reflections.push(ref);
    }
  }

  // 生成提案名称
  const proposalName = options.name || generateBatchProposalName(observations, reflections);

  if (options.dryRun) {
    return {
      success: true,
      message: formatBatchPreview(observations, reflections, proposalName),
      data: { observations, reflections, proposalName }
    };
  }

  // 创建提案
  const proposalDir = path.join(projectRoot, 'openspec', 'changes', proposalName);
  const proposalPath = path.join(proposalDir, 'proposal.md');

  if (fs.existsSync(proposalDir)) {
    return {
      success: false,
      message: `❌ 提案目录已存在: ${proposalName}`,
      data: null
    };
  }

  fs.mkdirSync(proposalDir, { recursive: true });

  // 生成合并提案内容
  const proposalContent = generateBatchProposal(observations, reflections, proposalName);
  fs.writeFileSync(proposalPath, proposalContent, 'utf-8');

  // 更新观察状态
  for (const obs of observations) {
    const updated = transitionObs(obs, OBSERVATION_STATUS.PROMOTED);
    updated.proposal_id = proposalName;
    updated.promoted_at = new Date().toISOString();
    saveObservation(projectRoot, updated);
  }

  // 更新反思和关联观察
  for (const ref of reflections) {
    ref.proposal_id = proposalName;
    saveReflection(projectRoot, ref);

    for (const obsId of ref.observations) {
      const obs = loadObservation(projectRoot, obsId);
      if (obs && obs.status === OBSERVATION_STATUS.TRIAGED) {
        const updated = transitionObs(obs, OBSERVATION_STATUS.PROMOTED);
        updated.proposal_id = proposalName;
        updated.promoted_at = new Date().toISOString();
        saveObservation(projectRoot, updated);
      }
    }
  }

  return {
    success: true,
    message: `✅ 批量 promote 完成: ${proposalName}\n\n观察: ${observations.length} 个\n反思: ${reflections.length} 个\n路径: ${proposalPath}`,
    data: { proposalName, proposalPath, observations, reflections }
  };
}

// ============================================================================
// 提案模板生成 (REQ-003)
// ============================================================================

/**
 * 从观察生成提案内容 (AC-009, AC-010, AC-011, AC-012)
 * @param {Object} observation - 观察对象
 * @param {string} proposalName - 提案名称
 * @returns {string} 提案 Markdown 内容
 */
function generateProposalFromObservation(observation, proposalName) {
  const now = new Date().toISOString();
  const lines = [];

  // Frontmatter (AC-017, AC-018)
  lines.push('---');
  lines.push(`status: draft`);
  lines.push(`created: ${now}`);
  lines.push(`source:`);
  lines.push(`  type: observation`);
  lines.push(`  id: ${observation.id}`);
  lines.push(`  created: ${observation.created}`);
  lines.push('---');
  lines.push('');

  // 标题
  lines.push(`# ${formatProposalTitle(proposalName)}`);
  lines.push('');
  lines.push('> **状态**: draft');
  lines.push('> **版本**: 1.0.0');
  lines.push(`> **创建**: ${now.slice(0, 10)}`);
  lines.push(`> **来源**: ${observation.id}`);
  lines.push('');

  // 概述 (AC-010)
  lines.push('## 概述');
  lines.push('');
  lines.push(observation.description || '待填写');
  lines.push('');

  // 来源追溯 (AC-011)
  lines.push('## 来源追溯');
  lines.push('');
  lines.push('本提案源自以下观察：');
  lines.push('');
  lines.push('| ID | 类型 | 描述 | 创建时间 |');
  lines.push('|----|------|------|---------|');
  lines.push(`| ${observation.id} | ${observation.type} | ${observation.description || '-'} | ${observation.created.slice(0, 10)} |`);
  lines.push('');

  // 问题分析
  lines.push('## 问题分析');
  lines.push('');
  if (observation.context) {
    if (observation.context.error) {
      lines.push(`**错误信息**: ${observation.context.error}`);
    }
    if (observation.context.file) {
      lines.push(`**相关文件**: ${observation.context.file}`);
    }
    if (observation.context.test) {
      lines.push(`**相关测试**: ${observation.context.test}`);
    }
    lines.push('');
  }
  lines.push('待分析...');
  lines.push('');

  // 建议方案
  lines.push('## 建议方案');
  lines.push('');
  if (observation.suggestion) {
    lines.push(observation.suggestion);
  } else {
    lines.push('待制定...');
  }
  lines.push('');

  // 实施阶段 (AC-012)
  lines.push('## 实施阶段');
  lines.push('');
  lines.push('### Phase 1: 修复');
  lines.push('');
  lines.push('- [ ] 分析问题根因');
  lines.push('- [ ] 制定修复方案');
  lines.push('- [ ] 实施修复');
  lines.push('- [ ] 验证修复');
  lines.push('');

  // 影响范围
  lines.push('## 影响范围');
  lines.push('');
  if (observation.spec || observation.related_spec) {
    lines.push(`- 规格: ${observation.spec || observation.related_spec}`);
  }
  if (observation.context?.file) {
    lines.push(`- 模块: ${observation.context.file}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * 从反思生成提案内容
 * @param {Object} reflection - 反思对象
 * @param {string} proposalName - 提案名称
 * @param {string} projectRoot - 项目根目录
 * @returns {string} 提案 Markdown 内容
 */
function generateProposalFromReflection(reflection, proposalName, projectRoot) {
  const now = new Date().toISOString();
  const lines = [];

  // Frontmatter
  lines.push('---');
  lines.push(`status: draft`);
  lines.push(`created: ${now}`);
  lines.push(`source:`);
  lines.push(`  type: reflection`);
  lines.push(`  id: ${reflection.id}`);
  lines.push(`  created: ${reflection.created}`);
  lines.push('---');
  lines.push('');

  // 标题
  lines.push(`# ${formatProposalTitle(proposalName)}`);
  lines.push('');
  lines.push('> **状态**: draft');
  lines.push('> **版本**: 1.0.0');
  lines.push(`> **创建**: ${now.slice(0, 10)}`);
  lines.push(`> **来源**: ${reflection.id}`);
  lines.push('');

  // 概述
  lines.push('## 概述');
  lines.push('');
  lines.push(reflection.lesson);
  lines.push('');

  // 来源追溯
  lines.push('## 来源追溯');
  lines.push('');
  lines.push('本提案源自以下反思和观察：');
  lines.push('');
  lines.push(`**反思**: ${reflection.id} (${getPatternLabel(reflection.pattern)})`);
  lines.push('');
  lines.push('**关联观察**:');
  lines.push('');
  lines.push('| ID | 类型 | 描述 | 创建时间 |');
  lines.push('|----|------|------|---------|');

  for (const obsId of reflection.observations) {
    const obs = loadObservation(projectRoot, obsId);
    if (obs) {
      lines.push(`| ${obs.id} | ${obs.type} | ${obs.description || '-'} | ${obs.created.slice(0, 10)} |`);
    } else {
      lines.push(`| ${obsId} | - | - | - |`);
    }
  }
  lines.push('');

  // 问题分析
  lines.push('## 问题分析');
  lines.push('');
  if (reflection.analysis) {
    lines.push(reflection.analysis);
  } else {
    lines.push('待分析...');
  }
  lines.push('');

  // 建议方案
  lines.push('## 建议方案');
  lines.push('');
  if (reflection.suggestedActions && reflection.suggestedActions.length > 0) {
    reflection.suggestedActions.forEach((action, i) => {
      lines.push(`${i + 1}. ${action}`);
    });
  } else {
    lines.push('待制定...');
  }
  lines.push('');

  // 实施阶段（从建议行动转换）
  lines.push('## 实施阶段');
  lines.push('');
  lines.push('### Phase 1: 实施');
  lines.push('');
  if (reflection.suggestedActions && reflection.suggestedActions.length > 0) {
    reflection.suggestedActions.forEach(action => {
      lines.push(`- [ ] ${action}`);
    });
  } else {
    lines.push('- [ ] 待规划...');
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * 生成批量提案内容
 * @param {Object[]} observations - 观察列表
 * @param {Object[]} reflections - 反思列表
 * @param {string} proposalName - 提案名称
 * @returns {string} 提案内容
 */
function generateBatchProposal(observations, reflections, proposalName) {
  const now = new Date().toISOString();
  const lines = [];

  // Frontmatter
  lines.push('---');
  lines.push(`status: draft`);
  lines.push(`created: ${now}`);
  lines.push(`sources:`);
  observations.forEach(obs => {
    lines.push(`  - type: observation`);
    lines.push(`    id: ${obs.id}`);
  });
  reflections.forEach(ref => {
    lines.push(`  - type: reflection`);
    lines.push(`    id: ${ref.id}`);
  });
  lines.push('---');
  lines.push('');

  // 标题
  lines.push(`# ${formatProposalTitle(proposalName)}`);
  lines.push('');
  lines.push('> **状态**: draft');
  lines.push('> **版本**: 1.0.0');
  lines.push(`> **创建**: ${now.slice(0, 10)}`);
  lines.push('');

  // 概述
  lines.push('## 概述');
  lines.push('');
  lines.push(`本提案整合了 ${observations.length} 个观察和 ${reflections.length} 个反思的内容。`);
  lines.push('');

  // 来源追溯
  lines.push('## 来源追溯');
  lines.push('');
  if (observations.length > 0) {
    lines.push('### 观察');
    lines.push('');
    lines.push('| ID | 类型 | 描述 |');
    lines.push('|----|------|------|');
    observations.forEach(obs => {
      lines.push(`| ${obs.id} | ${obs.type} | ${obs.description || '-'} |`);
    });
    lines.push('');
  }

  if (reflections.length > 0) {
    lines.push('### 反思');
    lines.push('');
    reflections.forEach(ref => {
      lines.push(`**${ref.id}** (${getPatternLabel(ref.pattern)})`);
      lines.push(`- 教训: ${ref.lesson}`);
      lines.push('');
    });
  }

  // 实施阶段
  lines.push('## 实施阶段');
  lines.push('');
  lines.push('### Phase 1: 实施');
  lines.push('');
  lines.push('- [ ] 待规划...');
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 生成提案名称
 * @param {Object} observation - 观察对象
 * @returns {string} 提案名称
 */
function generateProposalName(observation) {
  const prefix = getTypePrefix(observation.type);
  const date = new Date().toISOString().slice(0, 10);

  // 从描述生成 slug
  const slug = (observation.description || 'fix')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);

  return `${prefix}-${slug}`;
}

/**
 * 从反思生成提案名称
 * @param {Object} reflection - 反思对象
 * @returns {string} 提案名称
 */
function generateProposalNameFromReflection(reflection) {
  const prefix = 'enhance';
  const slug = (reflection.lesson || 'improvement')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);

  return `${prefix}-${slug}`;
}

/**
 * 生成批量提案名称
 * @param {Object[]} observations - 观察列表
 * @param {Object[]} reflections - 反思列表
 * @returns {string} 提案名称
 */
function generateBatchProposalName(observations, reflections) {
  const date = new Date().toISOString().slice(0, 10);
  const count = observations.length + reflections.length;
  return `batch-${count}-items-${date.replace(/-/g, '')}`;
}

/**
 * 获取类型前缀
 * @param {string} type - 观察类型
 * @returns {string} 前缀
 */
function getTypePrefix(type) {
  const prefixes = {
    test_failure: 'fix',
    spec_drift: 'align',
    coverage_gap: 'cover',
    user_feedback: 'improve',
    runtime_error: 'fix',
    performance: 'perf'
  };
  return prefixes[type] || 'change';
}

/**
 * 格式化提案标题
 * @param {string} name - 提案名称
 * @returns {string} 标题
 */
function formatProposalTitle(name) {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * 获取模式标签
 * @param {string} pattern - 模式类型
 * @returns {string} 标签
 */
function getPatternLabel(pattern) {
  const labels = {
    type_aggregation: '类型聚合',
    spec_aggregation: '规格聚合',
    time_clustering: '时间聚类',
    keyword_similarity: '关键词相似',
    manual: '手动创建'
  };
  return labels[pattern] || pattern;
}

/**
 * 格式化预览
 * @param {string} type - 类型
 * @param {Object} item - 观察或反思
 * @param {string} proposalName - 提案名称
 * @returns {string} 预览消息
 */
function formatPreview(type, item, proposalName) {
  const lines = [];

  if (type === 'observation') {
    lines.push(`📌 准备 Promote 观察 ${item.id}`);
    lines.push('');
    lines.push(`类型: ${item.type}`);
    lines.push(`描述: ${item.description || '-'}`);
    if (item.suggestion) {
      lines.push(`建议: ${item.suggestion}`);
    }
  } else {
    lines.push(`📌 准备 Promote 反思 ${item.id}`);
    lines.push('');
    lines.push(`模式: ${getPatternLabel(item.pattern)}`);
    lines.push(`教训: ${item.lesson}`);
    lines.push(`关联观察: ${item.observations.length} 个`);
  }

  lines.push('');
  lines.push(`提案名称: ${proposalName}`);
  lines.push('');
  lines.push('使用 --name 自定义名称');
  lines.push('移除 --dry-run 确认创建');

  return lines.join('\n');
}

/**
 * 格式化批量预览
 * @param {Object[]} observations - 观察列表
 * @param {Object[]} reflections - 反思列表
 * @param {string} proposalName - 提案名称
 * @returns {string} 预览消息
 */
function formatBatchPreview(observations, reflections, proposalName) {
  const lines = [];

  lines.push(`📌 准备批量 Promote`);
  lines.push('');
  lines.push(`观察: ${observations.length} 个`);
  observations.forEach(obs => {
    lines.push(`  - ${obs.id}: ${obs.description || '-'}`);
  });
  lines.push(`反思: ${reflections.length} 个`);
  reflections.forEach(ref => {
    lines.push(`  - ${ref.id}: ${ref.lesson}`);
  });
  lines.push('');
  lines.push(`提案名称: ${proposalName}`);
  lines.push('');
  lines.push('使用 --name 自定义名称');
  lines.push('移除 --dry-run 确认创建');

  return lines.join('\n');
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 主处理函数
  handlePromote,

  // 单独操作
  promoteObservation,
  promoteReflection,
  promoteBatch,
  promoteSingle,

  // 模板生成
  generateProposalFromObservation,
  generateProposalFromReflection,
  generateBatchProposal,

  // 辅助函数
  generateProposalName,
  generateProposalNameFromReflection,
  formatProposalTitle,
  getPatternLabel
};
