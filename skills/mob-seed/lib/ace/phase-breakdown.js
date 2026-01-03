/**
 * 实施阶段分解
 * @module ace/phase-breakdown
 * @see openspec/changes/v3.0-ace-integration/specs/ace/auto-propose.fspec.md
 *
 * 实现 REQ-002: 实施阶段分解 (AC-005 ~ AC-008)
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 实施阶段
 * @typedef {Object} Phase
 * @property {string} name - 阶段名称
 * @property {string[]} tasks - 任务列表
 */

// ============================================================================
// Phase 识别规则
// ============================================================================

/**
 * Phase 标记正则表达式
 * 支持格式:
 * - "Phase 1: 标题"
 * - "Phase1: 标题"
 * - "阶段 1: 标题"
 * - "阶段1: 标题"
 * - "Step 1: 标题"
 * - "Step1: 标题"
 * - "1. Phase: 标题" (numbered list)
 */
const PHASE_MARKERS = [
  /^Phase\s*(\d+)\s*[:：]\s*(.+)$/i,
  /^阶段\s*(\d+)\s*[:：]\s*(.+)$/,
  /^Step\s*(\d+)\s*[:：]\s*(.+)$/i,
  /^(\d+)\.\s*Phase\s*[:：]?\s*(.+)$/i,
  /^(\d+)\.\s*阶段\s*[:：]?\s*(.+)$/,
  /^(\d+)\.\s*Step\s*[:：]?\s*(.+)$/i
];

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 检查是否为 Phase 标记 (AC-005)
 * @param {string} action - 行动描述
 * @returns {boolean}
 */
function isPhaseMarker(action) {
  if (!action || typeof action !== 'string') {
    return false;
  }

  const trimmed = action.trim();
  return PHASE_MARKERS.some(regex => regex.test(trimmed));
}

/**
 * 提取 Phase 名称
 * @param {string} action - 行动描述
 * @returns {{number: number, name: string} | null}
 */
function extractPhaseInfo(action) {
  if (!action || typeof action !== 'string') {
    return null;
  }

  const trimmed = action.trim();

  for (const regex of PHASE_MARKERS) {
    const match = trimmed.match(regex);
    if (match) {
      return {
        number: parseInt(match[1], 10),
        name: match[2].trim()
      };
    }
  }

  return null;
}

/**
 * 将建议行动分解为实施阶段 (AC-006, AC-007, AC-008)
 * @param {string[]} suggestedActions - 建议行动列表
 * @returns {Phase[]}
 */
function breakdownToPhases(suggestedActions) {
  if (!Array.isArray(suggestedActions) || suggestedActions.length === 0) {
    return [];
  }

  const phases = [];
  let currentPhase = { name: '', tasks: [] };
  let hasExplicitPhases = false;

  for (const action of suggestedActions) {
    if (!action || typeof action !== 'string') {
      continue;
    }

    const trimmed = action.trim();

    if (isPhaseMarker(trimmed)) {
      hasExplicitPhases = true;

      // 保存之前的阶段
      if (currentPhase.tasks.length > 0 || currentPhase.name) {
        phases.push({ ...currentPhase });
      }

      // 开始新阶段
      const info = extractPhaseInfo(trimmed);
      currentPhase = {
        name: info ? info.name : trimmed,
        tasks: []
      };
    } else {
      // 添加任务到当前阶段
      currentPhase.tasks.push(trimmed);
    }
  }

  // 保存最后一个阶段
  if (currentPhase.tasks.length > 0 || currentPhase.name) {
    phases.push(currentPhase);
  }

  // AC-007: 如果没有 Phase 标记，创建默认 Phase
  if (!hasExplicitPhases && phases.length > 0) {
    // 所有任务都在一个默认阶段中
    return [{
      name: '实施',
      tasks: suggestedActions.filter(a => a && typeof a === 'string').map(a => a.trim())
    }];
  }

  // 过滤掉空的阶段
  return phases.filter(p => p.tasks.length > 0 || p.name);
}

/**
 * 将阶段格式化为 Markdown
 * @param {Phase[]} phases - 阶段列表
 * @returns {string}
 */
function formatPhasesAsMarkdown(phases) {
  if (!phases || phases.length === 0) {
    return '';
  }

  const lines = [];

  phases.forEach((phase, index) => {
    lines.push(`### Phase ${index + 1}: ${phase.name}`);
    lines.push('');

    for (const task of phase.tasks) {
      lines.push(`- [ ] ${task}`);
    }

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * 从文本中提取任务列表
 * @param {string} text - 文本内容（可能包含 Markdown 列表）
 * @returns {string[]}
 */
function extractTasksFromText(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const tasks = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // 匹配 Markdown 列表项
    const listMatch = trimmed.match(/^[-*+]\s*(\[.\])?\s*(.+)$/);
    if (listMatch) {
      tasks.push(listMatch[2].trim());
      continue;
    }

    // 匹配数字列表项
    const numMatch = trimmed.match(/^\d+[.)]\s*(.+)$/);
    if (numMatch) {
      tasks.push(numMatch[1].trim());
    }
  }

  return tasks;
}

/**
 * 合并多个阶段（去重）
 * @param {Phase[]} phases - 阶段列表
 * @returns {Phase[]}
 */
function mergePhases(phases) {
  const merged = new Map();

  for (const phase of phases) {
    const existing = merged.get(phase.name);
    if (existing) {
      // 合并任务，去重
      const taskSet = new Set([...existing.tasks, ...phase.tasks]);
      existing.tasks = Array.from(taskSet);
    } else {
      merged.set(phase.name, { ...phase, tasks: [...phase.tasks] });
    }
  }

  return Array.from(merged.values());
}

/**
 * 估算阶段工作量
 * @param {Phase} phase - 阶段
 * @returns {{level: string, reason: string}}
 */
function estimatePhaseEffort(phase) {
  const taskCount = phase.tasks.length;

  if (taskCount <= 2) {
    return { level: 'small', reason: `${taskCount} 个任务` };
  } else if (taskCount <= 5) {
    return { level: 'medium', reason: `${taskCount} 个任务` };
  } else {
    return { level: 'large', reason: `${taskCount} 个任务` };
  }
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 核心函数
  isPhaseMarker,
  extractPhaseInfo,
  breakdownToPhases,

  // 辅助函数
  formatPhasesAsMarkdown,
  extractTasksFromText,
  mergePhases,
  estimatePhaseEffort,

  // 常量
  PHASE_MARKERS
};
