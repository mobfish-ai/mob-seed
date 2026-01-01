/**
 * Interactive Prompt - 交互式提示模块
 *
 * 提供用户交互界面，包括确认流程、菜单选择、上下文感知和错误恢复。
 *
 * @module ux/interactive-prompt
 * @see openspec/changes/v2.1-release-automation/specs/ux/interactive-mode.fspec.md
 */

const fs = require('fs');
const path = require('path');

// 恢复点文件名
const CHECKPOINT_FILE = 'checkpoint.json';

/**
 * 格式化确认消息
 * @param {string} message - 确认信息
 * @param {object} [options] - 选项
 * @param {boolean} [options.danger] - 是否为危险操作
 * @returns {string} 格式化的确认消息
 */
function formatConfirmMessage(message, options = {}) {
  const lines = [];

  if (options.danger) {
    lines.push('⚠️  警告');
    lines.push('');
  }

  lines.push(message);
  lines.push('');
  lines.push('[Y] 确认 / [N] 取消');

  return lines.join('\n');
}

/**
 * 格式化选项菜单
 * @param {string} title - 标题
 * @param {Array<{label: string, action: string}>} options - 选项列表
 * @param {object} [menuOptions] - 菜单选项
 * @param {boolean} [menuOptions.allowBatch] - 是否允许批量选择
 * @returns {string} 格式化的菜单
 */
function formatMenu(title, options, menuOptions = {}) {
  const lines = [];

  lines.push(title);
  lines.push('');

  // 编号选项
  options.forEach((opt, index) => {
    lines.push(`  [${index + 1}] ${opt.label}`);
  });

  lines.push('');

  // 控制选项
  if (menuOptions.allowBatch !== false && options.length > 1) {
    lines.push('  [a] 全部执行');
  }
  lines.push('  [n] 跳过');
  lines.push('  [q] 退出');
  lines.push('');
  lines.push('> ');

  return lines.join('\n');
}

/**
 * 格式化 CI 模式菜单（非交互式）
 * @param {string} title - 标题
 * @param {Array<{label: string, action: string}>} options - 选项列表
 * @returns {string} CI 友好的输出
 */
function formatMenuForCI(title, options) {
  const lines = [];

  lines.push(title);
  lines.push('');

  options.forEach((opt, index) => {
    lines.push(`  ${index + 1}. ${opt.label}`);
  });

  return lines.join('\n');
}

/**
 * 解析用户选择
 * @param {string} input - 用户输入
 * @param {Array<{label: string, action: string}>} options - 可选项
 * @returns {Array|null} 选中的选项数组，null 表示退出
 */
function parseSelection(input, options) {
  const trimmed = input.trim().toLowerCase();

  // 退出
  if (trimmed === 'q') {
    return null;
  }

  // 跳过
  if (trimmed === 'n') {
    return [];
  }

  // 全部
  if (trimmed === 'a') {
    return [...options];
  }

  // 单选（数字）
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 1 && num <= options.length) {
    return [options[num - 1]];
  }

  // 多选（逗号分隔）
  if (trimmed.includes(',')) {
    const indices = trimmed.split(',').map(s => parseInt(s.trim(), 10));
    const selected = [];
    for (const idx of indices) {
      if (!isNaN(idx) && idx >= 1 && idx <= options.length) {
        selected.push(options[idx - 1]);
      }
    }
    return selected;
  }

  // 无效输入，返回空
  return [];
}

/**
 * 检测上下文并推荐操作
 * @param {object} status - 项目状态
 * @param {string[]} [status.newSpecs] - 新规格文件
 * @param {string[]} [status.modifiedSpecs] - 修改的规格文件
 * @param {number} [status.failedTests] - 失败测试数
 * @param {number} [status.acProgress] - AC 进度 (0-100)
 * @returns {object|null} 推荐结果或 null
 */
