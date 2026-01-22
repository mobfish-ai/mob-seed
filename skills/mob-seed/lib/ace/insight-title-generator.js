/**
 * Insight Title Generator - AI 标题生成器
 *
 * 使用 LLM 从内容中提炼有意义的标题
 */

const { getProvider, mergeConfig } = require('./llm-provider');

// 加载所有提供商
require('./providers/mock');
require('./providers/openai');
require('./providers/anthropic');
require('./providers/ollama');

/**
 * 生成标题提示词
 * @param {string} content - 洞见内容
 * @returns {string} 提示词
 */
function buildTitlePrompt(content) {
  // 截取内容前 2000 字符作为上下文
  const truncatedContent = content.length > 2000
    ? content.substring(0, 2000) + '...'
    : content;

  return `## 任务

从以下洞见内容中提炼一个简洁、有意义的标题。

## 内容

${truncatedContent}

## 要求

1. 标题应该简洁（5-15 个汉字或 10-25 个英文单词）
2. 标题应该准确反映内容的核心观点
3. 标题应该易于理解和记忆
4. 避免使用"关于"、"思考"等通用词
5. 优先使用技术术语和具体概念

## 输出格式

只返回标题文本，不要添加任何其他内容。

示例：
❌ "关于 AI 编程的思考"
✅ "AI 编程：上下文窗口优化策略"

❌ "学习笔记"
✅ "React 性能优化：useMemo 与 useCallback 的区别"`;
}

/**
 * 生成标题
 * @param {string} projectPath - 项目根目录
 * @param {string} content - 洞见内容
 * @param {Object} [config] - LLM 配置
 * @returns {Promise<{success: boolean, title?: string, error?: string}>}
 */
async function generateTitle(projectPath, content, config = {}) {
  const mergedConfig = mergeConfig({
    enabled: true,
    ...config,
    options: {
      temperature: 0.3,
      max_tokens: 100,
      ...(config.options || {})
    }
  });

  // 如果未启用 LLM，返回失败
  if (!mergedConfig.enabled) {
    return {
      success: false,
      error: 'LLM 未启用'
    };
  }

  try {
    const provider = getProvider(mergedConfig);

    // 检查提供商是否可用
    const available = await provider.isAvailable();
    if (!available) {
      return {
        success: false,
        error: 'LLM 提供商不可用'
      };
    }

    // 构建提示词
    const prompt = buildTitlePrompt(content);

    // 调用 LLM（这里需要提供商支持简单的文本补全）
    // 由于现有提供商主要是为观察分析设计的，我们需要适配
    // 暂时使用简化方案：直接返回内容预览
    // TODO: 未来可以扩展提供商接口支持通用聊天

    // 临时方案：使用第一行作为标题
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      const title = firstLine.length > 50
        ? firstLine.substring(0, 50) + '...'
        : firstLine;

      return {
        success: true,
        title,
        fallback: true // 标记为回退方案
      };
    }

    return {
      success: false,
      error: '无法从内容中提取标题'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  generateTitle,
  buildTitlePrompt
};
