/**
 * ACE 观察统计模块
 * @module ace/observation-stats
 * @see openspec/changes/v3.0-ace-integration/specs/ace/status-panel-enhance.fspec.md
 *
 * 提供观察统计数据获取、优先级分布、健康度计算和操作建议。
 */

const fs = require('fs');
const path = require('path');
const { loadObservation, listObservations, loadIndex } = require('./observation');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 观察统计
 * @typedef {Object} ObservationStats
 * @property {number} total - 总数
 * @property {number} raw - 待处理数
 * @property {number} triaged - 已归类数
 * @property {number} promoted - 已提升数
 * @property {number} ignored - 已忽略数
 */

/**
 * 优先级分布
 * @typedef {Object} PriorityDistribution
 * @property {number} P0 - 紧急
 * @property {number} P1 - 高
 * @property {number} P2 - 中
 * @property {number} P3 - 低
 * @property {number} P4 - 最低
 */

/**
 * 健康状态
 * @typedef {'healthy' | 'attention' | 'backlog' | 'critical'} HealthStatus
 */

/**
 * 健康度结果
 * @typedef {Object} HealthResult
 * @property {HealthStatus} status - 健康状态
 * @property {string} icon - 状态图标
 * @property {string} [message] - 提示消息
 */

/**
 * 建议操作
 * @typedef {Object} SuggestedAction
 * @property {string} command - 命令
 * @property {string} description - 描述
 * @property {'high' | 'medium' | 'low'} priority - 优先级
 */

// ============================================================================
// REQ-002: 观察统计数据获取 (AC-005 ~ AC-007)
// ============================================================================

/**
 * 获取观察统计 (AC-005)
 * @param {string} projectRoot - 项目根目录
 * @returns {ObservationStats} 统计数据
 */
function getObservationStats(projectRoot) {
  const indexPath = path.join(projectRoot, '.seed', 'observations', 'index.json');

  // AC-007: 索引不存在时返回空统计
  if (!fs.existsSync(indexPath)) {
    return { total: 0, raw: 0, triaged: 0, promoted: 0, ignored: 0 };
  }

  try {
    // AC-006: 从 index.json 读取统计
    const content = fs.readFileSync(indexPath, 'utf-8');
    const index = JSON.parse(content);
    return index.stats || { total: 0, raw: 0, triaged: 0, promoted: 0, ignored: 0 };
  } catch {
    return { total: 0, raw: 0, triaged: 0, promoted: 0, ignored: 0 };
  }
}

// ============================================================================
// REQ-003: 优先级分布统计 (AC-008 ~ AC-010)
// ============================================================================

/**
 * 获取优先级分布 (AC-008)
 * @param {string} projectRoot - 项目根目录
 * @returns {PriorityDistribution} 分布数据
 */
function getPriorityDistribution(projectRoot) {
  const distribution = { P0: 0, P1: 0, P2: 0, P3: 0, P4: 0 };

  try {
    // 获取已归类的观察
    const triagedList = listObservations(projectRoot, { status: 'triaged' });

    for (const item of triagedList) {
      const obs = loadObservation(projectRoot, item.id);
      if (obs && obs.priority) {
        const priority = obs.priority.toUpperCase();
        if (distribution[priority] !== undefined) {
          distribution[priority]++;
        }
      }
    }
  } catch {
    // 忽略错误，返回空分布
  }

  return distribution;
}

/**
 * 获取非零优先级分布 (AC-009)
 * @param {PriorityDistribution} distribution - 完整分布
 * @returns {Object<string, number>} 非零分布
 */
function getNonZeroPriorities(distribution) {
  const result = {};
  for (const [priority, count] of Object.entries(distribution)) {
    if (count > 0) {
      result[priority] = count;
    }
  }
  return result;
}

/**
 * 获取优先级颜色 (AC-010)
 * @param {string} priority - 优先级
 * @returns {'red' | 'yellow' | 'default'} 颜色
 */
function getPriorityColor(priority) {
  switch (priority) {
    case 'P0':
      return 'red';
    case 'P1':
      return 'yellow';
    default:
      return 'default';
  }
}

// ============================================================================
// REQ-004: 观察健康度指示 (AC-011 ~ AC-013)
// ============================================================================

/**
 * 计算健康度 (AC-011)
 * @param {ObservationStats} stats - 统计数据
 * @param {PriorityDistribution} [priorityDist] - 优先级分布
 * @returns {HealthResult} 健康度结果
 */
function getHealthStatus(stats, priorityDist) {
  // 检查紧急情况：P0/P1 > 0
  if (priorityDist && (priorityDist.P0 > 0 || priorityDist.P1 > 0)) {
    return {
      status: 'critical',
      icon: '🚨',
      message: `有 ${priorityDist.P0 + priorityDist.P1} 条高优先级观察待处理`
    };
  }

  // 检查积压：raw > 10
  if (stats.raw > 10) {
    return {
      status: 'backlog',
      icon: '❗',
      message: `待处理观察积压 (${stats.raw} 条)，建议尽快归类`
    };
  }

  // 检查注意：5 < raw ≤ 10
  if (stats.raw > 5) {
    return {
      status: 'attention',
      icon: '⚠️',
      message: `待处理观察较多 (${stats.raw} 条)`
    };
  }

  // 健康状态
  return {
    status: 'healthy',
    icon: '✓'
  };
}

