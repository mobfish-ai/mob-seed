/**
 * 任务生成器
 * @module spec/task-generator
 * @see openspec/changes/v3.0-ace-integration/specs/ace/task-generation.fspec.md
 *
 * 从 Proposal 自动派生 tasks.md
 */

const fs = require('fs');
const path = require('path');
const { parseProposalFile, getFspecStatus } = require('./proposal-parser');
const { canTransitionToImplementing, generateBlockMessage } = require('./proposal-validator');

// ============================================================================
// 状态映射 (REQ-004)
// ============================================================================

/**
 * fspec 状态到任务状态的映射 (AC-012, AC-013)
 */
const STATUS_MAP = {
  draft: { icon: ':hourglass:', label: 'pending' },
  review: { icon: ':mag:', label: 'reviewing' },
  implementing: { icon: ':hammer:', label: 'in_progress' },
  archived: { icon: ':white_check_mark:', label: 'completed' }
};

/**
 * 获取任务状态显示
 * @param {string} fspecStatus - fspec 状态
 * @returns {{icon: string, label: string}} 显示配置
 */
function getTaskStatus(fspecStatus) {
  return STATUS_MAP[fspecStatus] || STATUS_MAP.draft;
}

// ============================================================================
// 任务生成 (REQ-001, REQ-003)
// ============================================================================

/**
 * 生成 tasks.md 内容 (AC-008, AC-009, AC-010, AC-011)
 * @param {Object} parseResult - 解析结果
 * @param {string} proposalName - 提案名称
 * @param {string} [projectRoot] - 项目根目录（用于获取 fspec 状态）
 * @returns {string} tasks.md 内容
 */
