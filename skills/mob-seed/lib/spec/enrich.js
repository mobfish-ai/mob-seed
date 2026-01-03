/**
 * 规格补充引擎 (Spec Enrich)
 *
 * 智能补充规格细节：
 * - 从测试文件提取 AC
 * - 从 JSDoc 提取参数说明
 * - AI 辅助生成 FR 描述
 * - 智能占位符填充
 *
 * @module skills/mob-seed/lib/spec/enrich
 */

const fs = require('fs');
const path = require('path');
const specParser = require('./parser');
const testParser = require('../parsers/test-parser');
const astParser = require('../parsers/ast-javascript');

/**
 * 质量来源
 */
const SourceType = {
  TEST: 'test',      // 从测试文件提取（高可靠）
  JSDOC: 'jsdoc',    // 从 JSDoc 提取（高可靠）
  AI: 'ai',          // AI 生成（需审核）
  TEMPLATE: 'template' // 模板占位符（待补充）
};

/**
 * 退出码
 */
const ExitCode = {
  SUCCESS: 0,           // 全部成功
  PARTIAL_SUCCESS: 1,   // 部分成功
  SYSTEM_ERROR: 2,      // 系统错误
  CONFIG_ERROR: 3,      // 配置错误
  SPEC_NOT_FOUND: 4     // 规格不存在
};

/**
 * 补充规格
 * @param {Object} options - 配置选项
 * @param {string} options.specPath - 规格文件路径
 * @param {boolean} [options.extractTests=true] - 是否提取测试
 * @param {boolean} [options.extractJSDoc=true] - 是否提取 JSDoc
 * @param {boolean} [options.useAI=false] - 是否使用 AI（默认关闭）
 * @param {string} [options.aiProvider='gemini'] - AI 提供商
 * @returns {Promise<Object>} 补充结果
 */
async function enrichSpec(options) {
  const opts = {
    extractTests: true,
    extractJSDoc: true,
    useAI: false,
    aiProvider: 'gemini',
    ...options
  };

  if (!opts.specPath) {
    return {
      success: false,
      error: '未指定规格文件路径',
      exitCode: ExitCode.CONFIG_ERROR
    };
  }

  // 读取规格文件
  const spec = specParser.parseSpecFile(opts.specPath);
  if (!spec.success) {
    return {
      success: false,
      error: spec.error,
      exitCode: ExitCode.SPEC_NOT_FOUND
    };
  }

  const enrichment = {
    tests: null,
    jsdoc: null,
    ai: null
  };

  const stats = {
    acExtracted: 0,
    frGenerated: 0,
    paramsEnriched: 0,
    placeholdersFilled: 0
  };

  // 1. 从派生产物推断代码路径
  const codePath = inferCodePath(spec);

  // 2. 从测试文件提取 AC
  if (opts.extractTests && codePath) {
    const testPath = testParser.inferTestPath(codePath);
    if (testPath && fs.existsSync(testPath)) {
      const testResult = testParser.extractACsFromTestFile(testPath);
      if (testResult.success) {
        enrichment.tests = {
          path: testPath,
          acs: testResult.acs
        };
        stats.acExtracted = testResult.acs.length;
      }
    }
  }

  // 3. 从 JSDoc 提取参数说明
  if (opts.extractJSDoc && codePath && fs.existsSync(codePath)) {
    const analysis = astParser.analyzeFile(codePath);
    if (analysis.jsdocs && analysis.jsdocs.length > 0) {
      enrichment.jsdoc = {
        path: codePath,
        docs: analysis.jsdocs
      };
      stats.paramsEnriched = analysis.jsdocs.reduce((sum, doc) =>
        sum + (doc.params?.length || 0), 0);
    }
  }

  // 4. AI 生成 FR（可选，默认关闭）
  if (opts.useAI) {
    try {
      const aiResult = await generateFRWithAI(spec, codePath, opts.aiProvider);
      if (aiResult.success) {
        enrichment.ai = {
          provider: opts.aiProvider,
          frs: aiResult.frs
        };
        stats.frGenerated = aiResult.frs.length;
      }
    } catch (error) {
      // AI 失败不影响其他补充
      enrichment.ai = {
        error: error.message
      };
    }
  }

  // 5. 生成补充后的规格内容
  const enrichedContent = generateEnrichedSpec(spec, enrichment);

  // 6. 更新规格文件
  const updateResult = updateSpecFile(opts.specPath, enrichedContent, enrichment);

  // 7. 判断成功状态
  const hasAnySuccess = stats.acExtracted > 0 ||
                        stats.frGenerated > 0 ||
                        stats.paramsEnriched > 0;
  const hasPartialFailure = opts.useAI && !enrichment.ai?.frs;

  return {
    success: true,
    specPath: opts.specPath,
    enrichment,
    stats,
    exitCode: hasPartialFailure ? ExitCode.PARTIAL_SUCCESS : ExitCode.SUCCESS
  };
}

