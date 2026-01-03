/**
 * 状态管理器 (State Manager)
 *
 * 管理 brownfield 迁移状态，支持中断恢复。
 *
 * @module skills/mob-seed/lib/brownfield/state-manager
 */

const fs = require('fs');
const path = require('path');

/**
 * 状态文件名
 */
const STATE_FILE = 'brownfield-state.json';

/**
 * 加载迁移状态
 * @param {string} projectPath - 项目路径
 * @returns {Object|null} 状态对象或 null
 */
function loadState(projectPath) {
  const statePath = getStatePath(projectPath);

  if (!fs.existsSync(statePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(statePath, 'utf8');
    const state = JSON.parse(content);

    // 验证状态有效性
    if (!isValidState(state)) {
      return null;
    }

    return state;
  } catch (error) {
    return null;
  }
}

/**
 * 保存迁移状态
 * @param {string} projectPath - 项目路径
 * @param {Object} state - 状态对象
 * @returns {boolean} 是否保存成功
 */
function saveState(projectPath, state) {
  const statePath = getStatePath(projectPath);
  const seedDir = path.dirname(statePath);

  try {
    // 确保 .seed 目录存在
    if (!fs.existsSync(seedDir)) {
      fs.mkdirSync(seedDir, { recursive: true });
    }

    const stateWithMeta = {
      ...state,
      version: 1,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(statePath, JSON.stringify(stateWithMeta, null, 2), 'utf8');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 清除迁移状态
 * @param {string} projectPath - 项目路径
 * @returns {boolean} 是否清除成功
 */
function clearState(projectPath) {
  const statePath = getStatePath(projectPath);

  if (!fs.existsSync(statePath)) {
    return true;
  }

  try {
    fs.unlinkSync(statePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 检查是否有未完成的迁移
 * @param {string} projectPath - 项目路径
 * @returns {boolean} 是否有未完成迁移
 */
function hasIncompleteState(projectPath) {
  const state = loadState(projectPath);
  return state !== null && state.phase !== 'completed';
}

/**
 * 创建初始状态
 * @param {Object} options - 迁移选项
 * @returns {Object} 初始状态
 */
function createInitialState(options) {
  return {
    version: 1,
    phase: 'detecting',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    options: {
      concurrency: options.concurrency || 5,
      enrichEnabled: options.enrichEnabled !== false,
      dryRun: options.dryRun || false
    },
    progress: {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0
    },
    files: {
      remaining: [],
      completed: [],
      failed: []
    }
  };
}

/**
 * 更新状态阶段
 * @param {Object} state - 当前状态
 * @param {string} phase - 新阶段
 * @returns {Object} 更新后的状态
 */
function updatePhase(state, phase) {
  return {
    ...state,
    phase,
    updatedAt: new Date().toISOString()
  };
}

/**
 * 更新进度
 * @param {Object} state - 当前状态
 * @param {Object} progress - 进度信息
 * @returns {Object} 更新后的状态
 */
function updateProgress(state, progress) {
  return {
    ...state,
    progress: {
      ...state.progress,
      ...progress
    },
    updatedAt: new Date().toISOString()
  };
}

/**
 * 标记文件完成
 * @param {Object} state - 当前状态
 * @param {string} file - 文件路径
 * @param {boolean} success - 是否成功
 * @param {string} [error] - 错误信息
 * @returns {Object} 更新后的状态
 */
function markFileCompleted(state, file, success, error = null) {
  const remaining = state.files.remaining.filter(f => f !== file);

  const newState = {
    ...state,
    files: {
      ...state.files,
      remaining,
      completed: success
        ? [...state.files.completed, file]
        : state.files.completed,
      failed: !success
        ? [...state.files.failed, { file, error }]
        : state.files.failed
    },
    progress: {
      ...state.progress,
      processed: state.progress.processed + 1,
      successful: success
        ? state.progress.successful + 1
        : state.progress.successful,
      failed: !success
        ? state.progress.failed + 1
        : state.progress.failed
    },
    updatedAt: new Date().toISOString()
  };

  return newState;
}

/**
 * 获取状态文件路径
 * @param {string} projectPath - 项目路径
 * @returns {string} 状态文件路径
 */
function getStatePath(projectPath) {
  return path.join(projectPath, '.seed', STATE_FILE);
}

/**
 * 验证状态有效性
 * @param {Object} state - 状态对象
 * @returns {boolean} 是否有效
 */
function isValidState(state) {
  if (!state || typeof state !== 'object') {
    return false;
  }

  // 必须包含版本和阶段
  if (!state.version || !state.phase) {
    return false;
  }

  // 必须包含进度信息
  if (!state.progress || typeof state.progress.total !== 'number') {
    return false;
  }

  return true;
}

/**
 * 计算完成百分比
 * @param {Object} state - 状态对象
 * @returns {number} 完成百分比 (0-100)
 */
function calculateProgress(state) {
  if (!state || state.progress.total === 0) {
    return 0;
  }
  return Math.round((state.progress.processed / state.progress.total) * 100);
}

/**
 * 获取状态摘要
 * @param {Object} state - 状态对象
 * @returns {Object} 状态摘要
 */
function getStateSummary(state) {
  if (!state) {
    return null;
  }

  return {
    phase: state.phase,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
    progress: calculateProgress(state),
    processed: state.progress.processed,
    total: state.progress.total,
    remaining: state.files.remaining.length,
    successful: state.progress.successful,
    failed: state.progress.failed
  };
}

// 导出
module.exports = {
  STATE_FILE,
  loadState,
  saveState,
  clearState,
  hasIncompleteState,
  createInitialState,
  updatePhase,
  updateProgress,
  markFileCompleted,
  getStatePath,
  isValidState,
  calculateProgress,
  getStateSummary
};
