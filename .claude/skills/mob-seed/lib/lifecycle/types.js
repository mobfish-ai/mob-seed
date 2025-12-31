/**
 * OpenSpec 生命周期类型定义
 * @module lifecycle/types
 * @see docs/plans/SEED-OPENSPEC-COMPAT.md
 *
 * 生命周期状态机:
 * Draft → Review → Implement → Archive
 *   ↓        ↓         ↓          ↓
 * changes/ 审查    代码实现   specs/
 */

/**
 * 规格生命周期状态
 * @typedef {'draft' | 'review' | 'implementing' | 'archived'} LifecycleState
 */

/**
 * 规格状态元数据
 * @typedef {Object} SpecStateMetadata
 * @property {LifecycleState} state - 当前状态
 * @property {string} version - 版本号
 * @property {string} [stack] - 技术栈
 * @property {string} [emitPath] - 派生路径
 * @property {string} [createdAt] - 创建时间
 * @property {string} [updatedAt] - 更新时间
 */

/**
 * Delta 变更类型
 * @typedef {'ADDED' | 'MODIFIED' | 'REMOVED'} DeltaType
 */

/**
 * Delta 需求项
 * @typedef {Object} DeltaRequirement
 * @property {DeltaType} type - 变更类型
 * @property {string} id - 需求 ID (如 REQ-001)
 * @property {string} title - 需求标题
 * @property {string} description - 需求描述
 * @property {Array<{name: string, when: string, then: string}>} [scenarios] - 场景
 * @property {string[]} [acceptance] - 验收条件
 */

/**
 * 规格文件解析结果
 * @typedef {Object} ParsedSpec
 * @property {string} title - 规格标题
 * @property {SpecStateMetadata} metadata - 状态元数据
 * @property {DeltaRequirement[]} added - 新增需求
 * @property {DeltaRequirement[]} modified - 修改需求
 * @property {DeltaRequirement[]} removed - 删除需求
 * @property {string} raw - 原始内容
 */

/**
 * 变更提案结构
 * @typedef {Object} ChangeProposal
 * @property {string} name - 提案名称 (目录名)
 * @property {string} path - 提案路径
 * @property {LifecycleState} state - 当前状态
 * @property {string} version - 版本号
 * @property {string[]} specs - 规格文件列表
 * @property {boolean} hasProposalMd - 是否有 proposal.md
 * @property {boolean} hasTasksMd - 是否有 tasks.md
 * @property {string} [createdAt] - 创建时间
 * @property {string} [updatedAt] - 更新时间
 */

/**
 * 规格状态概览
 * @typedef {Object} SpecStatusOverview
 * @property {ParsedSpec[]} archived - 已归档规格 (specs/)
 * @property {ChangeProposal[]} draft - 草稿中的提案
 * @property {ChangeProposal[]} review - 审查中的提案
 * @property {ChangeProposal[]} implementing - 实现中的提案
 * @property {number} totalSpecs - 总规格数
 * @property {number} totalChanges - 总变更提案数
 */

/**
 * 状态转换规则
 * @type {Object<LifecycleState, LifecycleState[]>}
 */
const STATE_TRANSITIONS = {
  draft: ['review', 'draft'],           // draft → review (submit) 或保持 draft
  review: ['implementing', 'draft'],    // review → implementing (emit) 或回退 draft
  implementing: ['archived', 'draft'],  // implementing → archived (archive) 或回退 draft
  archived: ['draft']                   // archived → draft (reopen)
};

/**
 * 状态显示配置
 * @type {Object<LifecycleState, {icon: string, label: string, color: string}>}
 */
const STATE_DISPLAY = {
  draft: { icon: '📝', label: '草稿', color: 'gray' },
  review: { icon: '🔍', label: '审查中', color: 'yellow' },
  implementing: { icon: '🔨', label: '实现中', color: 'blue' },
  archived: { icon: '✅', label: '已归档', color: 'green' }
};

/**
 * 检查状态转换是否有效
 * @param {LifecycleState} from - 当前状态
 * @param {LifecycleState} to - 目标状态
 * @returns {boolean} 是否可转换
 */
function canTransition(from, to) {
  const allowed = STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * 获取状态显示信息
 * @param {LifecycleState} state - 状态
 * @returns {{icon: string, label: string, color: string}} 显示配置
 */
function getStateDisplay(state) {
  return STATE_DISPLAY[state] || { icon: '❓', label: state, color: 'gray' };
}

module.exports = {
  STATE_TRANSITIONS,
  STATE_DISPLAY,
  canTransition,
  getStateDisplay
};
