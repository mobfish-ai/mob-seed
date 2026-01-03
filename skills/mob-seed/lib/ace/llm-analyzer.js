/**
 * LLM 分析器
 * @module ace/llm-analyzer
 * @see openspec/changes/v3.0-ace-integration/specs/ace/llm-reflect.fspec.md
 *
 * 实现 REQ-003, REQ-004, REQ-005: 观察分析增强、回退机制、结果合并
 */

const fs = require('fs');
const path = require('path');
const { getProvider, mergeConfig } = require('./llm-provider');
const { LLMRateLimiter } = require('./llm-rate-limiter');

// 加载所有提供商
require('./providers/mock');
require('./providers/openai');
require('./providers/anthropic');
require('./providers/ollama');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 分析结果
 * @typedef {Object} AnalysisResult
 * @property {boolean} success - 是否成功
 * @property {Object[]} reflections - 反思候选列表
 * @property {string} source - 来源 (llm/rule/hybrid)
 * @property {Object} [meta] - 元信息
 */

// ============================================================================
// LLM 分析器
// ============================================================================

/**
 * LLM 增强分析器
 */
class LLMAnalyzer {
  /**
   * @param {string} projectRoot - 项目根目录
   * @param {Object} [config] - LLM 配置
   */
  constructor(projectRoot, config = {}) {
    this.projectRoot = projectRoot;
    this.config = mergeConfig(config);
    this.rateLimiter = new LLMRateLimiter(projectRoot, this.config.limits);
    this.provider = null;

    // 如果启用 LLM，初始化提供商
    if (this.config.enabled) {
      try {
        this.provider = getProvider(this.config);
      } catch (error) {
        console.warn(`LLM 提供商初始化失败: ${error.message}`);
      }
    }
  }

  /**
   * 加载项目上下文
   * @returns {Object}
   */
  loadContext() {
    const configPath = path.join(this.projectRoot, '.seed', 'config.json');
    let projectConfig = {};

    try {
      if (fs.existsSync(configPath)) {
        projectConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
    } catch {
      // 忽略配置读取错误
    }

    return {
      project_name: projectConfig.name || path.basename(this.projectRoot),
      tech_stack: projectConfig.tech_stack || 'JavaScript',
      specs: this.listSpecs()
    };
  }

  /**
   * 列出项目规格
   * @returns {string[]}
   */
  listSpecs() {
    const specsDir = path.join(this.projectRoot, 'openspec', 'specs');
    const specs = [];

    try {
      if (fs.existsSync(specsDir)) {
        const walk = (dir) => {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              walk(fullPath);
            } else if (file.endsWith('.fspec.md')) {
              specs.push(path.relative(specsDir, fullPath));
            }
          }
        };
        walk(specsDir);
      }
    } catch {
      // 忽略目录遍历错误
    }

