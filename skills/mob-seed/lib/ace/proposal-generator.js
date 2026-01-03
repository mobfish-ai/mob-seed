/**
 * 提案生成器
 * @module ace/proposal-generator
 * @see openspec/changes/v3.0-ace-integration/specs/ace/auto-propose.fspec.md
 *
 * 实现 REQ-001, REQ-004, REQ-005, REQ-006
 */

const fs = require('fs');
const path = require('path');
const { breakdownToPhases, formatPhasesAsMarkdown } = require('./phase-breakdown');
const { suggestSpecs, formatSuggestionsAsMarkdown } = require('./spec-suggester');

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 提案草稿
 * @typedef {Object} ProposalDraft
 * @property {string} name - 提案名称
 * @property {string} created - 创建时间
 * @property {Object} source - 来源信息
 * @property {string} overview - 概述
 * @property {Object[]} sources - 来源追溯列表
 * @property {string} analysis - 问题分析
 * @property {string} solution - 建议方案
 * @property {Object[]} phases - 实施阶段
 * @property {Object[]} specSuggestions - 规格建议
 * @property {Object[]} [risks] - 风险评估
 * @property {string[]} [acceptanceCriteria] - 验收标准
 */

/**
 * 生成选项
 * @typedef {Object} GenerateOptions
 * @property {string} [templatePath] - 自定义模板路径
 * @property {boolean} [useLLM] - 是否使用 LLM 增强
 * @property {Object} [llmAnalyzer] - LLM 分析器实例
 */

// ============================================================================
// 模板引擎
// ============================================================================

/**
 * 简易 Handlebars 模板引擎
 * 支持: {{var}}, {{#each}}, {{#if}}, {{/each}}, {{/if}}
 */
class SimpleTemplateEngine {
  /**
   * 编译模板
   * @param {string} template - 模板字符串
   * @returns {function}
   */
  compile(template) {
    return (context) => this.render(template, context);
  }

  /**
   * 渲染模板
   * @param {string} template - 模板字符串
   * @param {Object} context - 上下文数据
   * @returns {string}
   */
  render(template, context) {
    let result = template;

    // 处理 {{#each}}
    result = this.processEach(result, context);

    // 处理 {{#if}}
    result = this.processIf(result, context);

    // 处理简单变量
    result = this.processVariables(result, context);

    return result;
  }

  /**
   * 处理 {{#each}} 循环
   */
  processEach(template, context) {
    const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

    return template.replace(eachRegex, (match, arrayName, content) => {
      const array = this.getValue(context, arrayName);
      if (!Array.isArray(array)) {
        return '';
      }

      return array.map((item, index) => {
        // 如果 item 是对象，展开其属性到上下文中
        const itemProps = (typeof item === 'object' && item !== null) ? item : {};
        const itemContext = {
          ...context,
          ...itemProps,
          this: item,
          '@index': index,
          '@first': index === 0,
          '@last': index === array.length - 1
        };

        // 递归处理嵌套
        let itemResult = this.processEach(content, itemContext);
        itemResult = this.processIf(itemResult, itemContext);
        itemResult = this.processVariables(itemResult, itemContext);

        return itemResult;
      }).join('');
    });
  }

  /**
   * 处理 {{#if}} 条件
   */
  processIf(template, context) {
    const ifRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

    return template.replace(ifRegex, (match, condition, content) => {
      // 简单条件评估
      let value;

      // 检查是否是比较表达式
      const eqMatch = condition.match(/\(eq\s+(\w+)\s+"([^"]+)"\)/);
      if (eqMatch) {
        const fieldValue = this.getValue(context, eqMatch[1]);
        value = fieldValue === eqMatch[2];
      } else {
        value = this.getValue(context, condition.trim());
      }

      // 空数组视为 falsy
      if (Array.isArray(value) && value.length === 0) {
        value = false;
      }

      if (value) {
        let result = this.processEach(content, context);
        result = this.processIf(result, context);
        result = this.processVariables(result, context);
        return result;
      }

      return '';
    });
  }

