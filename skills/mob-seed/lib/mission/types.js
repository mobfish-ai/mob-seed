/**
 * Mission Statement 类型定义
 * @module mission/types
 */

/**
 * @typedef {Object} MissionPurpose
 * @property {string} statement - 使命宣言（一段话）
 * @property {string} [essence] - 使命的本质解释
 * @property {string} [impact_vision] - 实现使命后的影响愿景
 */

/**
 * @typedef {Object} MissionVision
 * @property {string} [horizon_1_year] - 1年愿景
 * @property {string} [horizon_3_year] - 3年愿景
 * @property {string} [horizon_10_year] - 10年愿景
 * @property {Object} [north_star] - 北极星指标
 * @property {string} north_star.metric - 指标名称
 * @property {string} north_star.description - 指标描述
 */

/**
 * @typedef {Object} MissionPrinciple
 * @property {string} id - 原则ID (snake_case)
 * @property {string} name - 原则名称
 * @property {string} description - 原则描述
 * @property {string[]} [implications] - 原则的具体影响
 */

/**
 * @typedef {Object} MissionAntiGoal
 * @property {string} id - 反目标ID (snake_case)
 * @property {string} name - 反目标名称
 * @property {string} description - 反目标描述
 * @property {string} [detection] - 如何检测违反
 */

/**
 * @typedef {'refactor' | 'optimize' | 'document' | 'test' | 'fix'} EvolutionScope
 */

/**
 * @typedef {Object} EvolutionScopeConfig
 * @property {EvolutionScope} id - 范围ID
 * @property {string} name - 范围名称
 * @property {string} [description] - 范围描述
 * @property {boolean} [auto_apply] - 是否自动应用
 */

/**
 * @typedef {Object} MissionEvolution
 * @property {EvolutionScopeConfig[]} [allowed_scopes] - 允许的演化范围
 * @property {Object} [decision_criteria] - 演化决策标准
 * @property {number} [decision_criteria.min_alignment_score] - 最低对齐分数
 * @property {string[]} [decision_criteria.human_review_required] - 需要人工审核的范围
 * @property {Object[]} [decision_criteria.auto_apply_conditions] - 自动应用条件
 * @property {Object[]} [triggers] - 演化触发条件
 */

/**
 * @typedef {Object} AlignmentScoringItem
 * @property {number} weight - 权重 (0-1)
 * @property {string} question - 评估问题
 */

/**
 * @typedef {Object} MissionAlignment
 * @property {Object.<string, AlignmentScoringItem>} [scoring_model] - 评分模型
 * @property {string} [evaluation_process] - 评估流程
 */

/**
 * @typedef {Object} MissionCovenant
 * @property {string[]} [human_commitments] - 人类承诺
 * @property {string[]} [ai_commitments] - AI 承诺
 * @property {string[]} [shared_commitments] - 共同承诺
 */

/**
 * @typedef {Object} Mission
 * @property {MissionPurpose} purpose - 存在意义
 * @property {MissionVision} [vision] - 愿景
 * @property {MissionPrinciple[]} principles - 核心原则
 * @property {MissionAntiGoal[]} anti_goals - 反目标
 * @property {MissionEvolution} [evolution] - 演化配置
 * @property {MissionAlignment} [alignment] - 对齐评分
 * @property {MissionCovenant} [covenant] - 人机契约
 */

/**
 * @typedef {Object} MissionValidationResult
 * @property {boolean} valid - 是否有效
 * @property {string[]} errors - 错误列表
 * @property {string[]} warnings - 警告列表
 */

/**
 * @typedef {Object} AlignmentScore
 * @property {number} total - 总分 (0-1)
 * @property {Object.<string, number>} breakdown - 各维度分数
 * @property {boolean} meetsThreshold - 是否达到阈值
 * @property {string[]} violations - 违反的反目标
 */

module.exports = {
  // 类型定义仅用于 JSDoc，无需导出实际值
};