    return specs;
  }

  /**
   * 检查 LLM 是否可用
   * @returns {Promise<boolean>}
   */
  async isLLMAvailable() {
    if (!this.config.enabled || !this.provider) {
      return false;
    }

    try {
      return await this.provider.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * 分析观察（带回退）
   * @param {Object[]} observations - 观察列表
   * @param {function} ruleBasedAnalysis - 规则分析函数
   * @returns {Promise<AnalysisResult>}
   */
  async analyzeWithFallback(observations, ruleBasedAnalysis) {
    // AC-015: LLM 禁用时使用规则匹配
    if (!this.config.enabled || !this.provider) {
      const ruleResults = await ruleBasedAnalysis(observations);
      return {
        success: true,
        reflections: this.markSource(ruleResults, 'rule'),
        source: 'rule',
        meta: { reason: 'LLM 未启用' }
      };
    }

    // 检查限流
    const limitCheck = this.rateLimiter.checkLimit();
    if (!limitCheck.allowed) {
      console.warn(`LLM 限流: ${limitCheck.reason}`);
      const ruleResults = await ruleBasedAnalysis(observations);
      return {
        success: true,
        reflections: this.markSource(ruleResults, 'rule'),
        source: 'rule',
        meta: { reason: limitCheck.reason }
      };
    }

    // 检查观察数量限制
    const obsCheck = this.rateLimiter.checkObservationLimit(observations.length);
    if (!obsCheck.allowed) {
      // 截取前 N 个观察
      observations = observations.slice(0, obsCheck.maxAllowed);
      console.warn(`观察数量已限制为 ${obsCheck.maxAllowed} 个`);
    }

    // 尝试 LLM 分析
    try {
      const context = this.loadContext();
      const llmResults = await this.provider.analyzeObservations(observations, context);

      // 记录调用
      this.rateLimiter.recordCall();

      // 获取规则匹配结果
      const ruleResults = await ruleBasedAnalysis(observations);

      // 合并结果
      const merged = this.mergeResults(llmResults, ruleResults);

      return {
        success: true,
        reflections: merged,
        source: 'hybrid',
        meta: {
          llmCount: llmResults.length,
          ruleCount: ruleResults.length,
          mergedCount: merged.length
        }
      };
    } catch (error) {
      // AC-016: API 失败时自动回退
      // AC-017: 记录回退原因
      console.warn(`LLM 分析失败，回退到规则匹配: ${error.message}`);

      const ruleResults = await ruleBasedAnalysis(observations);
      return {
        success: true,
        reflections: this.markSource(ruleResults, 'rule'),
        source: 'rule',
        meta: {
          reason: error.message,
          fallback: true
        }
      };
    }
  }

  /**
   * 合并 LLM 和规则匹配结果 (REQ-005)
   * @param {Object[]} llmResults - LLM 结果
   * @param {Object[]} ruleResults - 规则结果
   * @returns {Object[]}
   */
  mergeResults(llmResults, ruleResults) {
    const merged = [];
    const seen = new Set();

    // AC-019: 添加高置信度 LLM 结果
    for (const r of llmResults) {
      if (r.confidence >= 0.7) {
        merged.push({ ...r, source: 'llm' });
        // AC-020: 用观察集合作为去重键
        const key = this.getObservationKey(r.observations);
        seen.add(key);
      }
    }

    // AC-019: 添加规则匹配结果（不重复）
    for (const r of ruleResults) {
      const key = this.getObservationKey(r.observations);
      if (!seen.has(key)) {
        merged.push({ ...r, source: 'rule' });
        seen.add(key);
      }
    }

    // AC-022: 按置信度排序
    return merged.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 获取观察集合的唯一键
   * @param {string[]} observations - 观察 ID 列表
   * @returns {string}
   */
  getObservationKey(observations) {
    if (!Array.isArray(observations)) {
      return '';
    }
    return [...observations].sort().join(',');
  }

  /**
   * 标记结果来源 (AC-021)
   * @param {Object[]} results - 结果列表
   * @param {string} source - 来源
   * @returns {Object[]}
   */
  markSource(results, source) {
    return results.map(r => ({ ...r, source }));
  }

  /**
   * 建议提案
   * @param {Object} reflection - 反思
   * @returns {Promise<Object|null>}
   */
  async suggestProposal(reflection) {
    if (!this.config.enabled || !this.provider) {
      return null;
    }

    // 检查限流
    const limitCheck = this.rateLimiter.checkLimit();
    if (!limitCheck.allowed) {
      console.warn(`LLM 限流: ${limitCheck.reason}`);
      return null;
    }

    try {
      const suggestion = await this.provider.suggestProposal(reflection);
      this.rateLimiter.recordCall();
      return suggestion;
    } catch (error) {
      console.warn(`LLM 提案建议失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取使用统计
   * @returns {Object}
   */
  getUsageSummary() {
    return {
      enabled: this.config.enabled,
      provider: this.config.provider,
      model: this.config.model,
      ...this.rateLimiter.getUsageSummary()
    };
  }
}

// ============================================================================
// 格式化函数 (REQ-006)
// ============================================================================

/**
 * 格式化反思候选显示 (AC-023 ~ AC-026)
 * @param {Object} candidate - 反思候选
 * @param {number} index - 索引
 * @returns {string}
 */
function formatReflectionCandidate(candidate, index) {
  const sourceLabel = candidate.source === 'llm' ? '[LLM 分析] 🤖' : '[规则匹配]';
  const confidencePercent = Math.round(candidate.confidence * 100);

  let output = `[${index}] ${candidate.pattern} ${sourceLabel}
    置信度: ${confidencePercent}%
    教训: ${candidate.lesson}
    观察: ${(candidate.observations || []).join(', ')}`;

  if (candidate.suggested_actions && candidate.suggested_actions.length > 0) {
    output += `\n    建议行动:`;
    for (const action of candidate.suggested_actions) {
      output += `\n      - ${action}`;
    }
  }

  output += `\n    操作: [a] 接受  [r] 拒绝  [s] 跳过  [d] 详情`;

  return output;
}

/**
 * 格式化反思详情 (AC-024 ~ AC-026)
 * @param {Object} candidate - 反思候选
 * @param {Object[]} observations - 观察详情
 * @returns {string}
 */
function formatReflectionDetails(candidate, observations) {
  let output = `📊 分析依据:\n`;

  for (const obs of observations) {
    output += `- 观察 ${obs.id}: ${obs.description || 'N/A'}\n`;
    if (obs.context?.error_message) {
      output += `  错误: ${obs.context.error_message}\n`;
    }
  }

  if (candidate.source === 'llm' && candidate.reasoning) {
    output += `\n🤖 LLM 推理:\n"${candidate.reasoning}"\n`;
  }

  if (candidate.suggested_actions && candidate.suggested_actions.length > 0) {
    output += `\n📝 建议行动:\n`;
    candidate.suggested_actions.forEach((action, i) => {
      output += `${i + 1}. ${action}\n`;
    });
  }

  return output;
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  LLMAnalyzer,
  formatReflectionCandidate,
  formatReflectionDetails
};
