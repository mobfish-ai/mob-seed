/**
 * Flow Router (工作流路由)
 *
 * 根据 Complexity Router 的评分结果，执行对应的工作流（Quick/Standard/Full）。
 *
 * @see openspec/changes/v2.0-seed-complete/specs/workflow/flow-router.fspec.md
 * @module lib/workflow/flow-router
 * @version 1.0.0
 */

'use strict';

/**
 * 工作流阶段定义
 */
const FLOW_STAGES = {
  quick: ['understand', 'implement', 'verify'],
  standard: ['analyze', 'design', 'implement', 'test', 'document'],
  full: ['research', 'spec', 'design', 'implement', 'test', 'document', 'review']
};

/**
 * 生成工作流 ID
 * @returns {string} 唯一的工作流 ID
 */
function generateFlowId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `flow-${timestamp}-${random}`;
}

/**
 * 执行工作流
 *
 * @param {string} flowType - 工作流类型 (quick/standard/full)
 * @param {Object} taskContext - 任务上下文
 * @returns {Promise<Object>} 执行结果
 */
async function executeFlow(flowType, taskContext) {
  switch (flowType) {
    case 'quick':
      return executeQuickFlow(taskContext);
    case 'standard':
      return executeStandardFlow(taskContext);
    case 'full':
      return executeFullFlow(taskContext);
    default:
      throw new Error(`Unknown flow type: ${flowType}`);
  }
}

/**
 * 创建流程执行结果
 * @param {string} flowType - 工作流类型
 * @param {Object} taskContext - 任务上下文
 * @returns {Object} 流程结果
 */
function createFlowResult(flowType, taskContext) {
  const flowId = generateFlowId();
  const stages = FLOW_STAGES[flowType];
  const baseDir = taskContext.baseDir || '.';

  const state = {
    flowType,
    flowId,
    currentStage: stages[0],
    completedStages: [],
    skippedStages: [],
    skipReasons: {},
    startTime: new Date().toISOString(),
    task: taskContext.task || ''
  };

  saveFlowState(flowId, state, baseDir);

  return {
    flowType,
    flowId,
    stages: stages.map((name, index) => ({ name, index, status: index === 0 ? 'current' : 'pending' })),
    currentStage: stages[0],
    startTime: state.startTime
  };
}

/**
 * 执行 Quick Flow
 *
 * @see REQ-001 AC-001: 总耗时 < 30分钟
 * @see REQ-001 AC-002: 无需创建 .fspec.md 文件
 *
 * @param {Object} taskContext - 任务上下文
 * @returns {Promise<Object>} 执行结果
 */
async function executeQuickFlow(taskContext) {
  return createFlowResult('quick', taskContext);
}

/**
 * 执行 Standard Flow
 *
 * @see REQ-002 AC-004: 总耗时 2-4小时
 * @see REQ-002 AC-005: 创建简化版 tasks.md
 *
 * @param {Object} taskContext - 任务上下文
 * @returns {Promise<Object>} 执行结果
 */
async function executeStandardFlow(taskContext) {
  return createFlowResult('standard', taskContext);
}

/**
 * 执行 Full Flow
 *
 * @see REQ-003 AC-007: 支持多日开发
 * @see REQ-003 AC-008: 完整的 fspec 生命周期
 *
 * @param {Object} taskContext - 任务上下文
 * @returns {Promise<Object>} 执行结果
 */
async function executeFullFlow(taskContext) {
  return createFlowResult('full', taskContext);
}

/**
 * 获取状态文件路径
 * @param {string} baseDir - 基础目录
 * @returns {string} 状态文件路径
 */
function getStateFilePath(baseDir) {
  const fs = require('fs');
  const path = require('path');
  const stateDir = path.join(baseDir, '.seed');
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  return path.join(stateDir, 'flow-state.json');
}

/**
 * 读取所有流程状态
 * @param {string} baseDir - 基础目录
 * @returns {Object} 所有流程状态
 */