function detectContext(status) {
  // 优先级 1: 新规格文件 → 建议派生
  if (status.newSpecs && status.newSpecs.length > 0) {
    return {
      type: 'new_spec',
      message: `检测到新规格: ${status.newSpecs[0]}，开始派生代码？`,
      action: 'emit',
      priority: 1
    };
  }

  // 优先级 2: 规格修改 → 建议重新派生
  if (status.modifiedSpecs && status.modifiedSpecs.length > 0) {
    return {
      type: 'modified_spec',
      message: `规格 ${status.modifiedSpecs[0]} 已修改，重新派生受影响代码？`,
      action: 'emit',
      priority: 2
    };
  }

  // 优先级 3: 测试全通过且 AC 100% → 建议归档
  if (status.failedTests === 0 && status.acProgress === 100) {
    return {
      type: 'ready_to_archive',
      message: '所有测试通过，AC 100% 完成，归档此提案？',
      action: 'archive',
      priority: 3
    };
  }

  // 优先级 4: 测试失败 → 建议查看
  if (status.failedTests > 0) {
    return {
      type: 'test_failures',
      message: `${status.failedTests} 个测试失败，查看详情？`,
      action: 'exec',
      priority: 4
    };
  }

  return null;
}

/**
 * 保存恢复点
 * @param {string} operation - 操作名称
 * @param {object} state - 状态数据
 * @param {object} [options] - 选项
 * @param {string} [options.projectRoot] - 项目根目录
 */
function saveCheckpoint(operation, state, options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const seedDir = path.join(projectRoot, '.seed');

  // 确保 .seed 目录存在
  if (!fs.existsSync(seedDir)) {
    fs.mkdirSync(seedDir, { recursive: true });
  }

  const checkpoint = {
    operation,
    state,
    timestamp: Date.now()
  };

  const checkpointPath = path.join(seedDir, CHECKPOINT_FILE);
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
}

/**
 * 加载恢复点
 * @param {object} [options] - 选项
 * @param {string} [options.projectRoot] - 项目根目录
 * @returns {object|null} 恢复点数据或 null
 */
function loadCheckpoint(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const checkpointPath = path.join(projectRoot, '.seed', CHECKPOINT_FILE);

  if (!fs.existsSync(checkpointPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(checkpointPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * 清除恢复点
 * @param {object} [options] - 选项
 * @param {string} [options.projectRoot] - 项目根目录
 */
function clearCheckpoint(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const checkpointPath = path.join(projectRoot, '.seed', CHECKPOINT_FILE);

  if (fs.existsSync(checkpointPath)) {
    fs.unlinkSync(checkpointPath);
  }
}

/**
 * 格式化恢复点提示
 * @param {object} checkpoint - 恢复点数据
 * @returns {string} 格式化的提示
 */
function formatCheckpointPrompt(checkpoint) {
  const lines = [];

  lines.push('━━━ 检测到未完成操作 ━━━');
  lines.push('');

  const opName = {
    emit: '派生代码',
    exec: '运行测试',
    defend: '守护检查',
    archive: '归档'
  }[checkpoint.operation] || checkpoint.operation;

  lines.push(`操作: ${opName}`);

  if (checkpoint.state.file) {
    lines.push(`文件: ${checkpoint.state.file}`);
  }

  if (typeof checkpoint.state.progress === 'number') {
    lines.push(`进度: ${checkpoint.state.progress}%`);
  }

  const elapsed = Date.now() - checkpoint.timestamp;
  const minutes = Math.floor(elapsed / 60000);
  if (minutes > 0) {
    lines.push(`中断时间: ${minutes} 分钟前`);
  }

  lines.push('');
  lines.push('[Y] 继续 / [N] 重新开始 / [S] 跳过');

  return lines.join('\n');
}

/**
 * 检测是否为 TTY 环境
 * @returns {boolean}
 */
function isTTY() {
  return process.stdout.isTTY === true;
}

/**
 * 获取终端宽度
 * @returns {number}
 */
function getTerminalWidth() {
  return process.stdout.columns || 80;
}

module.exports = {
  formatConfirmMessage,
  formatMenu,
  formatMenuForCI,
  parseSelection,
  detectContext,
  saveCheckpoint,
  loadCheckpoint,
  clearCheckpoint,
  formatCheckpointPrompt,
  isTTY,
  getTerminalWidth
};
