#!/usr/bin/env node
/**
 * 逆向工程脚本 (Reverse Engineer)
 *
 * 分析现有代码库，提取结构化信息用于生成规格。
 * 这是 brownfield 迁移流程的核心工具。
 *
 * 功能:
 * - 分析项目结构
 * - 提取函数签名和 JSDoc
 * - 识别测试覆盖
 * - 生成迁移报告
 *
 * Usage:
 *   node scripts/reverse-engineer.js [options]
 *
 * @module scripts/reverse-engineer
 */

const fs = require('fs');
const path = require('path');

// 动态加载 AST 解析器（可能不在项目中）
let astParser = null;
try {
  astParser = require('../skills/mob-seed/lib/parsers/ast-javascript');
} catch {
  // AST 解析器不可用时使用简化分析
}

// 颜色定义
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  reset: '\x1b[0m'
};

/**
 * 分析结果类型
 */
const AnalysisType = {
  FULL: 'full',      // 完整 AST 分析
  BASIC: 'basic'     // 基础正则分析
};

/**
 * 默认配置
 */
const defaultConfig = {
  srcDirs: ['lib', 'src', 'skills'],
  testDirs: ['test', 'tests', '__tests__'],
  extensions: ['.js', '.ts', '.jsx', '.tsx'],
  exclude: ['node_modules', '.git', 'dist', 'build', 'coverage'],
  maxFileSize: 500 * 1024 // 500KB
};

/**
 * 分析项目结构
 * @param {string} rootDir - 项目根目录
 * @param {Object} config - 配置选项
 * @returns {Object} 项目结构分析
 */
function analyzeProjectStructure(rootDir, config = {}) {
  const cfg = { ...defaultConfig, ...config };
  const structure = {
    root: rootDir,
    sourceFiles: [],
    testFiles: [],
    configFiles: [],
    stats: {
      totalFiles: 0,
      sourceFiles: 0,
      testFiles: 0,
      configFiles: 0
    }
  };

  function walk(dir, isTestDir = false) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      // 跳过排除目录
      if (cfg.exclude.some(e => relativePath.includes(e))) continue;

      if (entry.isDirectory()) {
        const isTest = cfg.testDirs.some(t => entry.name === t || entry.name.includes('test'));
        walk(fullPath, isTestDir || isTest);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);

        // 配置文件
        if (isConfigFile(entry.name)) {
          structure.configFiles.push(relativePath);
          structure.stats.configFiles++;
          structure.stats.totalFiles++;
          continue;
        }

        // 源代码文件
        if (cfg.extensions.includes(ext)) {
          const isTestFile = isTestDir ||
                            entry.name.includes('.test.') ||
                            entry.name.includes('.spec.');

          if (isTestFile) {
            structure.testFiles.push(relativePath);
            structure.stats.testFiles++;
          } else {
            structure.sourceFiles.push(relativePath);
            structure.stats.sourceFiles++;
          }
          structure.stats.totalFiles++;
        }
      }
    }
  }

  walk(rootDir);
  return structure;
}

/**
 * 检查是否为配置文件
 * @param {string} fileName - 文件名
 * @returns {boolean}
 */
function isConfigFile(fileName) {
  const configPatterns = [
    /^package\.json$/,
    /^tsconfig.*\.json$/,
    /^\.eslintrc/,
    /^\.prettierrc/,
    /^jest\.config/,
    /^babel\.config/,
    /^rollup\.config/,
    /^vite\.config/,
    /^webpack\.config/
  ];
  return configPatterns.some(p => p.test(fileName));
}

/**
 * 分析代码文件
 * @param {string} filePath - 文件路径
 * @param {Object} options - 分析选项
 * @returns {Object} 分析结果
 */
function analyzeCodeFile(filePath, options = {}) {
  const stats = fs.statSync(filePath);

  // 跳过大文件
  if (stats.size > (options.maxFileSize || defaultConfig.maxFileSize)) {
    return {
      file: filePath,
      skipped: true,
      reason: 'file too large'
    };
  }

  // 使用 AST 解析器（如果可用）
  if (astParser) {
    return astParser.analyzeFile(filePath);
  }

  // 降级到基础分析
  return analyzeCodeFileBasic(filePath);
}

/**
 * 基础代码分析（无 AST）
 * @param {string} filePath - 文件路径
 * @returns {Object} 分析结果
 */
function analyzeCodeFileBasic(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');

  const result = {
    file: path.basename(filePath),
    path: filePath,
    parseMode: 'regex',
    methods: [],
    jsdocs: [],
    imports: [],
    exports: { named: [], default: null, commonjs: null }
  };

  // 提取函数
  const funcRegex = /(?:async\s+)?function\s+(\w+)\s*\(/g;
  const arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?[^)]*\)?\s*=>/g;

  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    result.methods.push({ name: match[1], type: 'function' });
  }
  while ((match = arrowRegex.exec(code)) !== null) {
    result.methods.push({ name: match[1], type: 'arrow' });
  }

  // 提取 JSDoc
  const jsdocRegex = /\/\*\*[\s\S]*?\*\//g;
  while ((match = jsdocRegex.exec(code)) !== null) {
    result.jsdocs.push({ raw: match[0] });
  }

  // 提取导出
  const exportsMatch = code.match(/module\.exports\s*=\s*\{([^}]+)\}/);
  if (exportsMatch) {
    result.exports.commonjs = exportsMatch[1]
      .split(',')
      .map(s => s.trim().split(':')[0].trim())
      .filter(Boolean);
  }

  return result;
}

