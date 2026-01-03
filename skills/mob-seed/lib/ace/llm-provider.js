/**
 * LLM 提供商抽象层
 * @module ace/llm-provider
 * @see openspec/changes/v3.0-ace-integration/specs/ace/llm-reflect.fspec.md
 *
 * 实现 REQ-001: LLM 提供商抽象
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * LLM 提供商接口
 * @typedef {Object} LLMProvider
 * @property {string} name - 提供商名称
 * @property {function} analyzeObservations - 分析观察
 * @property {function} suggestProposal - 建议提案
 * @property {function} isAvailable - 检查可用性
 */

/**
 * 反思候选（LLM 生成）
 * @typedef {Object} LLMReflectionCandidate
 * @property {string} pattern - 模式名称
 * @property {number} confidence - 置信度 (0-1)
 * @property {string} lesson - 教训描述
 * @property {string[]} observations - 观察 ID 列表
 * @property {string[]} suggested_actions - 建议行动
 * @property {string} [reasoning] - LLM 推理过程
 */

/**
 * 提案建议
 * @typedef {Object} ProposalSuggestion
 * @property {string} name - 提案名称
 * @property {string} summary - 摘要
 * @property {string[]} phases - 阶段列表
 * @property {Object[]} specs - 规格建议
 */

/**
 * LLM 配置
 * @typedef {Object} LLMConfig
 * @property {boolean} enabled - 是否启用
 * @property {string} provider - 提供商名称
 * @property {string} [model] - 模型名称
 * @property {string} [api_key_env] - API 密钥环境变量名
 * @property {Object} [options] - 调用选项
 * @property {string} [fallback] - 回退策略
 * @property {Object} [limits] - 限流配置
 */

// ============================================================================
// 基础提供商类
// ============================================================================

/**
 * LLM 提供商基类
 */
class BaseLLMProvider {
  /**
   * @param {string} name - 提供商名称
   * @param {LLMConfig} config - 配置
   */
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }

  /**
   * 检查提供商是否可用
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error('子类必须实现 isAvailable()');
  }

  /**
   * 分析观察并生成反思候选
   * @param {Object[]} observations - 观察列表
   * @param {Object} context - 项目上下文
   * @returns {Promise<LLMReflectionCandidate[]>}
   */
  async analyzeObservations(observations, context) {
    throw new Error('子类必须实现 analyzeObservations()');
  }

  /**
   * 生成提案建议
   * @param {Object} reflection - 反思
   * @returns {Promise<ProposalSuggestion>}
   */
  async suggestProposal(reflection) {
    throw new Error('子类必须实现 suggestProposal()');
  }

  /**
   * 构建分析提示词
   * @param {Object[]} observations - 观察列表
   * @param {Object} context - 项目上下文
   * @returns {string}
   */
  buildAnalysisPrompt(observations, context) {
    const obsText = observations.map((obs, i) => {
      return `${i + 1}. [${obs.id}] ${obs.type}: ${obs.description}
   文件: ${obs.context?.file || 'N/A'}
   错误: ${obs.context?.error_message || 'N/A'}`;
    }).join('\n\n');

    return `## 任务

分析以下软件开发观察记录，识别潜在的系统性问题和改进机会。

## 观察列表

${obsText}

## 项目上下文

- 项目名称: ${context.project_name || 'Unknown'}
- 技术栈: ${context.tech_stack || 'JavaScript'}
- 核心规格: ${(context.specs || []).join(', ') || 'N/A'}

## 输出格式

请返回 JSON 格式的反思建议:

\`\`\`json
{
  "reflections": [
    {
      "pattern": "模式名称",
      "confidence": 0.85,
      "lesson": "发现的教训",
      "observations": ["obs-001", "obs-002"],
      "suggested_actions": ["行动1", "行动2"],
      "reasoning": "分析推理过程"
    }
  ]
}
\`\`\``;
  }

  /**
   * 构建提案建议提示词
   * @param {Object} reflection - 反思
   * @returns {string}
   */
  buildProposalPrompt(reflection) {
    return `## 任务

基于以下反思生成变更提案建议。

## 反思内容

- 模式: ${reflection.pattern}
- 教训: ${reflection.lesson}
- 建议行动:
${reflection.suggested_actions.map(a => `  - ${a}`).join('\n')}

## 输出格式

请返回 JSON 格式的提案建议:

\`\`\`json
{
  "name": "提案名称 (kebab-case)",
  "summary": "一句话摘要",
  "phases": ["阶段1: 标题", "阶段2: 标题"],
  "specs": [
    {
      "type": "modify|create",
      "spec": "规格文件名",
      "reason": "修改/创建原因"
    }
  ]
}
\`\`\``;
  }

  /**
   * 解析 LLM JSON 响应
   * @param {string} response - LLM 响应文本
   * @returns {Object}
   */
  parseJSONResponse(response) {
    // 尝试提取 JSON 代码块
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // 尝试直接解析
    const jsonStart = response.indexOf('{');
    const jsonEnd = response.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      return JSON.parse(response.slice(jsonStart, jsonEnd + 1));
    }

    throw new Error('无法从响应中解析 JSON');
  }
}

// ============================================================================
// 提供商注册表
// ============================================================================

const providers = new Map();

/**
 * 注册 LLM 提供商
 * @param {string} name - 提供商名称
 * @param {typeof BaseLLMProvider} ProviderClass - 提供商类
 */
function registerProvider(name, ProviderClass) {
  providers.set(name, ProviderClass);
}

/**
 * 获取 LLM 提供商实例
 * @param {LLMConfig} config - LLM 配置
 * @returns {BaseLLMProvider}
 */
function getProvider(config) {
  const providerName = config.provider || 'mock';
  const ProviderClass = providers.get(providerName);

  if (!ProviderClass) {
    throw new Error(`未知的 LLM 提供商: ${providerName}`);
  }

  return new ProviderClass(config);
}

/**
 * 获取所有已注册的提供商名称
 * @returns {string[]}
 */
function getRegisteredProviders() {
  return Array.from(providers.keys());
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_LLM_CONFIG = {
  enabled: false,
  provider: 'mock',
  fallback: 'rule-based',
  options: {
    temperature: 0.3,
    max_tokens: 1000
  },
  limits: {
    max_observations_per_call: 10,
    max_calls_per_day: 50,
    min_interval_seconds: 60
  }
};

/**
 * 合并配置与默认值
 * @param {Partial<LLMConfig>} config - 用户配置
 * @returns {LLMConfig}
 */
function mergeConfig(config) {
  return {
    ...DEFAULT_LLM_CONFIG,
    ...config,
    options: {
      ...DEFAULT_LLM_CONFIG.options,
      ...(config.options || {})
    },
    limits: {
      ...DEFAULT_LLM_CONFIG.limits,
      ...(config.limits || {})
    }
  };
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  // 基类
  BaseLLMProvider,

  // 注册表
  registerProvider,
  getProvider,
  getRegisteredProviders,

  // 配置
  DEFAULT_LLM_CONFIG,
  mergeConfig
};
