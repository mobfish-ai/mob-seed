#!/usr/bin/env node
/**
 * spec extract CLI
 *
 * 从代码文件提取规格的命令行工具。
 *
 * Usage:
 *   spec-extract <file|dir> [options]
 *
 * Examples:
 *   spec-extract lib/router.js
 *   spec-extract lib/ --recursive
 *   spec-extract lib/router.js --write
 *
 * @module skills/mob-seed/lib/cli/spec-extract
 */

const path = require('path');
const fs = require('fs');
const fromCode = require('../spec/from-code');

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
 * 打印使用帮助
 */
function printUsage() {
  console.log(`
${colors.cyan}spec-extract${colors.reset} - 从代码提取规格

${colors.yellow}用法:${colors.reset}
  spec-extract <file|dir> [options]

${colors.yellow}选项:${colors.reset}
  --write, -w          将规格写入文件
  --overwrite          覆盖已存在的规格文件
  --recursive, -r      递归处理目录
  --output, -o <dir>   指定规格输出目录
  --no-tests           不分析测试文件
  --verbose, -v        详细输出
  --json               输出 JSON 格式
  --help, -h           显示帮助

${colors.yellow}示例:${colors.reset}
  spec-extract lib/router.js              # 分析单个文件
  spec-extract lib/ -r                    # 递归分析目录
  spec-extract lib/router.js -w           # 分析并写入规格文件
  spec-extract lib/ -r -w --output specs/ # 递归分析并写入指定目录

${colors.yellow}退出码:${colors.reset}
  0  成功
  1  部分成功
  2  系统错误
  3  配置错误
  4  无效输入
`);
}

/**
 * 解析命令行参数
 * @param {Array} args - 命令行参数
 * @returns {Object} 解析结果
 */
function parseArgs(args) {
  const options = {
    targets: [],
    write: false,
    overwrite: false,
    recursive: false,
    output: 'openspec/specs',
    includeTests: true,
    verbose: false,
    json: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--write':
      case '-w':
        options.write = true;
        break;
      case '--overwrite':
        options.overwrite = true;
        break;
      case '--recursive':
      case '-r':
        options.recursive = true;
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--no-tests':
        options.includeTests = false;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          options.targets.push(arg);
        }
    }
  }

  return options;
}

/**
 * 格式化质量等级
 * @param {string} quality - 质量等级
 * @returns {string} 带颜色的质量标签
 */
function formatQuality(quality) {
  switch (quality) {
    case 'high':
      return `${colors.green}HIGH${colors.reset}`;
    case 'medium':
      return `${colors.yellow}MEDIUM${colors.reset}`;
    case 'low':
      return `${colors.red}LOW${colors.reset}`;
    default:
      return quality;
  }
}

/**
 * 打印单个文件结果
 * @param {Object} result - 提取结果
 * @param {Object} options - 选项
 */
function printFileResult(result, options) {
  if (options.json) return;

  const fileName = path.basename(result.file || result.spec?.path || 'unknown');

  if (result.success) {
    console.log(`\n${colors.green}✓${colors.reset} ${fileName}`);
    console.log(`  质量: ${formatQuality(result.quality)} (${result.parseMode})`);
    console.log(`  方法: ${result.analysis.methods}, JSDoc: ${result.analysis.jsdocs}, 测试: ${result.analysis.tests}`);

    if (result.spec?.path) {
      console.log(`  规格: ${colors.cyan}${result.spec.path}${colors.reset}`);
    }

    if (options.verbose && result.spec?.content) {
      console.log(`\n${colors.gray}--- 规格预览 ---${colors.reset}`);
      const preview = result.spec.content.split('\n').slice(0, 20).join('\n');
      console.log(colors.gray + preview + colors.reset);
      console.log(`${colors.gray}...${colors.reset}\n`);
    }
  } else {
    console.log(`\n${colors.red}✗${colors.reset} ${fileName}`);
    console.log(`  ${colors.red}错误: ${result.error}${colors.reset}`);
  }
}

/**
 * 打印批量处理摘要
 * @param {Object} stats - 统计信息
 */
