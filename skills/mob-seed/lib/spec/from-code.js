/**
 * 从代码提取规格 (Spec Extract)
 *
 * 分析现有代码文件，提取函数签名、JSDoc、测试用例，
 * 生成 .fspec.md 规格初稿。
 *
 * 支持三层降级:
 * 1. AST 解析 (最精准)
 * 2. 正则表达式 (中等)
 * 3. 模板占位符 (基础)
 *
 * @module skills/mob-seed/lib/spec/from-code
 */

const fs = require('fs');
const path = require('path');
const astParser = require('../parsers/ast-javascript');

/**
 * 质量等级
 */
const QualityLevel = {
  HIGH: 'high',      // AST + JSDoc + Tests
  MEDIUM: 'medium',  // 正则 + 部分 JSDoc
  LOW: 'low'         // 模板占位符
};

/**
 * 从单个代码文件提取规格
 * @param {string} filePath - 代码文件路径
 * @param {Object} options - 提取选项
 * @param {string} [options.specsDir] - 规格输出目录
 * @param {boolean} [options.includeTests] - 是否分析对应测试文件
 * @returns {Object} 提取结果
 */
function extractFromFile(filePath, options = {}) {
  const {
    specsDir = 'openspec/specs',
    includeTests = true
  } = options;

  // 验证文件存在
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      error: `文件不存在: ${filePath}`,
      quality: QualityLevel.LOW
    };
  }

  // 分析代码文件
  const analysis = astParser.analyzeFile(filePath);
  if (analysis.error) {
    return {
      success: false,
      error: analysis.error,
      quality: QualityLevel.LOW
    };
  }

  // 分析测试文件（如果存在）
  let testAnalysis = null;
  if (includeTests) {
    const testPath = findTestFile(filePath);
    if (testPath) {
      testAnalysis = astParser.analyzeFile(testPath);
    }
  }

  // 计算质量等级
  const quality = calculateQuality(analysis, testAnalysis);

  // 生成规格内容
  const specContent = generateSpec(analysis, testAnalysis, {
    filePath,
    quality
  });

  // 确定规格输出路径
  const specPath = determineSpecPath(filePath, specsDir);

  return {
    success: true,
    quality,
    parseMode: analysis.parseMode,
    analysis: {
      methods: analysis.methods.length,
      jsdocs: analysis.jsdocs.length,
      exports: analysis.exports.commonjs?.length ||
               analysis.exports.named.length ||
               (analysis.exports.default ? 1 : 0),
      tests: testAnalysis?.tests?.length || 0
    },
    spec: {
      path: specPath,
      content: specContent
    }
  };
}

/**
 * 批量提取规格
 * @param {Array<string>} filePaths - 代码文件路径列表
 * @param {Object} options - 提取选项
 * @returns {Object} 批量提取结果
 */
function extractFromFiles(filePaths, options = {}) {
  const results = [];
  const stats = {
    total: filePaths.length,
    success: 0,
    failed: 0,
    quality: {
      [QualityLevel.HIGH]: 0,
      [QualityLevel.MEDIUM]: 0,
      [QualityLevel.LOW]: 0
    }
  };

  for (const filePath of filePaths) {
    const result = extractFromFile(filePath, options);
    results.push({
      file: filePath,
      ...result
    });

    if (result.success) {
      stats.success++;
      stats.quality[result.quality]++;
    } else {
      stats.failed++;
    }
  }

  return {
    results,
    stats,
    summary: generateBatchSummary(stats)
  };
}

/**
 * 从目录批量提取
 * @param {string} dirPath - 目录路径
 * @param {Object} options - 提取选项
 * @param {Array<string>} [options.extensions] - 文件扩展名
 * @param {Array<string>} [options.exclude] - 排除模式
 * @returns {Object} 批量提取结果
 */
function extractFromDirectory(dirPath, options = {}) {
  const {
    extensions = ['.js', '.ts'],
    exclude = ['node_modules', '.test.', '.spec.', '__tests__', '__mocks__']
  } = options;

  const files = findSourceFiles(dirPath, extensions, exclude);
  return extractFromFiles(files, options);
}

/**
 * 查找源代码文件
 * @param {string} dirPath - 目录路径
 * @param {Array<string>} extensions - 扩展名列表
 * @param {Array<string>} exclude - 排除模式
 * @returns {Array<string>} 文件路径列表
 */
function findSourceFiles(dirPath, extensions, exclude) {
  const files = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // 检查排除模式
      if (exclude.some(pattern => fullPath.includes(pattern))) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dirPath);
  return files;
}

/**
 * 查找对应的测试文件
 * @param {string} filePath - 源代码文件路径
 * @returns {string|null} 测试文件路径或 null
 */