  /**
   * 处理变量替换
   */
  processVariables(template, context) {
    // 处理辅助函数 {{add @index 1}}
    template = template.replace(/\{\{add\s+@index\s+(\d+)\}\}/g, (match, num) => {
      const index = context['@index'];
      return typeof index === 'number' ? String(index + parseInt(num, 10)) : match;
    });

    // 处理 {{this}}
    template = template.replace(/\{\{this\}\}/g, () => {
      return context.this !== undefined ? String(context.this) : '';
    });

    // 处理嵌套属性 {{source.id}}
    template = template.replace(/\{\{([^#/}][^}]*)\}\}/g, (match, path) => {
      const value = this.getValue(context, path.trim());
      return value !== undefined ? String(value) : '';
    });

    return template;
  }

  /**
   * 获取嵌套属性值
   */
  getValue(context, path) {
    const parts = path.split('.');
    let value = context;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }
}

// ============================================================================
// 核心生成器
// ============================================================================

/**
 * 提案生成器
 */
class ProposalGenerator {
  /**
   * @param {string} projectRoot - 项目根目录
   */
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.templateEngine = new SimpleTemplateEngine();
    this.defaultTemplatePath = path.join(__dirname, '..', '..', 'templates', 'proposal.md.hbs');
  }

  /**
   * 从反思生成提案草稿 (AC-001 ~ AC-004)
   * @param {Object} reflection - 反思对象
   * @param {Object[]} observations - 关联的观察列表
   * @param {GenerateOptions} [options] - 生成选项
   * @returns {Promise<ProposalDraft>}
   */
  async generateDraft(reflection, observations, options = {}) {
    // 生成提案名称
    const name = this.generateName(reflection);

    // 生成概述 (AC-002: 从教训描述)
    const overview = reflection.lesson || '待填写';

    // 生成问题分析
    const analysis = this.generateAnalysis(reflection, observations);

    // 生成建议方案
    const solution = this.generateSolution(reflection);

    // 生成实施阶段 (REQ-002)
    const phases = breakdownToPhases(reflection.suggested_actions || []);

    // 生成规格建议 (REQ-003)
    const specSuggestions = suggestSpecs(reflection, observations);

    // 生成来源追溯
    const sources = this.generateSources(reflection, observations);

    // 基础草稿
    const draft = {
      name,
      created: new Date().toISOString(),
      source: {
        id: reflection.id || 'unknown',
        type: 'reflection'
      },
      overview,
      sources,
      analysis,
      solution,
      phases,
      specSuggestions
    };

    // REQ-006: LLM 增强 (可选)
    if (options.useLLM && options.llmAnalyzer) {
      await this.enhanceWithLLM(draft, reflection, options.llmAnalyzer);
    }

    return draft;
  }

  /**
   * 生成提案名称
   * @param {Object} reflection - 反思对象
   * @returns {string}
   */
  generateName(reflection) {
    if (reflection.pattern) {
      return `fix-${reflection.pattern.replace(/_/g, '-')}`;
    }

    // 从教训提取关键词
    const lesson = reflection.lesson || '';
    const keywords = lesson
      .replace(/[^\w\u4e00-\u9fa5\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 2)
      .slice(0, 3);

    if (keywords.length > 0) {
      return `improve-${keywords.join('-').toLowerCase()}`;
    }

    return `proposal-${Date.now()}`;
  }

  /**
   * 生成问题分析
   * @param {Object} reflection - 反思对象
   * @param {Object[]} observations - 观察列表
   * @returns {string}
   */
  generateAnalysis(reflection, observations) {
    const lines = [];

    // 统计信息
    if (observations.length > 0) {
      const byType = {};
      for (const obs of observations) {
        byType[obs.type] = (byType[obs.type] || 0) + 1;
      }

      lines.push(`共 ${observations.length} 个相关观察：`);
      for (const [type, count] of Object.entries(byType)) {
        lines.push(`- ${type}: ${count} 个`);
      }
      lines.push('');
    }

    // 反思分析
    if (reflection.analysis) {
      lines.push(reflection.analysis);
    } else if (reflection.lesson) {
      lines.push(`根据观察分析，${reflection.lesson}`);
    }

    // 模式信息
    if (reflection.pattern) {
      lines.push('');
      lines.push(`识别的模式: ${reflection.pattern}`);
      lines.push(`置信度: ${Math.round((reflection.confidence || 0) * 100)}%`);
    }

    return lines.join('\n');
  }

  /**
   * 生成建议方案
   * @param {Object} reflection - 反思对象
   * @returns {string}
   */
  generateSolution(reflection) {
    const actions = reflection.suggested_actions || [];

    if (actions.length === 0) {
      return '待补充具体解决方案';
    }

    const lines = ['基于反思分析，建议采取以下措施：', ''];

    for (let i = 0; i < actions.length; i++) {
      lines.push(`${i + 1}. ${actions[i]}`);
    }

    return lines.join('\n');
  }

  /**
   * 生成来源追溯
   * @param {Object} reflection - 反思对象
   * @param {Object[]} observations - 观察列表
   * @returns {Object[]}
   */
  generateSources(reflection, observations) {
    const sources = [];

    // 添加反思来源
    sources.push({
      id: reflection.id || 'unknown',
      type: 'reflection',
      description: reflection.lesson?.slice(0, 50) || 'N/A',
      created: reflection.created || 'N/A'
    });

    // 添加观察来源
    for (const obs of observations.slice(0, 10)) {
      sources.push({
        id: obs.id,
        type: obs.type,
        description: obs.description?.slice(0, 50) || 'N/A',
        created: obs.created || 'N/A'
      });
    }

    return sources;
  }

  /**
   * LLM 增强草稿 (REQ-006)
   * @param {ProposalDraft} draft - 草稿
   * @param {Object} reflection - 反思
   * @param {Object} llmAnalyzer - LLM 分析器
   */
  async enhanceWithLLM(draft, reflection, llmAnalyzer) {
    try {
      const suggestion = await llmAnalyzer.suggestProposal(reflection);

      if (suggestion) {
        // AC-021: 增强分析
        if (suggestion.enhanced_analysis) {
          draft.analysis += '\n\n### LLM 深化分析\n\n' + suggestion.enhanced_analysis;
        }

        // AC-022: 替代方案
        if (suggestion.alternative_solutions && suggestion.alternative_solutions.length > 0) {
          draft.solution += '\n\n### 替代方案\n\n';
          suggestion.alternative_solutions.forEach((alt, i) => {
            draft.solution += `${i + 1}. ${alt}\n`;
          });
        }

        // AC-023: 风险评估
        if (suggestion.risks && suggestion.risks.length > 0) {
          draft.risks = suggestion.risks;
        }

        // AC-024: 验收标准
        if (suggestion.acceptance_criteria && suggestion.acceptance_criteria.length > 0) {
          draft.acceptanceCriteria = suggestion.acceptance_criteria;
        }
      }
    } catch (error) {
      console.warn(`LLM 增强失败: ${error.message}`);
    }
  }

  /**
   * 加载模板 (AC-013 ~ AC-015)
   * @param {string} [customPath] - 自定义模板路径
   * @returns {string}
   */
  loadTemplate(customPath) {
    // AC-015: 支持自定义模板
    const templatePath = customPath ||
      path.join(this.projectRoot, '.seed', 'templates', 'proposal.md.hbs');

    if (fs.existsSync(templatePath)) {
      return fs.readFileSync(templatePath, 'utf-8');
    }

    // AC-014: 使用默认模板
    if (fs.existsSync(this.defaultTemplatePath)) {
      return fs.readFileSync(this.defaultTemplatePath, 'utf-8');
    }

    // 硬编码的最小模板
    return this.getMinimalTemplate();
  }

  /**
   * 获取最小模板
   * @returns {string}
   */
  getMinimalTemplate() {
    return `# {{name}}

> **状态**: draft
> **创建**: {{created}}
> **来源**: {{source.id}}

## 概述

{{overview}}

## 问题分析

{{analysis}}

## 建议方案

{{solution}}

## 实施阶段

{{#each phases}}
### Phase {{add @index 1}}: {{name}}

{{#each tasks}}
- [ ] {{this}}
{{/each}}

{{/each}}
`;
  }

  /**
   * 渲染提案 (AC-016)
   * @param {ProposalDraft} draft - 草稿
   * @param {string} [templatePath] - 模板路径
   * @returns {string}
   */
  render(draft, templatePath) {
    const template = this.loadTemplate(templatePath);
    return this.templateEngine.render(template, draft);
  }

  /**
   * 保存提案
   * @param {ProposalDraft} draft - 草稿
   * @param {string} [outputPath] - 输出路径
   * @returns {string} 保存的路径
   */
  save(draft, outputPath) {
    const content = this.render(draft);

    const targetPath = outputPath ||
      path.join(this.projectRoot, 'openspec', 'changes', draft.name, 'proposal.md');

    // 确保目录存在
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(targetPath, content, 'utf-8');
    return targetPath;
  }
}

// ============================================================================
// 交互式编辑辅助函数 (REQ-005)
// ============================================================================

/**
 * 格式化草稿章节用于显示 (AC-017)
 * @param {ProposalDraft} draft - 草稿
 * @returns {Object[]}
 */
function formatDraftSections(draft) {
  return [
    {
      name: '概述',
      key: 'overview',
      content: draft.overview,
      editable: true
    },
    {
      name: '问题分析',
      key: 'analysis',
      content: draft.analysis,
      editable: true
    },
    {
      name: '建议方案',
      key: 'solution',
      content: draft.solution,
      editable: true
    },
    {
      name: '实施阶段',
      key: 'phases',
      content: formatPhasesAsMarkdown(draft.phases),
      editable: true,
      isPhases: true
    },
    {
      name: '规格建议',
      key: 'specSuggestions',
      content: formatSuggestionsAsMarkdown(draft.specSuggestions),
      editable: false
    }
  ];
}

/**
 * 格式化章节显示框
 * @param {Object} section - 章节
 * @returns {string}
 */
function formatSectionBox(section) {
  const lines = [
    `┌${'─'.repeat(50)}┐`,
    `│ ${section.name}:${' '.repeat(50 - section.name.length - 1)}│`
  ];

  // 内容行
  const contentLines = section.content.split('\n').slice(0, 5);
  for (const line of contentLines) {
    const trimmed = line.slice(0, 48);
    lines.push(`│ ${trimmed}${' '.repeat(48 - trimmed.length)} │`);
  }

  if (section.content.split('\n').length > 5) {
    lines.push(`│ ...${' '.repeat(46)} │`);
  }

  // 操作提示
  lines.push(`│${' '.repeat(50)}│`);
  if (section.editable) {
    if (section.isPhases) {
      lines.push(`│ [e] 编辑  [+] 添加任务  [-] 删除任务${' '.repeat(11)} │`);
    } else {
      lines.push(`│ [e] 编辑  [✓] 确认${' '.repeat(30)} │`);
    }
  }
  lines.push(`└${'─'.repeat(50)}┘`);

  return lines.join('\n');
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  ProposalGenerator,
  SimpleTemplateEngine,
  formatDraftSections,
  formatSectionBox
};
