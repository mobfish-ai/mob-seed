/**
 * Task Cancellation (任务取消)
 *
 * 支持开发过程中的任务取消和状态回滚，确保取消操作安全可恢复。
 *
 * @see openspec/changes/v2.0-seed-complete/specs/ops/cancellation.fspec.md
 * @module lib/ops/cancellation
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 取消原因类型
 * @see REQ-001: 取消触发方式
 */
const CANCEL_REASONS = {
  USER: 'user',           // 用户主动取消
  TIMEOUT: 'timeout',     // 超时取消
  ERROR: 'error',         // 错误累积
  SIGNAL: 'signal'        // 外部信号
};

/**
 * 安全点阶段
 * @see REQ-002: 安全取消点
 */
const SAFE_POINTS = {
  analysis: true,
  design: true,
  implement: 'check',    // 需检查
  test: true,
  verify: true
};

/**
 * 内存存储
 */
const store = {
  cancelRequests: {},   // flowId -> cancel request
  safePoints: {},       // flowId -> boolean
  states: {},           // flowId -> state snapshot
  handlers: [],         // cancel handlers
  history: [],          // cancellation history
  subprocesses: {},     // flowId -> process list
  locks: {}             // flowId -> lock list
};

/**
 * 获取存储目录
 */
function getSeedDir() {
  return process.env.SEED_DIR || path.join(process.cwd(), '.seed');
}

/**
 * 请求取消
 *
 * @see REQ-001 AC-001: 支持 Ctrl+C 取消
 * @see REQ-001 AC-003: 支持 API 方式取消
 *
 * @param {string} flowId - 流程 ID
 * @param {string} reason - 取消原因
 */
function requestCancel(flowId, reason) {
  store.cancelRequests[flowId] = {
    flowId,
    reason,
    requestedAt: new Date().toISOString(),
    status: 'cancelling'
  };

  // 通知所有处理器
  for (const handler of store.handlers) {
    try {
      handler({ flowId, reason });
    } catch (e) {
      // 忽略处理器错误
    }
  }

  // 保存状态
  saveState(flowId);

  // 清理资源
  cleanup(flowId);
}

/**
 * 注册取消处理器
 *
 * @param {Function} handler - 取消处理函数
 */
function registerCancelHandler(handler) {
  if (typeof handler === 'function') {
    store.handlers.push(handler);
  }
}

/**
 * 标记安全点
 *
 * @see REQ-002 AC-004: 识别安全取消点
 *
 * @param {string} flowId - 流程 ID
 */
function markSafePoint(flowId) {
  store.safePoints[flowId] = true;
}

/**
 * 检查是否在安全点
 *
 * @param {string} flowId - 流程 ID
 * @returns {boolean} 是否在安全点
 */
function isAtSafePoint(flowId) {
  return store.safePoints[flowId] === true;
}

/**
 * 等待安全点
 *
 * @see REQ-002 AC-005: 优先在安全点取消
 * @see REQ-002 AC-006: 支持强制取消
 *
 * @param {string} flowId - 流程 ID
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<boolean>} 是否到达安全点
 */
async function waitForSafePoint(flowId, timeout = 30000) {
  // 如果已经在安全点，立即返回
  if (isAtSafePoint(flowId)) {
    return true;
  }

  // 等待安全点或超时
  const startTime = Date.now();
  const checkInterval = 100;

  return new Promise((resolve) => {
    const check = () => {
      if (isAtSafePoint(flowId)) {
        resolve(true);
        return;
      }

      if (Date.now() - startTime >= timeout) {
        // 超时，强制取消
        resolve(false);
        return;
      }

      setTimeout(check, checkInterval);
    };

    check();
  });
}

/**
 * 保存状态快照
 *
 * @see REQ-003 AC-007: 保存任务进度
 * @see REQ-003 AC-008: 保存工作流状态
 *
 * @param {string} flowId - 流程 ID
 * @returns {Object} 状态快照
 */
