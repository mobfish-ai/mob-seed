/**
 * Ollama LLM 提供商（本地模型）
 * @module ace/providers/ollama
 * @see openspec/changes/v3.0-ace-integration/specs/ace/llm-reflect.fspec.md
 *
 * 实现 AC-004: 实现 Ollama 本地适配器
 */

const { BaseLLMProvider, registerProvider } = require('../llm-provider');

// ============================================================================
// Ollama 提供商
// ============================================================================

/**
 * Ollama LLM 提供商
 * 支持本地运行的 Ollama 模型
 */
class OllamaProvider extends BaseLLMProvider {
  /**
   * @param {Object} config - 配置
   */
  constructor(config) {
    super('ollama', config);
    this.model = config.model || 'llama3';
    this.baseUrl = config.base_url || 'http://localhost:11434';
    this.options = {
      temperature: 0.3,
      ...(config.options || {})
    };
  }

  /**
   * 检查可用性
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const response = await this.fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 调用 Ollama API
   * @param {string} prompt - 提示词
   * @returns {Promise<string>}
   */
  async callAPI(prompt) {
    const response = await this.fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        prompt: `你是一个软件开发分析助手，擅长识别代码中的模式和问题。请用中文回答，输出格式为 JSON。

${prompt}`,
        stream: false,
        options: {
          temperature: this.options.temperature
        }
      })
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama API 错误: ${error}`);
    }

    const data = await response.json();
    return data.response || '';
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
registerProvider('ollama', OllamaProvider);

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  OllamaProvider
};