function findTestFile(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);

  // 常见测试文件命名模式
  const testPatterns = [
    path.join(dir, `${baseName}.test${ext}`),
    path.join(dir, `${baseName}.spec${ext}`),
    path.join(dir, '__tests__', `${baseName}.test${ext}`),
    path.join(dir, '__tests__', `${baseName}.spec${ext}`),
    // 替换 lib 为 test
    filePath.replace('/lib/', '/test/').replace(ext, `.test${ext}`)
  ];

  for (const testPath of testPatterns) {
    if (fs.existsSync(testPath)) {
      return testPath;
    }
  }

  return null;
}

/**
 * 计算质量等级
 * @param {Object} analysis - 代码分析结果
 * @param {Object} testAnalysis - 测试分析结果
 * @returns {string} 质量等级
 */
function calculateQuality(analysis, testAnalysis) {
  let score = 0;

  // AST 解析成功 (+3)
  if (analysis.parseMode === 'ast') {
    score += 3;
  }

  // 有 JSDoc (+2)
  if (analysis.jsdocs.length > 0) {
    score += 2;
  }

  // 有导出 (+1)
  const hasExports = analysis.exports?.commonjs?.length > 0 ||
                     analysis.exports?.named?.length > 0 ||
                     analysis.exports?.default;
  if (hasExports) {
    score += 1;
  }

  // 有测试 (+2)
  if (testAnalysis?.tests?.length > 0) {
    score += 2;
  }

  // 质量判定
  if (score >= 6) return QualityLevel.HIGH;
  if (score >= 3) return QualityLevel.MEDIUM;
  return QualityLevel.LOW;
}

/**
 * 生成规格内容
 * @param {Object} analysis - 代码分析结果
 * @param {Object} testAnalysis - 测试分析结果
 * @param {Object} context - 上下文信息
 * @returns {string} 规格 Markdown 内容
 */
function generateSpec(analysis, testAnalysis, context) {
  const { filePath, quality } = context;
  const moduleName = path.basename(filePath, path.extname(filePath));

  // 从 JSDoc 提取模块描述
  const moduleDoc = analysis.jsdocs.find(doc =>
    doc.tags?.module || doc.description?.includes('module')
  );
  const description = moduleDoc?.description || `${moduleName} 模块`;

  // 构建规格内容
  let content = `# Feature: ${moduleName}\n\n`;
  content += `> 状态: draft\n`;
  content += `> 版本: 1.0.0\n`;
  content += `> 质量: ${quality} (自动提取)\n`;
  content += `> 源文件: ${filePath}\n\n`;

  content += `## 概述\n\n`;
  content += `${description}\n\n`;

  // 提取的功能需求
  content += `## EXTRACTED Requirements\n\n`;

  const exportedMethods = analysis.methods.filter(m => m.exported);

  if (exportedMethods.length > 0) {
    for (const method of exportedMethods) {
      content += generateMethodRequirement(method, analysis.jsdocs);
    }
  } else {
    content += `> 未检测到导出的方法，请手动添加需求。\n\n`;
  }

  // 从测试提取 AC
  if (testAnalysis?.tests?.length > 0) {
    content += `## TEST-DERIVED Acceptance Criteria\n\n`;
    content += `> 以下 AC 从测试文件自动提取\n\n`;

    for (const test of testAnalysis.tests) {
      if (test.type !== 'suite') {
        content += `- [ ] AC: ${test.name}\n`;
      }
    }
    content += `\n`;
  }

  // 派生产物
  content += `## 派生产物 (Derived Outputs)\n\n`;
  content += `| 类型 | 路径 | 说明 |\n`;
  content += `|------|------|------|\n`;
  content += `| 源代码 | ${filePath} | 已存在 (反向工程源) |\n`;

  if (testAnalysis) {
    content += `| 测试 | ${findTestFile(filePath)} | 已存在 |\n`;
  }

  content += `\n`;

  // 质量说明
  content += `## 提取质量说明\n\n`;
  content += `- **解析模式**: ${analysis.parseMode}\n`;
  content += `- **质量等级**: ${quality}\n`;
  content += `- **检测到的方法**: ${analysis.methods.length}\n`;
  content += `- **JSDoc 注释**: ${analysis.jsdocs.length}\n`;
  content += `- **测试用例**: ${testAnalysis?.tests?.length || 0}\n\n`;

  if (quality !== QualityLevel.HIGH) {
    content += `> ⚠️ 建议人工审核并补充以下内容:\n`;
    if (analysis.parseMode !== 'ast') {
      content += `> - 安装 @babel/parser 以获得更精准的解析\n`;
    }
    if (analysis.jsdocs.length === 0) {
      content += `> - 添加 JSDoc 注释以丰富规格内容\n`;
    }
    if (!testAnalysis?.tests?.length) {
      content += `> - 添加测试文件以自动生成 AC\n`;
    }
  }

  return content;
}