function saveState(flowId) {
  const snapshot = {
    flowId,
    id: flowId,
    timestamp: new Date().toISOString(),
    savedAt: new Date().toISOString(),
    stage: 'unknown',
    tasks: [],
    completedTasks: [],
    pendingTasks: []
  };

  // 保存到内存
  store.states[flowId] = snapshot;

  // 保存到文件
  const seedDir = getSeedDir();
  const statesDir = path.join(seedDir, 'states');

  if (fs.existsSync(seedDir)) {
    if (!fs.existsSync(statesDir)) {
      fs.mkdirSync(statesDir, { recursive: true });
    }
    const filePath = path.join(statesDir, `${flowId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  }

  return snapshot;
}

/**
 * 生成取消报告
 *
 * @see REQ-003 AC-009: 生成取消报告
 *
 * @param {string} flowId - 流程 ID
 * @param {Object} snapshot - 状态快照
 * @returns {string} Markdown 格式报告
 */
function generateCancelReport(flowId, snapshot) {
  const now = new Date().toISOString();
  const stage = snapshot.stage || 'unknown';
  const completedCount = (snapshot.completedTasks || []).length;
  const totalCount = (snapshot.tasks || []).length || completedCount;

  const lines = [
    '# 任务取消报告',
    '',
    `> 取消时间: ${now}`,
    `> 流程 ID: ${flowId}`,
    '',
    '## 取消时状态',
    '',
    '| 项目 | 状态 |',
    '|------|------|',
    `| 当前阶段 | ${stage} |`,
    `| 已完成任务 | ${completedCount}/${totalCount} |`,
    '',
    '## 已完成的工作',
    ''
  ];

  // 列出已完成的任务
  for (const task of (snapshot.completedTasks || [])) {
    lines.push(`- ✅ ${task.id || task}: ${task.name || '完成'}`);
  }

  if ((snapshot.completedTasks || []).length === 0) {
    lines.push('- (无已完成任务)');
  }

  lines.push('');
  lines.push('## 恢复指南');
  lines.push('');
  lines.push('要继续此任务，请运行:');
  lines.push('```bash');
  lines.push(`/mob-seed-resume --flow-id=${flowId}`);
  lines.push('```');

  return lines.join('\n');
}

/**
 * 清理资源
 *
 * @see REQ-004 AC-010: 终止子进程
 * @see REQ-004 AC-011: 释放锁资源
 * @see REQ-004 AC-012: 清理临时文件
 *
 * @param {string} flowId - 流程 ID
 * @returns {Object} 清理结果
 */
function cleanup(flowId) {
  const result = {
    success: true,
    cleaned: [],
    errors: []
  };

  // 终止子进程
  try {
    terminateSubprocesses(flowId);
    result.cleaned.push('subprocesses');
  } catch (e) {
    result.errors.push({ type: 'subprocesses', error: e.message });
  }

  // 释放锁
  try {
    releaseLocks(flowId);
    result.cleaned.push('locks');
  } catch (e) {
    result.errors.push({ type: 'locks', error: e.message });
  }

  // 清理临时文件
  const seedDir = getSeedDir();
  const tempDir = path.join(seedDir, 'temp', flowId);

  if (fs.existsSync(tempDir)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      result.cleaned.push('temp_files');
    } catch (e) {
      result.errors.push({ type: 'temp_files', error: e.message });
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

/**
 * 终止子进程
 *
 * @param {string} flowId - 流程 ID
 */
function terminateSubprocesses(flowId) {
  const processes = store.subprocesses[flowId] || [];

  for (const proc of processes) {
    try {
      if (proc && typeof proc.kill === 'function') {
        proc.kill('SIGTERM');
      }
    } catch (e) {
      // 忽略已终止的进程
    }
  }

  // 清空列表
  store.subprocesses[flowId] = [];
}

/**
 * 释放锁资源
 *
 * @param {string} flowId - 流程 ID
 */
function releaseLocks(flowId) {
  const locks = store.locks[flowId] || [];

  for (const lock of locks) {
    try {
      // 如果是文件锁，删除锁文件
      if (lock.file && fs.existsSync(lock.file)) {
        fs.unlinkSync(lock.file);
      }
    } catch (e) {
      // 忽略释放失败
    }
  }

  // 清空列表
  store.locks[flowId] = [];
}

/**
 * 检查是否可恢复
 *
 * @param {string} flowId - 流程 ID
 * @returns {boolean} 是否可恢复
 */
function canResume(flowId) {
  // 检查内存中是否有状态
  if (store.states[flowId]) {
    return true;
  }

  // 检查文件系统
  const seedDir = getSeedDir();
  const statesDir = path.join(seedDir, 'states');
  const filePath = path.join(statesDir, `${flowId}.json`);

  return fs.existsSync(filePath);
}

/**
 * 恢复任务
 *
 * @see REQ-005 AC-013: 支持从取消点继续
 * @see REQ-005 AC-014: 支持重新开始
 *
 * @param {string} flowId - 流程 ID
 * @param {Object} options - 恢复选项
 */
function resume(flowId, options = {}) {
  // 加载状态
  let state = store.states[flowId];

  if (!state) {
    const seedDir = getSeedDir();
    const statesDir = path.join(seedDir, 'states');
    const filePath = path.join(statesDir, `${flowId}.json`);

    if (fs.existsSync(filePath)) {
      state = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  }

  if (!state) {
    throw new Error(`No saved state for flow: ${flowId}`);
  }

  // 清除取消请求
  delete store.cancelRequests[flowId];

  // 重置安全点
  store.safePoints[flowId] = false;

  // 根据选项处理
  const mode = options.mode || 'continue';

  if (mode === 'restart') {
    // 重新开始：清除已完成任务
    state.completedTasks = [];
    state.stage = 'analysis';
  } else if (mode === 'from-stage' && options.stage) {
    // 从指定阶段开始
    state.stage = options.stage;
  }
  // else: continue 模式，保持现有状态

  // 更新状态
  store.states[flowId] = state;

  return state;
}

/**
 * 获取恢复选项
 *
 * @see REQ-005 AC-015: 支持选择开始阶段
 *
 * @param {string} flowId - 流程 ID
 * @returns {Array<Object>} 恢复选项列表
 */
function getResumeOptions(flowId) {
  const options = [
    {
      mode: 'continue',
      name: 'continue',
      type: 'continue',
      description: '从取消点继续'
    },
    {
      mode: 'restart',
      name: 'restart',
      type: 'restart',
      description: '重新开始，保留配置'
    }
  ];

  // 添加阶段选项
  for (const stage of Object.keys(SAFE_POINTS)) {
    options.push({
      mode: 'from-stage',
      stage,
      name: `from-${stage}`,
      type: 'from-stage',
      description: `从 ${stage} 阶段开始`
    });
  }

  return options;
}

/**
 * 记录取消日志
 *
 * @see REQ-006 AC-016: 记录完整取消信息
 *
 * @param {Object} cancelEvent - 取消事件
 */
function logCancellation(cancelEvent) {
  const event = {
    ...cancelEvent,
    loggedAt: new Date().toISOString()
  };

  // 保存到内存
  store.history.push(event);

  // 追加到日志文件
  const seedDir = getSeedDir();
  const logFile = path.join(seedDir, 'cancellation.log');

  if (fs.existsSync(seedDir)) {
    const logLine = JSON.stringify(event) + '\n';
    fs.appendFileSync(logFile, logLine);
  }
}

/**
 * 获取取消历史
 *
 * @see REQ-006 AC-017: 日志可查询
 *
 * @param {string} flowId - 流程 ID（可选）
 * @returns {Array<Object>} 取消事件列表
 */
function getCancellationHistory(flowId) {
  let history = [...store.history];

  // 从文件加载
  const seedDir = getSeedDir();
  const logFile = path.join(seedDir, 'cancellation.log');

  if (fs.existsSync(logFile)) {
    try {
      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l);

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (!history.find(h => h.loggedAt === event.loggedAt && h.flowId === event.flowId)) {
            history.push(event);
          }
        } catch (e) {
          // 忽略无法解析的行
        }
      }
    } catch (e) {
      // 忽略读取错误
    }
  }

  // 按 flowId 过滤
  if (flowId) {
    history = history.filter(h => h.flowId === flowId);
  }

  // 按时间排序
  history.sort((a, b) => new Date(b.loggedAt || b.timestamp || 0) - new Date(a.loggedAt || a.timestamp || 0));

  return history;
}

module.exports = {
  // 取消触发
  requestCancel,
  registerCancelHandler,

  // 安全点
  markSafePoint,
  isAtSafePoint,
  waitForSafePoint,

  // 状态保存
  saveState,
  generateCancelReport,

  // 资源清理
  cleanup,
  terminateSubprocesses,
  releaseLocks,

  // 恢复
  canResume,
  resume,
  getResumeOptions,

  // 日志
  logCancellation,
  getCancellationHistory,

  // 常量
  CANCEL_REASONS,
  SAFE_POINTS
};