/**
 * 获取健康度颜色 (AC-012)
 * @param {HealthStatus} status - 健康状态
 * @returns {'green' | 'yellow' | 'red'} 颜色
 */
function getHealthColor(status) {
  switch (status) {
    case 'healthy':
      return 'green';
    case 'attention':
      return 'yellow';
    case 'backlog':
    case 'critical':
      return 'red';
    default:
      return 'green';
  }
}

// ============================================================================
// REQ-005: 快捷操作入口 (AC-014 ~ AC-016)
// ============================================================================

/**
 * 生成操作建议 (AC-014)
 * @param {ObservationStats} stats - 统计数据
 * @param {PriorityDistribution} [priorityDist] - 优先级分布
 * @returns {SuggestedAction[]} 建议列表（已按优先级排序）
 */
function getSuggestedActions(stats, priorityDist) {
  const actions = [];

  // AC-016: 优先显示高优先级操作
  // P1 紧急任务
  if (priorityDist && priorityDist.P1 > 0) {
    actions.push({
      command: '/mob-seed:spec triage --show P1',
      description: `查看 ${priorityDist.P1} 条高优先级观察`,
      priority: 'high'
    });
  }

  // P0 紧急任务（最高优先级）
  if (priorityDist && priorityDist.P0 > 0) {
    actions.unshift({
      command: '/mob-seed:spec triage --show P0',
      description: `处理 ${priorityDist.P0} 条紧急观察`,
      priority: 'high'
    });
  }

  // raw 待处理
  if (stats.raw > 0) {
    actions.push({
      command: '/mob-seed:spec triage --batch raw',
      description: `归类 ${stats.raw} 条待处理观察`,
      priority: stats.raw > 5 ? 'high' : 'medium'
    });
  }

  // promoted 查看提案
  if (stats.promoted > 0) {
    actions.push({
      command: '/mob-seed:spec --list draft',
      description: `查看 ${stats.promoted} 条已升级的提案`,
      priority: 'low'
    });
  }

  // 查看详情
  if (stats.total > 0) {
    actions.push({
      command: '/mob-seed:spec observe --list',
      description: '查看所有观察详情',
      priority: 'low'
    });
  }

  return actions;
}

// ============================================================================
// REQ-001: 状态面板观察区块 (AC-001 ~ AC-004)
// ============================================================================

/**
 * 渲染观察统计区块 (AC-001 ~ AC-004)
 * @param {string} projectRoot - 项目根目录
 * @returns {string[]} 渲染的行
 */
function renderObservationBlock(projectRoot) {
  const lines = [];
  const stats = getObservationStats(projectRoot);

  // 无观察时不显示
  if (stats.total === 0) {
    return [];
  }

  const priorityDist = getPriorityDistribution(projectRoot);
  const health = getHealthStatus(stats, priorityDist);

  // AC-001: 区块标题
  const titleSuffix = health.status !== 'healthy' ? ` ${health.icon} ${health.message || ''}` : '';
  lines.push(`🔬 观察状态${titleSuffix}`);

  // AC-002: 状态统计
  if (stats.raw > 0) {
    lines.push(`  待处理: ${stats.raw} 条 (raw)`);
  }

  if (stats.triaged > 0) {
    lines.push(`  已归类: ${stats.triaged} 条 (triaged)`);

    // AC-003: 优先级细分
    const nonZero = getNonZeroPriorities(priorityDist);
    for (const [priority, count] of Object.entries(nonZero)) {
      const color = getPriorityColor(priority);
      const prefix = color === 'red' ? '🔴' : color === 'yellow' ? '🟡' : '';
      lines.push(`    ${prefix}${priority}: ${count} 条`);
    }
  }

  if (stats.promoted > 0) {
    lines.push(`  已提升: ${stats.promoted} 条 → 提案`);
  }

  if (stats.ignored > 0) {
    lines.push(`  已忽略: ${stats.ignored} 条`);
  }

  // AC-004: 操作提示
  const actions = getSuggestedActions(stats, priorityDist);
  if (actions.length > 0) {
    lines.push('');
    lines.push('💡 建议操作:');
    // 只显示前 2 个建议
    for (const action of actions.slice(0, 2)) {
      lines.push(`   ${action.command}`);
    }
  }

  return lines;
}

/**
 * 格式化观察统计为字符串
 * @param {string} projectRoot - 项目根目录
 * @returns {string} 格式化的统计
 */
function formatObservationStats(projectRoot) {
  const lines = renderObservationBlock(projectRoot);
  return lines.join('\n');
}

module.exports = {
  // 统计获取
  getObservationStats,

  // 优先级分布
  getPriorityDistribution,
  getNonZeroPriorities,
  getPriorityColor,

  // 健康度
  getHealthStatus,
  getHealthColor,

  // 操作建议
  getSuggestedActions,

  // 渲染
  renderObservationBlock,
  formatObservationStats
};