/**
 * 生成方法需求
 * @param {Object} method - 方法信息
 * @param {Array} jsdocs - JSDoc 列表
 * @returns {string} 需求 Markdown
 */
function generateMethodRequirement(method, jsdocs) {
  // 查找对应的 JSDoc
  const methodDoc = jsdocs.find(doc => {
    // 通过行号匹配
    if (method.loc && doc.loc) {
      return Math.abs(method.loc.start.line - doc.loc.start.line) < 5;
    }
    return false;
  });

  let content = `### REQ: ${method.name}\n\n`;

  // 描述
  if (methodDoc?.description) {
    content += `${methodDoc.description}\n\n`;
  } else {
    content += `> TODO: 添加 ${method.name} 的功能描述\n\n`;
  }

  // 签名
  content += `**签名**:\n`;
  content += `\`\`\`javascript\n`;
  content += `${method.async ? 'async ' : ''}`;
  content += `${method.generator ? 'function* ' : 'function '}`;
  content += `${method.name}(${method.params.map(p => p.name).join(', ')})\n`;
  content += `\`\`\`\n\n`;

  // 参数
  if (method.params.length > 0 || methodDoc?.params?.length > 0) {
    content += `**参数**:\n`;
    const params = methodDoc?.params || method.params;
    for (const param of params) {
      const type = param.type || 'any';
      const desc = param.description || '';
      const opt = param.optional ? '(可选) ' : '';
      content += `- \`${param.name}\` {${type}} - ${opt}${desc}\n`;
    }
    content += `\n`;
  }

  // 返回值
  if (methodDoc?.returns) {
    content += `**返回**: {${methodDoc.returns.type}} ${methodDoc.returns.description}\n\n`;
  }

  // AC 占位符
  content += `**Acceptance Criteria**:\n`;
  content += `- [ ] AC: ${method.name} 正常调用返回预期结果\n`;
  if (method.params.some(p => !p.optional)) {
    content += `- [ ] AC: 缺少必需参数时抛出错误\n`;
  }
  content += `\n`;

  return content;
}

/**
 * 确定规格输出路径
 * @param {string} filePath - 源文件路径
 * @param {string} specsDir - 规格目录
 * @returns {string} 规格文件路径
 */
function determineSpecPath(filePath, specsDir) {
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);

  // 从路径推断模块分类
  let category = 'core';
  if (filePath.includes('/parsers/')) category = 'parsers';
  else if (filePath.includes('/cli/')) category = 'cli';
  else if (filePath.includes('/hooks/')) category = 'automation';
  else if (filePath.includes('/spec/')) category = 'spec';
  else if (filePath.includes('/ace/')) category = 'ace';

  return path.join(specsDir, category, `${baseName}.fspec.md`);
}

/**
 * 生成批量处理摘要
 * @param {Object} stats - 统计信息
 * @returns {string} 摘要文本
 */
function generateBatchSummary(stats) {
  const lines = [
    `处理完成: ${stats.total} 个文件`,
    `成功: ${stats.success}, 失败: ${stats.failed}`,
    `质量分布:`,
    `  - HIGH: ${stats.quality[QualityLevel.HIGH]}`,
    `  - MEDIUM: ${stats.quality[QualityLevel.MEDIUM]}`,
    `  - LOW: ${stats.quality[QualityLevel.LOW]}`
  ];
  return lines.join('\n');
}

/**
 * 将提取结果写入文件
 * @param {Object} result - 提取结果
 * @param {Object} options - 写入选项
 * @param {boolean} [options.overwrite] - 是否覆盖已存在文件
 * @returns {Object} 写入结果
 */
function writeSpec(result, options = {}) {
  const { overwrite = false } = options;

  if (!result.success || !result.spec) {
    return {
      success: false,
      error: result.error || '无有效规格内容'
    };
  }

  const specPath = result.spec.path;

  // 检查是否已存在
  if (fs.existsSync(specPath) && !overwrite) {
    return {
      success: false,
      error: `规格文件已存在: ${specPath}`,
      existing: true
    };
  }

  // 确保目录存在
  const specDir = path.dirname(specPath);
  if (!fs.existsSync(specDir)) {
    fs.mkdirSync(specDir, { recursive: true });
  }

  // 写入文件
  fs.writeFileSync(specPath, result.spec.content, 'utf8');

  return {
    success: true,
    path: specPath,
    quality: result.quality
  };
}

module.exports = {
  // 质量等级
  QualityLevel,

  // 核心 API
  extractFromFile,
  extractFromFiles,
  extractFromDirectory,

  // 辅助函数
  findTestFile,
  findSourceFiles,
  calculateQuality,
  determineSpecPath,

  // 生成函数
  generateSpec,
  generateMethodRequirement,

  // 写入函数
  writeSpec
};