function generateTasksContent(parseResult, proposalName, projectRoot) {
  const lines = [];

  // YAML frontmatter (AC-008)
  lines.push('---');
  lines.push(`proposal: ${proposalName}`);
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('source: proposal.md');
  lines.push('---');
  lines.push('');

  // 标题和警告 (AC-009)
  lines.push('# 任务清单');
  lines.push('');
  lines.push('> 此文件由系统自动生成，请勿手动编辑。');
  lines.push('> 源文件: proposal.md');
  lines.push('');

  // 生成各阶段
  for (const phase of parseResult.phases) {
    lines.push(`## Phase ${phase.number}: ${phase.name}`);
    lines.push('');

    // 任务表格 (AC-010)
    lines.push('| 任务 | 规格 | 状态 |');
    lines.push('|------|------|------|');

    for (const task of phase.tasks) {
      // 获取 fspec 状态
      let status = STATUS_MAP.draft;
      if (task.specs.length > 0 && projectRoot) {
        const fspecStatus = getFspecStatus(projectRoot, task.specs[0]);
        status = getTaskStatus(fspecStatus);
      } else if (task.completed) {
        status = STATUS_MAP.archived;
      }

      const specName = task.specs.length > 0 ? task.specs[0] : '-';
      lines.push(`| ${task.id} ${task.name} | ${specName} | ${status.icon} ${status.label} |`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');

    // 任务详情 (AC-011)
    for (const task of phase.tasks) {
      lines.push(`### 任务 ${task.id}: ${task.name}`);
      lines.push('');

      if (task.specs.length > 0) {
        lines.push(`**关联规格**: \`${task.specs[0]}\``);
        lines.push('');
      }

      // AC 子任务
      if (task.subtasks.length > 0) {
        lines.push('**Acceptance Criteria**:');
        for (const subtask of task.subtasks) {
          const checkbox = subtask.completed ? '[x]' : '[ ]';
          lines.push(`- ${checkbox} ${subtask.id}: ${subtask.description}`);
        }
        lines.push('');
      }

      // 派生产物
      if (task.derivedOutputs.length > 0) {
        lines.push('**派生产物**:');
        for (const output of task.derivedOutputs) {
          lines.push(`- \`${output}\``);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * 从 Proposal 生成 tasks.md (AC-001, AC-002, AC-003)
 * @param {string} projectRoot - 项目根目录
 * @param {string} proposalName - 提案名称
 * @param {Object} options - 选项
 * @param {boolean} options.skipValidation - 跳过验证（默认 false）
 * @returns {{success: boolean, path?: string, error?: string, validationResult?: Object}} 生成结果
 */
function generateTasksFromProposal(projectRoot, proposalName, options = {}) {
  const { skipValidation = false } = options;
  const proposalDir = path.join(projectRoot, 'openspec', 'changes', proposalName);
  const proposalPath = path.join(proposalDir, 'proposal.md');
  const tasksPath = path.join(proposalDir, 'tasks.md');
  const specsDir = path.join(proposalDir, 'specs');

  // 检查 proposal.md 存在
  if (!fs.existsSync(proposalPath)) {
    return {
      success: false,
      error: `Proposal 文件不存在: ${proposalPath}`
    };
  }

  // P0 修复: 验证提案完整性 (review → implementing 状态转换)
  // @see proposal-validation.fspec.md
  if (!skipValidation) {
    const { allowed, result } = canTransitionToImplementing(proposalPath, { specsDir });

    if (!allowed) {
      return {
        success: false,
        blocked: true,
        error: generateBlockMessage(result),
        validationResult: result
      };
    }
  }

  try {
    // 解析 Proposal
    const parseResult = parseProposalFile(proposalPath);

    // 如果没有解析到任何阶段，返回错误
    if (parseResult.phases.length === 0) {
      return {
        success: false,
        error: '未能从 Proposal 中解析出任何阶段/任务'
      };
    }

    // 生成 tasks.md 内容
    const content = generateTasksContent(parseResult, proposalName, projectRoot);

    // 写入文件 (AC-002, AC-003 - 覆盖更新)
    fs.writeFileSync(tasksPath, content, 'utf-8');

    return {
      success: true,
      path: tasksPath,
      stats: {
        phases: parseResult.phases.length,
        tasks: parseResult.phases.reduce((sum, p) => sum + p.tasks.length, 0)
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 更新 tasks.md 中的任务状态 (AC-012, AC-013, AC-014)
 * @param {string} projectRoot - 项目根目录
 * @param {string} proposalName - 提案名称
 * @param {Object} options - 选项
 * @param {boolean} options.skipValidation - 跳过验证（默认 false）
 * @returns {{success: boolean, updated?: number, error?: string}} 更新结果
 */
function updateTasksStatus(projectRoot, proposalName, options = {}) {
  const proposalDir = path.join(projectRoot, 'openspec', 'changes', proposalName);
  const tasksPath = path.join(proposalDir, 'tasks.md');

  if (!fs.existsSync(tasksPath)) {
    return {
      success: false,
      error: 'tasks.md 不存在'
    };
  }

  // 重新生成以更新状态
  return generateTasksFromProposal(projectRoot, proposalName, options);
}

// ============================================================================
// 进度统计 (REQ-005)
// ============================================================================

/**
 * 计算阶段进度 (AC-015)
 * @param {Object} phase - 阶段对象
 * @param {string} projectRoot - 项目根目录
 * @returns {{completed: number, total: number, percentage: number}} 进度统计
 */
function calculatePhaseProgress(phase, projectRoot) {
  let completed = 0;
  const total = phase.tasks.length;

  for (const task of phase.tasks) {
    if (task.completed) {
      completed++;
    } else if (task.specs.length > 0 && projectRoot) {
      const status = getFspecStatus(projectRoot, task.specs[0]);
      if (status === 'archived') {
        completed++;
      }
    }
  }

  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

/**
 * 生成进度条 (AC-016)
 * @param {number} percentage - 百分比
 * @param {number} [width=20] - 进度条宽度
 * @returns {string} 进度条字符串
 */
function generateProgressBar(percentage, width = 20) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * 获取任务进度摘要 (AC-015, AC-016, AC-017)
 * @param {string} projectRoot - 项目根目录
 * @param {string} proposalName - 提案名称
 * @returns {Object} 进度摘要
 */
function getTaskProgress(projectRoot, proposalName) {
  const proposalDir = path.join(projectRoot, 'openspec', 'changes', proposalName);
  const proposalPath = path.join(proposalDir, 'proposal.md');

  if (!fs.existsSync(proposalPath)) {
    return null;
  }

  try {
    const parseResult = parseProposalFile(proposalPath);
    const phaseProgress = [];
    let totalCompleted = 0;
    let totalTasks = 0;

    for (const phase of parseResult.phases) {
      const progress = calculatePhaseProgress(phase, projectRoot);
      phaseProgress.push({
        name: phase.name,
        number: phase.number,
        ...progress,
        bar: generateProgressBar(progress.percentage)
      });
      totalCompleted += progress.completed;
      totalTasks += progress.total;
    }

    const overallPercentage = totalTasks > 0
      ? Math.round((totalCompleted / totalTasks) * 100)
      : 0;

    return {
      proposalName,
      phases: phaseProgress,
      overall: {
        completed: totalCompleted,
        total: totalTasks,
        percentage: overallPercentage,
        bar: generateProgressBar(overallPercentage)
      }
    };
  } catch (error) {
    return null;
  }
}

/**
 * 格式化进度输出 (AC-017)
 * @param {Object} progress - 进度摘要
 * @returns {string} 格式化输出
 */
function formatProgress(progress) {
  if (!progress) return '📋 暂无任务进度';

  const lines = ['📋 任务进度'];

  for (const phase of progress.phases) {
    lines.push(`  Phase ${phase.number}: [${phase.bar}] ${phase.percentage}% (${phase.completed}/${phase.total})`);
  }

  lines.push(`  总进度:  [${progress.overall.bar}] ${progress.overall.percentage}% (${progress.overall.completed}/${progress.overall.total})`);

  return lines.join('\n');
}

module.exports = {
  // 状态映射
  STATUS_MAP,
  getTaskStatus,

  // 任务生成
  generateTasksContent,
  generateTasksFromProposal,
  updateTasksStatus,

  // 进度统计
  calculatePhaseProgress,
  generateProgressBar,
  getTaskProgress,
  formatProgress
};
