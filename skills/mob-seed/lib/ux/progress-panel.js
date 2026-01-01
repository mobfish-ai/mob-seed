/**
 * Progress Panel - 进度面板模块
 *
 * 提供进度条和状态面板渲染功能。
 *
 * @module ux/progress-panel
 * @see openspec/changes/v2.1-release-automation/specs/ux/interactive-mode.fspec.md
 */

/**
 * 创建进度条对象
 * @param {string} label - 标签
 * @param {number} total - 总数
 * @returns {ProgressBar} 进度条对象
 */
function createProgressBar(label, total) {
  return {
    label,
    total,
    current: 0,
    percent: 0,

    /**
     * 更新进度
     * @param {number} current - 当前值
     */
    update(current) {
      this.current = current;
      this.percent = total > 0 ? Math.round((current / total) * 100) : 0;
    },

    /**
     * 增加进度
     * @param {number} [amount=1] - 增加量
     */
    increment(amount = 1) {
      this.update(this.current + amount);
    },

    /**
     * 渲染进度条字符串
     * @param {object} [options] - 渲染选项
     * @returns {string}
     */
    render(options = {}) {
      const width = options.width || 20;
      const bar = renderProgressBar(this.percent, { width });
      return `${this.label}: ${bar} ${this.current}/${this.total} (${this.percent}%)`;
    }
  };
}

/**
 * 渲染 ASCII 进度条
 * @param {number} percent - 百分比 (0-100)
 * @param {object} [options] - 选项
 * @param {number} [options.width=20] - 进度条宽度
 * @returns {string} 进度条字符串
 */
function renderProgressBar(percent, options = {}) {
  const width = options.width || 20;
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;

  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * 渲染状态面板
 * @param {object} data - 面板数据
 * @param {string} data.title - 标题
 * @param {string} [data.status] - 状态
 * @param {Array<{label: string, current: number, total: number, status?: string}>} data.items - 项目列表
 * @returns {string} 格式化的面板
 */
function renderPanel(data) {
  const lines = [];
  const width = 50;

  // 顶部边框
  lines.push('┌' + '─'.repeat(width - 2) + '┐');

  // 标题
  const titleLine = `│ ${data.title}`.padEnd(width - 1) + '│';
  lines.push(titleLine);

  // 状态
  if (data.status) {
    const statusIcon = getStatusIcon(data.status);
    const statusLine = `│ 状态: ${statusIcon} ${data.status}`.padEnd(width - 1) + '│';
    lines.push(statusLine);
  }

  // 分隔线
  lines.push('├' + '─'.repeat(width - 2) + '┤');

  // 项目列表
  for (const item of data.items || []) {
    const icon = item.status ? getStatusIcon(item.status) : '';
    const progress = `${item.current}/${item.total}`;
    const percent = item.total > 0 ? Math.round((item.current / item.total) * 100) : 0;
    const bar = renderProgressBar(percent, { width: 10 });

    const itemLine = `│ ${icon} ${item.label}: ${bar} ${progress}`.padEnd(width - 1) + '│';
    lines.push(itemLine);
  }

  // 底部边框
  lines.push('└' + '─'.repeat(width - 2) + '┘');

  return lines.join('\n');
}

/**
 * 获取状态图标
 * @param {string} status - 状态
 * @returns {string} 图标
 */
function getStatusIcon(status) {
  const icons = {
    complete: '✅',
    completed: '✅',
    in_progress: '🔄',
    implementing: '🔄',
    pending: '⏳',
    draft: '📝',
    review: '🔍',
    archived: '📦',
    error: '❌',
    warning: '⚠️'
  };

  return icons[status] || '';
}

/**
 * 格式化持续时间
 * @param {number} seconds - 秒数
 * @returns {string} 格式化的时间字符串
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}

/**
 * 创建简单的 spinner
 * @returns {object} Spinner 对象
 */
function createSpinner() {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let index = 0;

  return {
    frame() {
      const frame = frames[index];
      index = (index + 1) % frames.length;
      return frame;
    }
  };
}

module.exports = {
  createProgressBar,
  renderProgressBar,
  renderPanel,
  getStatusIcon,
  formatDuration,
  createSpinner
};