function printSummary(stats) {
  console.log(`\n${colors.cyan}═══ 提取完成 ═══${colors.reset}`);
  console.log(`总计: ${stats.total} 个文件`);
  console.log(`${colors.green}成功: ${stats.success}${colors.reset}, ${colors.red}失败: ${stats.failed}${colors.reset}`);
  console.log(`质量分布:`);
  console.log(`  ${colors.green}HIGH${colors.reset}: ${stats.quality.high}`);
  console.log(`  ${colors.yellow}MEDIUM${colors.reset}: ${stats.quality.medium}`);
  console.log(`  ${colors.red}LOW${colors.reset}: ${stats.quality.low}`);
}

/**
 * 处理单个文件
 * @param {string} filePath - 文件路径
 * @param {Object} options - 选项
 * @returns {Object} 处理结果
 */
function processFile(filePath, options) {
  const result = fromCode.extractFromFile(filePath, {
    specsDir: options.output,
    includeTests: options.includeTests
  });

  if (options.write && result.success) {
    const writeResult = fromCode.writeSpec(result, {
      overwrite: options.overwrite
    });

    if (!writeResult.success) {
      result.writeError = writeResult.error;
      if (!writeResult.existing) {
        result.success = false;
      }
    } else {
      result.written = true;
      result.writtenPath = writeResult.path;
    }
  }

  return result;
}

/**
 * 处理目录
 * @param {string} dirPath - 目录路径
 * @param {Object} options - 选项
 * @returns {Object} 处理结果
 */
function processDirectory(dirPath, options) {
  const batchResult = fromCode.extractFromDirectory(dirPath, {
    specsDir: options.output,
    includeTests: options.includeTests
  });

  if (options.write) {
    for (const result of batchResult.results) {
      if (result.success) {
        const writeResult = fromCode.writeSpec(result, {
          overwrite: options.overwrite
        });

        if (!writeResult.success) {
          result.writeError = writeResult.error;
        } else {
          result.written = true;
          result.writtenPath = writeResult.path;
        }
      }
    }
  }

  return batchResult;
}

/**
 * 主函数
 * @param {Array} args - 命令行参数
 * @returns {number} 退出码
 */
function main(args) {
  const options = parseArgs(args);

  // 显示帮助
  if (options.help) {
    printUsage();
    return 0;
  }

  // 检查目标
  if (options.targets.length === 0) {
    console.error(`${colors.red}错误: 请指定要分析的文件或目录${colors.reset}`);
    printUsage();
    return 4;
  }

  console.log(`${colors.cyan}spec-extract${colors.reset} - 从代码提取规格\n`);

  const allResults = [];
  const stats = {
    total: 0,
    success: 0,
    failed: 0,
    quality: { high: 0, medium: 0, low: 0 }
  };

  for (const target of options.targets) {
    const absolutePath = path.resolve(target);

    if (!fs.existsSync(absolutePath)) {
      console.error(`${colors.red}错误: 路径不存在: ${target}${colors.reset}`);
      continue;
    }

    const stat = fs.statSync(absolutePath);

    if (stat.isFile()) {
      // 处理单个文件
      const result = processFile(absolutePath, options);
      allResults.push({ file: target, ...result });
      printFileResult({ file: target, ...result }, options);

      stats.total++;
      if (result.success) {
        stats.success++;
        stats.quality[result.quality]++;
      } else {
        stats.failed++;
      }
    } else if (stat.isDirectory()) {
      // 处理目录
      if (!options.recursive) {
        console.error(`${colors.yellow}警告: ${target} 是目录，使用 -r 选项递归处理${colors.reset}`);
        continue;
      }

      const batchResult = processDirectory(absolutePath, options);

      for (const result of batchResult.results) {
        allResults.push(result);
        printFileResult(result, options);
      }

      stats.total += batchResult.stats.total;
      stats.success += batchResult.stats.success;
      stats.failed += batchResult.stats.failed;
      stats.quality.high += batchResult.stats.quality.high;
      stats.quality.medium += batchResult.stats.quality.medium;
      stats.quality.low += batchResult.stats.quality.low;
    }
  }

  // 输出结果
  if (options.json) {
    console.log(JSON.stringify({
      results: allResults,
      stats
    }, null, 2));
  } else {
    printSummary(stats);
  }

  // 返回退出码
  if (stats.failed === stats.total) return 2;
  if (stats.failed > 0) return 1;
  return 0;
}

// 导出供其他模块使用
module.exports = {
  main,
  parseArgs,
  processFile,
  processDirectory
};

// CLI 入口
if (require.main === module) {
  const exitCode = main(process.argv.slice(2));
  process.exit(exitCode);
}