/**
 * 分析测试覆盖
 * @param {Array<string>} sourceFiles - 源文件列表
 * @param {Array<string>} testFiles - 测试文件列表
 * @param {string} rootDir - 项目根目录
 * @returns {Object} 覆盖分析
 */
function analyzeTestCoverage(sourceFiles, testFiles, rootDir) {
  const coverage = {
    covered: [],
    uncovered: [],
    orphanTests: [],
    stats: {
      total: sourceFiles.length,
      covered: 0,
      uncovered: 0,
      coverageRate: 0
    }
  };

  // 建立测试文件索引
  const testIndex = new Map();
  for (const testFile of testFiles) {
    const baseName = path.basename(testFile)
      .replace('.test.', '.')
      .replace('.spec.', '.');
    testIndex.set(baseName, testFile);
  }

  // 检查每个源文件
  for (const sourceFile of sourceFiles) {
    const baseName = path.basename(sourceFile);
    const testBaseName = baseName;

    // 查找对应测试
    let hasTest = false;
    for (const [testName, testPath] of testIndex) {
      if (testName === testBaseName ||
          testPath.includes(baseName.replace(/\.[^.]+$/, ''))) {
        hasTest = true;
        coverage.covered.push({
          source: sourceFile,
          test: testPath
        });
        testIndex.delete(testName);
        break;
      }
    }

    if (!hasTest) {
      coverage.uncovered.push(sourceFile);
    }
  }

  // 剩余的测试文件为孤立测试
  for (const [, testPath] of testIndex) {
    coverage.orphanTests.push(testPath);
  }

  // 计算统计
  coverage.stats.covered = coverage.covered.length;
  coverage.stats.uncovered = coverage.uncovered.length;
  coverage.stats.coverageRate = sourceFiles.length > 0
    ? Math.round((coverage.stats.covered / sourceFiles.length) * 100)
    : 0;

  return coverage;
}

/**
 * 生成迁移报告
 * @param {Object} structure - 项目结构
 * @param {Array<Object>} analyses - 文件分析结果
 * @param {Object} coverage - 覆盖分析
 * @returns {string} Markdown 报告
 */
function generateMigrationReport(structure, analyses, coverage) {
  let report = `# 逆向工程分析报告\n\n`;
  report += `> 生成时间: ${new Date().toISOString()}\n`;
  report += `> 项目根目录: ${structure.root}\n\n`;

  // 项目概览
  report += `## 项目概览\n\n`;
  report += `| 指标 | 数值 |\n`;
  report += `|------|------|\n`;
  report += `| 源文件 | ${structure.stats.sourceFiles} |\n`;
  report += `| 测试文件 | ${structure.stats.testFiles} |\n`;
  report += `| 配置文件 | ${structure.stats.configFiles} |\n`;
  report += `| 测试覆盖率 | ${coverage.stats.coverageRate}% |\n\n`;

  // 解析质量
  const fullCount = analyses.filter(a => a.parseMode === 'ast').length;
  const basicCount = analyses.filter(a => a.parseMode === 'regex').length;
  const skippedCount = analyses.filter(a => a.skipped).length;

  report += `## 解析质量\n\n`;
  report += `- AST 解析: ${fullCount} 文件\n`;
  report += `- 正则解析: ${basicCount} 文件\n`;
  report += `- 跳过: ${skippedCount} 文件\n\n`;

  if (basicCount > 0 && fullCount === 0) {
    report += `> 建议安装 @babel/parser 以获得更精准的分析\n\n`;
  }

  // 测试覆盖
  report += `## 测试覆盖\n\n`;
  report += `### 已覆盖 (${coverage.covered.length})\n\n`;
  for (const item of coverage.covered.slice(0, 20)) {
    report += `- ${item.source} <- ${item.test}\n`;
  }
  if (coverage.covered.length > 20) {
    report += `- ... 及其他 ${coverage.covered.length - 20} 个文件\n`;
  }

  report += `\n### 未覆盖 (${coverage.uncovered.length})\n\n`;
  for (const file of coverage.uncovered.slice(0, 20)) {
    report += `- ${file}\n`;
  }
  if (coverage.uncovered.length > 20) {
    report += `- ... 及其他 ${coverage.uncovered.length - 20} 个文件\n`;
  }

  // 模块分析
  report += `\n## 模块分析\n\n`;

  const moduleStats = new Map();
  for (const analysis of analyses) {
    if (analysis.skipped) continue;

    const methodCount = analysis.methods?.length || 0;
    const jsdocCount = analysis.jsdocs?.length || 0;
    const exportCount = analysis.exports?.commonjs?.length ||
                       analysis.exports?.named?.length ||
                       (analysis.exports?.default ? 1 : 0) || 0;

    if (methodCount > 0) {
      moduleStats.set(analysis.file, {
        methods: methodCount,
        jsdocs: jsdocCount,
        exports: exportCount,
        docRate: methodCount > 0 ? Math.round((jsdocCount / methodCount) * 100) : 0
      });
    }
  }

  // 按方法数排序
  const sortedModules = [...moduleStats.entries()]
    .sort((a, b) => b[1].methods - a[1].methods)
    .slice(0, 20);

  report += `| 模块 | 方法 | JSDoc | 导出 | 文档率 |\n`;
  report += `|------|------|-------|------|--------|\n`;
  for (const [name, stats] of sortedModules) {
    report += `| ${name} | ${stats.methods} | ${stats.jsdocs} | ${stats.exports} | ${stats.docRate}% |\n`;
  }

  // 迁移建议
  report += `\n## 迁移建议\n\n`;

  report += `### 优先级 1: 核心模块\n\n`;
  report += `以下模块方法数较多，建议优先创建规格：\n\n`;
  for (const [name] of sortedModules.slice(0, 5)) {
    report += `- [ ] ${name}\n`;
  }

  report += `\n### 优先级 2: 缺少测试\n\n`;
  report += `以下模块缺少测试覆盖，建议补充：\n\n`;
  for (const file of coverage.uncovered.slice(0, 5)) {
    report += `- [ ] ${file}\n`;
  }

  report += `\n### 优先级 3: 缺少文档\n\n`;
  const lowDocModules = [...moduleStats.entries()]
    .filter(([, stats]) => stats.docRate < 50 && stats.methods >= 3)
    .slice(0, 5);

  for (const [name, stats] of lowDocModules) {
    report += `- [ ] ${name} (文档率 ${stats.docRate}%)\n`;
  }

  return report;
}