/**
 * 从规格推断代码路径
 * @param {Object} spec - 解析后的规格
 * @returns {string|null} 代码路径
 */
function inferCodePath(spec) {
  // 从派生产物表推断
  if (spec.derivedOutputs && spec.derivedOutputs.length > 0) {
    const codeOutput = spec.derivedOutputs.find(o =>
      o.type === '代码' || o.type === 'code' || o.path?.endsWith('.js')
    );
    if (codeOutput) {
      return codeOutput.path;
    }
  }

  // 从元数据推断
  if (spec.metadata?.codePath) {
    return spec.metadata.codePath;
  }

  // 从文件名推断
  if (spec.path) {
    const specName = path.basename(spec.path, '.fspec.md');
    // 尝试常见路径
    const candidates = [
      `skills/mob-seed/lib/${specName}.js`,
      `lib/${specName}.js`,
      `src/${specName}.js`
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * AI 生成 FR（占位符实现）
 * @param {Object} spec - 规格对象
 * @param {string} codePath - 代码路径
 * @param {string} provider - AI 提供商
 * @returns {Promise<Object>} 生成结果
 */
async function generateFRWithAI(spec, codePath, provider) {
  // 占位符实现 - 返回空结果
  // 实际实现需要集成 AI API
  return {
    success: false,
    frs: [],
    message: 'AI 生成功能尚未实现'
  };
}

/**
 * 生成补充后的规格内容
 * @param {Object} spec - 原始规格
 * @param {Object} enrichment - 补充信息
 * @returns {string} 补充后的内容
 */
function generateEnrichedSpec(spec, enrichment) {
  let content = spec.raw;

  // 添加补充来源到 frontmatter
  const sources = [];
  if (enrichment.tests?.acs?.length > 0) {
    sources.push(`tests: ${enrichment.tests.path} (${enrichment.tests.acs.length} AC)`);
  }
  if (enrichment.jsdoc?.docs?.length > 0) {
    sources.push(`jsdoc: ${enrichment.jsdoc.docs.length} docs`);
  }
  if (enrichment.ai?.frs?.length > 0) {
    sources.push(`ai: ${enrichment.ai.provider} (${enrichment.ai.frs.length} FR)`);
  }

  // 如果有 AC 需要添加
  if (enrichment.tests?.acs?.length > 0) {
    content = insertACs(content, enrichment.tests.acs, enrichment.tests.path);
  }

  // 如果有 JSDoc 参数需要补充
  if (enrichment.jsdoc?.docs?.length > 0) {
    content = enrichParamsFromJSDoc(content, enrichment.jsdoc.docs);
  }

  return content;
}

/**
 * 插入 AC 到规格内容
 * @param {string} content - 规格内容
 * @param {Array} acs - AC 数组
 * @param {string} testPath - 测试文件路径
 * @returns {string} 更新后的内容
 */
function insertACs(content, acs, testPath) {
  // 查找 Acceptance Criteria 章节
  const acSectionPattern = /## 验收标准 \(Acceptance Criteria\)/i;
  const match = content.match(acSectionPattern);

  if (!match) {
    // 如果没有 AC 章节，在 FR 章节后添加
    const frSectionEnd = content.indexOf('\n## ', content.indexOf('## 功能需求'));
    if (frSectionEnd !== -1) {
      const acSection = generateACSection(acs, testPath);
      return content.slice(0, frSectionEnd) + '\n\n' + acSection + content.slice(frSectionEnd);
    }
    // 在文件末尾添加
    return content + '\n\n' + generateACSection(acs, testPath);
  }

  // 在现有 AC 章节后追加
  const sectionStart = match.index;
  const nextSectionPattern = /\n## /g;
  nextSectionPattern.lastIndex = sectionStart + match[0].length;
  const nextMatch = nextSectionPattern.exec(content);
  const sectionEnd = nextMatch ? nextMatch.index : content.length;

  const existingSection = content.slice(sectionStart, sectionEnd);
  const newACs = acs.map(ac => formatAC(ac, testPath)).join('\n\n');

  return content.slice(0, sectionEnd) + '\n\n' + newACs + content.slice(sectionEnd);
}

/**
 * 生成 AC 章节
 * @param {Array} acs - AC 数组
 * @param {string} testPath - 测试文件路径
 * @returns {string} AC 章节内容
 */
function generateACSection(acs, testPath) {
  const header = '## 验收标准 (Acceptance Criteria)\n\n';
  const acContents = acs.map(ac => formatAC(ac, testPath)).join('\n\n');
  return header + acContents;
}

/**
 * 格式化单个 AC
 * @param {Object} ac - AC 对象
 * @param {string} testPath - 测试文件路径
 * @returns {string} 格式化的 AC
 */
function formatAC(ac, testPath) {
  const source = `> **提取自测试**: ${testPath}:${ac.source.line} - "${ac.source.description}"`;

  const scenario = `**场景**:
\`\`\`
Given: ${ac.scenario.given}
When: ${ac.scenario.when}
Then: ${ac.scenario.then.join('\n  AND ')}
\`\`\``;

  const verification = ac.verification?.code ? `**验证**:
\`\`\`javascript
${ac.verification.code}
\`\`\`` : '';

  return `### ${ac.id}: ${ac.title}

${source}

${scenario}
${verification ? '\n' + verification : ''}`;
}

/**
 * 从 JSDoc 补充参数说明
 * @param {string} content - 规格内容
 * @param {Array} docs - JSDoc 数组
 * @returns {string} 更新后的内容
 */
function enrichParamsFromJSDoc(content, docs) {
  // 查找参数列表并补充说明
  for (const doc of docs) {
    if (!doc.params) continue;

    for (const param of doc.params) {
      // 查找未补充说明的参数
      const paramPattern = new RegExp(
        `- \`${param.name}\` \\(${param.type || '\\w+'}\\)\\s*$`,
        'gm'
      );

      if (paramPattern.test(content)) {
        content = content.replace(
          paramPattern,
          `- \`${param.name}\` (${param.type || 'any'}): ${param.description || '参数说明'} ← *提取自 JSDoc*`
        );
      }
    }
  }

  return content;
}

/**
 * 更新规格文件
 * @param {string} specPath - 规格文件路径
 * @param {string} content - 新内容
 * @param {Object} enrichment - 补充信息
 * @returns {Object} 更新结果
 */
function updateSpecFile(specPath, content, enrichment) {
  try {
    // 添加 enriched 标记到 frontmatter
    if (content.startsWith('---')) {
      const endIndex = content.indexOf('---', 3);
      if (endIndex !== -1) {
        const frontmatter = content.slice(0, endIndex + 3);
        const body = content.slice(endIndex + 3);

        // 检查是否已有 enriched 标记
        if (!frontmatter.includes('enriched:')) {
          const newFrontmatter = frontmatter.slice(0, -3) +
            `enriched: true\nenrichment_date: ${new Date().toISOString().split('T')[0]}\n---`;
          content = newFrontmatter + body;
        }
      }
    }

    fs.writeFileSync(specPath, content, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 批量补充规格
 * @param {Array} specPaths - 规格文件路径数组
 * @param {Object} options - 配置选项
 * @returns {Promise<Object>} 批量结果
 */
async function enrichSpecs(specPaths, options = {}) {
  const results = [];
  const stats = {
    total: specPaths.length,
    success: 0,
    partial: 0,
    failed: 0,
    totalAC: 0,
    totalFR: 0
  };

  for (const specPath of specPaths) {
    try {
      const result = await enrichSpec({ ...options, specPath });
      results.push(result);

      if (result.success) {
        if (result.exitCode === ExitCode.PARTIAL_SUCCESS) {
          stats.partial++;
        } else {
          stats.success++;
        }
        stats.totalAC += result.stats.acExtracted;
        stats.totalFR += result.stats.frGenerated;
      } else {
        stats.failed++;
      }
    } catch (error) {
      results.push({
        success: false,
        specPath,
        error: error.message
      });
      stats.failed++;
    }
  }

  return {
    success: stats.failed < stats.total,
    results,
    stats
  };
}

/**
 * 查找规格文件
 * @param {string} dir - 目录路径
 * @returns {Array} 规格文件路径数组
 */
function findSpecFiles(dir) {
  const specs = [];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.fspec.md')) {
        specs.push(fullPath);
      }
    }
  }

  walk(dir);
  return specs;
}

// 导出
module.exports = {
  // 常量
  SourceType,
  ExitCode,

  // 核心 API
  enrichSpec,
  enrichSpecs,

  // 辅助函数
  inferCodePath,
  generateEnrichedSpec,
  insertACs,
  formatAC,
  enrichParamsFromJSDoc,
  findSpecFiles,

  // AI 相关（占位符）
  generateFRWithAI
};
