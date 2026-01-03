/**
 * Anthropic LLM 提供商
 * @module ace/providers/anthropic
 * @see openspec/changes/v3.0-ace-integration/specs/ace/llm-reflect.fspec.md
 *
 * 实现 AC-003: 实现 Anthropic 适配器
 */

const { BaseLLMProvider, registerProvider } = require('../llm-provider');

// ============================================================================
// Anthropic 提供商
// ============================================================================

/**
 * Anthropic LLM 提供商
 */
class AnthropicProvider extends BaseLLMProvider {
  /**
   * @param {Object} config - 配置
   */
  constructor(config) {
    super('anthropic', config);
    this.model = config.model || 'claude-3-haiku-20240307';
    this.apiKeyEnv = config.api_key_env || 'ANTHROPIC_API_KEY';
    this.baseUrl = config.base_url || 'https://api.anthropic.com/v1';
    this.options = {
      temperature: 0.3,
      max_tokens: 1000,
      ...(config.options || {})
    };
  }

  /**
   * 获取 API 密钥
   * @returns {string|null}
   */
  getApiKey() {
    return process.env[this.apiKeyEnv] || null;
  }

  /**
   * 检查可用性
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    const apiKey = this.getApiKey();
    return !!apiKey;
  }

  /**
   * 调用 Anthropic API
   * @param {string} prompt - 提示词
   * @returns {Promise<string>}
   */
  async callAPI(prompt) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(`未设置环境变量 ${this.apiKeyEnv}`);
    }

    const response = await this.fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.options.max_tokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        system: '你是一个软件开发分析助手，擅长识别代码中的模式和问题。请用中文回答，输出格式为 JSON。'
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Anthropic API 错误: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  }

  /**
   * 分析观察
   * @param {Object[]} observations - 观察列表
   * @param {Object} context - 项目上下文
   * @returns {Promise<Object[]>}
   */
  async analyzeObservations(observations, context) {
    const prompt = this.buildAnalysisPrompt(observations, context);
    const response = await this.callAPI(prompt);
    const parsed = this.parseJSONResponse(response);
    return parsed.reflections || [];
  }

  /**
   * 建议提案
   * @param {Object} reflection - 反思
   * @returns {Promise<Object>}
   */
  async suggestProposal(reflection) {
    const prompt = this.buildProposalPrompt(reflection);
    const response = await this.callAPI(prompt);
    return this.parseJSONResponse(response);
  }

  /**
   * fetch 封装（便于测试时 mock）
   * @param {string} url - URL
   * @param {Object} options - 请求选项
   * @returns {Promise<Response>}
   */
  async fetch(url, options) {
    return fetch(url, options);
  }
}

// 注册提供商
registerProvider('anthropic', AnthropicProvider);

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  AnthropicProvider
};