/**
 * 打印使用帮助
 */
function printUsage() {
  console.log(`
${colors.cyan}reverse-engineer${colors.reset} - 逆向工程分析工具

${colors.yellow}用法:${colors.reset}
  node scripts/reverse-engineer.js [options]

${colors.yellow}选项:${colors.reset}
  --root <dir>         项目根目录 (默认: 当前目录)
  --output, -o <file>  输出报告文件
  --json               输出 JSON 格式
  --verbose, -v        详细输出
  --help, -h           显示帮助

${colors.yellow}示例:${colors.reset}
  node scripts/reverse-engineer.js
  node scripts/reverse-engineer.js --root ./my-project
  node scripts/reverse-engineer.js -o report.md
  node scripts/reverse-engineer.js --json > analysis.json
`);
}

/**
 * 主函数
 * @param {Array} args - 命令行参数
 * @returns {number} 退出码
 */
function main(args) {
  const options = {
    root: process.cwd(),
    output: null,
    json: false,
    verbose: false,
    help: false
  };

  // 解析参数
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--root':
        options.root = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--json':
        options.json = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  if (options.help) {
    printUsage();
    return 0;
  }

  console.log(`${colors.cyan}逆向工程分析${colors.reset}\n`);
  console.log(`分析目录: ${options.root}\n`);

  // 1. 分析项目结构
  console.log(`${colors.blue}[1/4]${colors.reset} 分析项目结构...`);
  const structure = analyzeProjectStructure(options.root);
  console.log(`  发现 ${structure.stats.sourceFiles} 个源文件, ${structure.stats.testFiles} 个测试文件\n`);

  // 2. 分析代码文件
  console.log(`${colors.blue}[2/4]${colors.reset} 分析代码文件...`);
  const analyses = [];
  for (const file of structure.sourceFiles) {
    const filePath = path.join(options.root, file);
    if (options.verbose) {
      console.log(`  分析: ${file}`);
    }
    const analysis = analyzeCodeFile(filePath);
    analyses.push(analysis);
  }
  console.log(`  完成 ${analyses.length} 个文件分析\n`);

  // 3. 分析测试覆盖
  console.log(`${colors.blue}[3/4]${colors.reset} 分析测试覆盖...`);
  const coverage = analyzeTestCoverage(
    structure.sourceFiles,
    structure.testFiles,
    options.root
  );
  console.log(`  覆盖率: ${coverage.stats.coverageRate}%\n`);

  // 4. 生成报告
  console.log(`${colors.blue}[4/4]${colors.reset} 生成报告...`);

  if (options.json) {
    const result = {
      structure,
      analyses,
      coverage,
      timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(result, null, 2));
  } else {
    const report = generateMigrationReport(structure, analyses, coverage);

    if (options.output) {
      fs.writeFileSync(options.output, report, 'utf8');
      console.log(`\n${colors.green}Done${colors.reset} 报告已保存到: ${options.output}`);
    } else {
      console.log('\n' + report);
    }
  }

  console.log(`\n${colors.green}Done${colors.reset} 分析完成`);
  return 0;
}

// 导出
module.exports = {
  analyzeProjectStructure,
  analyzeCodeFile,
  analyzeCodeFileBasic,
  analyzeTestCoverage,
  generateMigrationReport,
  main
};

// CLI 入口
if (require.main === module) {
  const exitCode = main(process.argv.slice(2));
  process.exit(exitCode);
}