function readAllStates(baseDir) {
  const fs = require('fs');
  const stateFile = getStateFilePath(baseDir);
  if (!fs.existsSync(stateFile)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  } catch (e) {
    return {};
  }
}

/**
 * 写入所有流程状态
 * @param {Object} states - 状态对象
 * @param {string} baseDir - 基础目录
 */
function writeAllStates(states, baseDir) {
  const fs = require('fs');
  const stateFile = getStateFilePath(baseDir);
  fs.writeFileSync(stateFile, JSON.stringify(states, null, 2));
}

/**
 * 保存工作流状态
 *
 * @see REQ-004 AC-011: 记录每阶段开始/结束时间
 *
 * @param {string} flowId - 工作流 ID
 * @param {Object} state - 状态对象
 * @param {string} baseDir - 基础目录
 */
function saveFlowState(flowId, state, baseDir = '.') {
  const states = readAllStates(baseDir);
  states[flowId] = { ...state, updatedAt: new Date().toISOString() };
  writeAllStates(states, baseDir);
}

/**
 * 加载工作流状态
 *
 * @param {string} flowId - 工作流 ID
 * @param {string} baseDir - 基础目录
 * @returns {Object|null} 状态对象或 null
 */
function loadFlowState(flowId, baseDir = '.') {
  const states = readAllStates(baseDir);
  return states[flowId] || null;
}

/**
 * 获取当前阶段
 *
 * @see REQ-004 AC-010: 支持会话中断恢复
 *
 * @param {string} flowId - 工作流 ID
 * @param {string} baseDir - 基础目录
 * @returns {Object|null} 当前阶段信息
 */
function getCurrentStage(flowId, baseDir = '.') {
  const state = loadFlowState(flowId, baseDir);
  if (!state) return null;

  const stages = FLOW_STAGES[state.flowType];
  const index = stages.indexOf(state.currentStage);

  return {
    name: state.currentStage,
    index,
    flowType: state.flowType
  };
}

/**
 * 推进到下一阶段
 *
 * @see REQ-005 AC-013: 默认顺序执行
 *
 * @param {string} flowId - 工作流 ID
 * @param {string} baseDir - 基础目录
 * @returns {Object} 新阶段信息
 */
function advanceStage(flowId, baseDir = '.') {
  const state = loadFlowState(flowId, baseDir);
  if (!state) throw new Error(`Flow not found: ${flowId}`);

  const stages = FLOW_STAGES[state.flowType];
  const currentIndex = stages.indexOf(state.currentStage);

  // 将当前阶段标记为完成
  if (!state.completedStages.includes(state.currentStage)) {
    state.completedStages.push(state.currentStage);
  }

  // 检查是否是最后一个阶段
  if (currentIndex >= stages.length - 1) {
    state.currentStage = null;
    state.completed = true;
    state.completedAt = new Date().toISOString();
    saveFlowState(flowId, state, baseDir);
    return { completed: true, name: null, index: -1 };
  }

  // 推进到下一阶段
  const nextStage = stages[currentIndex + 1];
  state.currentStage = nextStage;
  saveFlowState(flowId, state, baseDir);

  return {
    name: nextStage,
    index: currentIndex + 1,
    completed: false
  };
}

/**
 * 回退到指定阶段
 *
 * @see REQ-005 AC-015: 回退时保留原有产物
 *
 * @param {string} flowId - 工作流 ID
 * @param {string} targetStage - 目标阶段
 * @param {string} baseDir - 基础目录
 * @returns {Object} 阶段信息
 */
function revertStage(flowId, targetStage, baseDir = '.') {
  const state = loadFlowState(flowId, baseDir);
  if (!state) throw new Error(`Flow not found: ${flowId}`);

  const stages = FLOW_STAGES[state.flowType];
  const targetIndex = stages.indexOf(targetStage);

  if (targetIndex < 0) {
    throw new Error(`Invalid stage: ${targetStage}`);
  }

  // 保留目标阶段之前的已完成阶段
  state.completedStages = state.completedStages.filter(s => stages.indexOf(s) < targetIndex);
  state.currentStage = targetStage;
  state.completed = false;

  saveFlowState(flowId, state, baseDir);

  return {
    name: targetStage,
    index: targetIndex
  };
}

