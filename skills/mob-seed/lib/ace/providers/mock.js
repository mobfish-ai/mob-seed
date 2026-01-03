/**
 * Mock LLM 提供商（测试用）
 * @module ace/providers/mock
 * @see openspec/changes/v3.0-ace-integration/specs/ace/llm-reflect.fspec.md
 *
 * 实现 AC-005: 提供 Mock 适配器用于测试
 */

const { BaseLLMProvider, registerProvider } = require('../llm-provider');

// ============================================================================
// Mock 提供商
// ============================================================================

/**
 * Mock LLM 提供商
 * 用于测试，返回预设的响应
 */
class MockProvider extends BaseLLMProvider {
  /**
   * @param {Object} config - 配置
   */
  constructor(config) {
    super('mock', config);
    this.responses = config.mockResponses || {};
    this.callHistory = [];
  }

  /**
   * 检查可用性
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    return true;
  }

  /**
   * 分析观察
   * @param {Object[]} observations - 观察列表
   * @param {Object} context - 项目上下文
   * @returns {Promise<Object[]>}
   */
  async analyzeObservations(observations, context) {
    this.callHistory.push({
      method: 'analyzeObservations',
      args: { observations, context },
      timestamp: new Date().toISOString()
    });

    // 如果有预设响应，使用它
    if (this.responses.analyzeObservations) {
      if (typeof this.responses.analyzeObservations === 'function') {
        return this.responses.analyzeObservations(observations, context);
      }
      return this.responses.analyzeObservations;
    }

    // 默认：基于观察生成模拟反思
    return this.generateMockReflections(observations);
  }

  /**
   * 生成模拟反思
   * @param {Object[]} observations - 观察列表
   * @returns {Object[]}
   */
  generateMockReflections(observations) {
    if (observations.length === 0) {
      return [];
    }

    // 按类型分组
    const byType = {};
    for (const obs of observations) {
      const type = obs.type || 'unknown';
      if (!byType[type]) {
        byType[type] = [];
      }
      byType[type].push(obs);
    }

    // 为每个类型生成反思
    const reflections = [];
    for (const [type, obs] of Object.entries(byType)) {
      if (obs.length >= 2) {
        reflections.push({
          pattern: `${type}_aggregation`,
          confidence: 0.7 + Math.min(obs.length, 5) * 0.05,
          lesson: `[Mock] 检测到 ${obs.length} 个 ${type} 类型的观察，可能存在系统性问题`,
          observations: obs.map(o => o.id),
          suggested_actions: [
            `[Mock] 分析 ${type} 的根本原因`,
            `[Mock] 创建相关规格文档`
          ],
          reasoning: `[Mock] 基于类型聚合分析，${type} 类型出现 ${obs.length} 次`
        });
      }
    }

    return reflections;
  }

  /**
   * 建议提案
   * @param {Object} reflection - 反思
   * @returns {Promise<Object>}
   */
  async suggestProposal(reflection) {
    this.callHistory.push({
      method: 'suggestProposal',
      args: { reflection },
      timestamp: new Date().toISOString()
    });

    // 如果有预设响应，使用它
    if (this.responses.suggestProposal) {
      if (typeof this.responses.suggestProposal === 'function') {
        return this.responses.suggestProposal(reflection);
      }
      return this.responses.suggestProposal;
    }

    // 默认响应
    return {
      name: `fix-${reflection.pattern.replace(/_/g, '-')}`,
      summary: `[Mock] 解决 ${reflection.pattern} 问题`,
      phases: [
        'Phase 1: 分析和规划',
        'Phase 2: 实现修复',
        'Phase 3: 验证和文档'
      ],
      specs: [
        {
          type: 'create',
          spec: `${reflection.pattern.replace(/_/g, '-')}.fspec.md`,
          reason: '[Mock] 新建规格以定义修复方案'
        }
      ]
    };
  }

  /**
   * 获取调用历史
   * @returns {Object[]}
   */
  getCallHistory() {
    return this.callHistory;
  }

  /**
   * 清除调用历史
   */
  clearCallHistory() {
    this.callHistory = [];
  }

  /**
   * 设置模拟响应
   * @param {string} method - 方法名
   * @param {*} response - 响应
   */
  setMockResponse(method, response) {
    this.responses[method] = response;
  }

  /**
   * 模拟错误
   * @param {string} method - 方法名
   * @param {Error} error - 错误
   */
  setMockError(method, error) {
    this.responses[method] = () => {
      throw error;
    };
  }
}

// 注册提供商
registerProvider('mock', MockProvider);

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  MockProvider
};