/**
 * 跳过阶段
 *
 * @see REQ-005 AC-014: 支持 --skip-stage 参数
 *
 * @param {string} flowId - 工作流 ID
 * @param {string} stageName - 要跳过的阶段
 * @param {string} reason - 跳过原因
 * @param {string} baseDir - 基础目录
 */
function skipStage(flowId, stageName, reason, baseDir = '.') {
  const state = loadFlowState(flowId, baseDir);
  if (!state) throw new Error(`Flow not found: ${flowId}`);

  if (!state.skippedStages) state.skippedStages = [];
  if (!state.skipReasons) state.skipReasons = {};

  state.skippedStages.push(stageName);
  state.skipReasons[stageName] = reason;

  // 如果跳过的是当前阶段，推进到下一阶段
  if (state.currentStage === stageName) {
    const stages = FLOW_STAGES[state.flowType];
    const currentIndex = stages.indexOf(stageName);
    if (currentIndex < stages.length - 1) {
      state.currentStage = stages[currentIndex + 1];
    }
  }

  saveFlowState(flowId, state, baseDir);
}

/**
 * 获取活跃的工作流列表
 *
 * @param {string} baseDir - 基础目录
 * @returns {Array} 活跃工作流信息
 */
function getActiveFlows(baseDir = '.') {
  const states = readAllStates(baseDir);
  const active = [];

  for (const [flowId, state] of Object.entries(states)) {
    if (!state.completed) {
      active.push({
        flowId,
        flowType: state.flowType,
        currentStage: state.currentStage,
        startTime: state.startTime
      });
    }
  }

  return active;
}

/**
 * 获取工作流输出目录
 *
 * @see REQ-006 AC-016: 每阶段独立目录
 *
 * @param {string} flowId - 工作流 ID
 * @param {string} baseDir - 基础目录
 * @returns {string} 输出目录路径
 */
function getFlowOutputDir(flowId, baseDir = '.') {
  const path = require('path');
  return path.join(baseDir, 'output', 'flow', flowId);
}

/**
 * 生成工作流总结
 *
 * @see REQ-006 AC-017: 生成可读的 flow-summary.md
 *
 * @param {string} flowId - 工作流 ID
 * @param {string} baseDir - 基础目录
 * @returns {string} Markdown 格式的总结
 */
function generateFlowSummary(flowId, baseDir = '.') {
  const state = loadFlowState(flowId, baseDir);
  if (!state) return '# Flow Summary\n\nNo flow found.';

  const stages = FLOW_STAGES[state.flowType];
  const lines = [
    '# Flow Summary',
    '',
    `**Flow ID:** ${flowId}`,
    `**Type:** ${state.flowType}`,
    `**Started:** ${state.startTime}`,
    `**Status:** ${state.completed ? 'Completed' : 'In Progress'}`,
    '',
    '## Stages',
    ''
  ];

  for (const stage of stages) {
    let status = '⏳ Pending';
    if (state.completedStages.includes(stage)) {
      status = '✅ Completed';
    } else if (state.skippedStages && state.skippedStages.includes(stage)) {
      status = '⏭️ Skipped';
    } else if (state.currentStage === stage) {
      status = '🔄 In Progress';
    }
    lines.push(`- ${stage}: ${status}`);
  }

  if (state.task) {
    lines.push('', '## Task', '', state.task);
  }

  return lines.join('\n');
}

module.exports = {
  // 流程执行
  executeFlow,
  executeQuickFlow,
  executeStandardFlow,
  executeFullFlow,

  // 阶段控制
  getCurrentStage,
  advanceStage,
  revertStage,
  skipStage,

  // 状态管理
  saveFlowState,
  loadFlowState,
  getActiveFlows,

  // 输出管理
  getFlowOutputDir,
  generateFlowSummary,

  // 常量导出
  FLOW_STAGES
};
