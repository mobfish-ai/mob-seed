#!/usr/bin/env node
/**
 * spec enrich CLI
 *
 * 从测试文件和代码分析智能补充规格细节。
 *
 * Usage:
 *   spec-enrich <spec-file> [options]
 *   spec-enrich --all [options]
 *
 * Examples:
 *   spec-enrich openspec/specs/core/router.fspec.md
 *   spec-enrich --all --no-ai
 *   spec-enrich openspec/changes/v3.3/specs/ -r
 *
 * @module skills/mob-seed/lib/cli/spec-enrich
 */

const path = require('path');
const fs = require('fs');
const enrich = require('../spec/enrich');

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
${colors.cyan}spec-enrich${colors.reset} - 智能补充规格细节

${colors.yellow}用法:${colors.reset}
  spec-enrich <spec-file> [options]
  spec-enrich --all [options]

${colors.yellow}选项:${colors.reset}
  --all                补充所有规格文件
  --recursive, -r      递归处理目录
  --no-tests           不从测试文件提取 AC
  --no-jsdoc           不从 JSDoc 提取参数说明
  --use-ai             使用 AI 生成 FR（默认关闭）
  --ai-provider <name> AI 提供商（gemini/openai/claude）
  --verbose, -v        详细输出
  --json               输出 JSON 格式
  --help, -h           显示帮助

${colors.yellow}示例:${colors.reset}
  spec-enrich router.fspec.md              # 补充单个规格
  spec-enrich --all                        # 补充所有规格
  spec-enrich openspec/specs/ -r           # 递归补充目录
  spec-enrich router.fspec.md --use-ai     # 启用 AI 生成

${colors.yellow}退出码:${colors.reset}
  0  全部成功
  1  部分成功（AI 失败但测试成功）
  2  系统错误
  3  配置错误
  4  规格文件不存在
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
    all: false,
    recursive: false,
    extractTests: true,
    extractJSDoc: true,
    useAI: false,
    aiProvider: 'gemini',
    verbose: false,
    json: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--all':
        options.all = true;
        break;
      case '--recursive':
      case '-r':
        options.recursive = true;
        break;
      case '--no-tests':
        options.extractTests = false;
        break;
      case '--no-jsdoc':
        options.extractJSDoc = false;
        break;
      case '--use-ai':
        options.useAI = true;
        break;
      case '--ai-provider':
        options.aiProvider = args[++i];
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
 * 格式化统计信息
 * @param {Object} stats - 统计信息
 * @returns {string} 格式化的统计
 */
function formatStats(stats) {
  const parts = [];
  if (stats.acExtracted > 0) {
    parts.push(`${colors.green}AC: ${stats.acExtracted}${colors.reset} (从测试提取)`);
  }
  if (stats.frGenerated > 0) {
    parts.push(`${colors.blue}FR: ${stats.frGenerated}${colors.reset} (AI 生成)`);
  }
  if (stats.paramsEnriched > 0) {
    parts.push(`${colors.cyan}参数: ${stats.paramsEnriched}${colors.reset} (从 JSDoc)`);
  }
  return parts.join(', ') || '无补充';
}

/**
 * 打印单个文件结果
 * @param {Object} result - 补充结果
 * @param {Object} options - 选项
 */
function printFileResult(result, options) {
  if (options.json) return;

  const fileName = path.basename(result.specPath || 'unknown');

  if (result.success) {
    const statusIcon = result.exitCode === enrich.ExitCode.PARTIAL_SUCCESS ? '⚠️' : '✅';
    console.log(`${statusIcon} ${fileName}`);
    console.log(`   ${formatStats(result.stats)}`);

    if (options.verbose && result.enrichment) {
      if (result.enrichment.tests?.acs?.length > 0) {
        console.log(`   ${colors.gray}测试文件: ${result.enrichment.tests.path}${colors.reset}`);
      }
      if (result.enrichment.ai?.error) {
        console.log(`   ${colors.yellow}AI 警告: ${result.enrichment.ai.error}${colors.reset}`);
      }
    }
  } else {
    console.log(`${colors.red}❌${colors.reset} ${fileName}`);
    console.log(`   ${colors.red}错误: ${result.error}${colors.reset}`);
  }
}

/**
 * 打印批量处理摘要
 * @param {Object} stats - 统计信息
 */
function printSummary(stats) {
  console.log(`\n${colors.cyan}═══ 补充完成 ═══${colors.reset}`);
  console.log(`总计: ${stats.total} 个规格文件`);
  console.log(`${colors.green}成功: ${stats.success}${colors.reset}, ` +
              `${colors.yellow}部分: ${stats.partial}${colors.reset}, ` +
              `${colors.red}失败: ${stats.failed}${colors.reset}`);
  console.log(`AC 总数: ${stats.totalAC} (从测试提取)`);
  console.log(`FR 总数: ${stats.totalFR} (AI 生成)`);
}

/**
 * 处理单个规格文件
 * @param {string} specPath - 规格文件路径
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 处理结果
 */
async function processSingle(specPath, options) {
  const absolutePath = path.resolve(specPath);

  if (!fs.existsSync(absolutePath)) {
    return {
      success: false,
      specPath,
      error: `规格文件不存在: ${specPath}`,
      exitCode: enrich.ExitCode.SPEC_NOT_FOUND
    };
  }

  return enrich.enrichSpec({
    specPath: absolutePath,
    extractTests: options.extractTests,
    extractJSDoc: options.extractJSDoc,
    useAI: options.useAI,
    aiProvider: options.aiProvider
  });
}

/**
 * 处理目录
 * @param {string} dirPath - 目录路径
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 处理结果
 */
async function processDirectory(dirPath, options) {
  const specFiles = enrich.findSpecFiles(path.resolve(dirPath));

  if (specFiles.length === 0) {
    return {
      success: false,
      error: `目录中未找到规格文件: ${dirPath}`,
      stats: { total: 0, success: 0, partial: 0, failed: 0, totalAC: 0, totalFR: 0 }
    };
  }

  return enrich.enrichSpecs(specFiles, {
    extractTests: options.extractTests,
    extractJSDoc: options.extractJSDoc,
    useAI: options.useAI,
    aiProvider: options.aiProvider
  });
}

/**
 * 处理所有规格文件
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 处理结果
 */
async function processAll(options) {
  const dirs = [
    'openspec/specs',
    'openspec/changes'
  ];

  const allSpecs = [];
  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      allSpecs.push(...enrich.findSpecFiles(dir));
    }
  }

  if (allSpecs.length === 0) {
    return {
      success: false,
      error: '未找到任何规格文件',
      stats: { total: 0, success: 0, partial: 0, failed: 0, totalAC: 0, totalFR: 0 }
    };
  }

  console.log(`${colors.cyan}spec-enrich${colors.reset} - 批量补充 ${allSpecs.length} 个规格文件\n`);

  const results = [];
  const stats = {
    total: allSpecs.length,
    success: 0,
    partial: 0,
    failed: 0,
    totalAC: 0,
    totalFR: 0
  };

  for (let i = 0; i < allSpecs.length; i++) {
    const specPath = allSpecs[i];

    // 进度条
    const progress = Math.floor(((i + 1) / allSpecs.length) * 20);
    const bar = '█'.repeat(progress) + '░'.repeat(20 - progress);
    process.stdout.write(`\r进度: ${bar} ${Math.floor(((i + 1) / allSpecs.length) * 100)}% (${i + 1}/${allSpecs.length})`);

    try {
      const result = await enrich.enrichSpec({
        specPath,
        extractTests: options.extractTests,
        extractJSDoc: options.extractJSDoc,
        useAI: options.useAI,
        aiProvider: options.aiProvider
      });

      results.push(result);

      if (result.success) {
        if (result.exitCode === enrich.ExitCode.PARTIAL_SUCCESS) {
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

  console.log('\n');

  // 打印详细结果
  for (const result of results) {
    printFileResult(result, options);
  }

  return { success: stats.failed < stats.total, results, stats };
}

/**
 * 主函数
 * @param {Array} args - 命令行参数
 * @returns {Promise<number>} 退出码
 */
async function main(args) {
  const options = parseArgs(args);

  // 显示帮助
  if (options.help) {
    printUsage();
    return 0;
  }

  console.log(`${colors.cyan}spec-enrich${colors.reset} - 智能补充规格细节\n`);

  let result;

  if (options.all) {
    // 处理所有规格
    result = await processAll(options);
    if (!options.json) {
      printSummary(result.stats);
    }
  } else if (options.targets.length === 0) {
    console.error(`${colors.red}错误: 请指定规格文件或使用 --all${colors.reset}`);
    printUsage();
    return enrich.ExitCode.CONFIG_ERROR;
  } else {
    // 处理指定的目标
    const allResults = [];
    const stats = {
      total: 0,
      success: 0,
      partial: 0,
      failed: 0,
      totalAC: 0,
      totalFR: 0
    };

    for (const target of options.targets) {
      const absolutePath = path.resolve(target);

      if (!fs.existsSync(absolutePath)) {
        console.error(`${colors.red}错误: 路径不存在: ${target}${colors.reset}`);
        continue;
      }

      const stat = fs.statSync(absolutePath);

      if (stat.isFile()) {
        const fileResult = await processSingle(absolutePath, options);
        allResults.push(fileResult);
        printFileResult(fileResult, options);

        stats.total++;
        if (fileResult.success) {
          if (fileResult.exitCode === enrich.ExitCode.PARTIAL_SUCCESS) {
            stats.partial++;
          } else {
            stats.success++;
          }
          stats.totalAC += fileResult.stats?.acExtracted || 0;
          stats.totalFR += fileResult.stats?.frGenerated || 0;
        } else {
          stats.failed++;
        }
      } else if (stat.isDirectory()) {
        if (!options.recursive) {
          console.error(`${colors.yellow}警告: ${target} 是目录，使用 -r 选项递归处理${colors.reset}`);
          continue;
        }

        const dirResult = await processDirectory(absolutePath, options);
        for (const r of dirResult.results || []) {
          allResults.push(r);
          printFileResult(r, options);
        }

        stats.total += dirResult.stats?.total || 0;
        stats.success += dirResult.stats?.success || 0;
        stats.partial += dirResult.stats?.partial || 0;
        stats.failed += dirResult.stats?.failed || 0;
        stats.totalAC += dirResult.stats?.totalAC || 0;
        stats.totalFR += dirResult.stats?.totalFR || 0;
      }
    }

    result = { success: stats.failed < stats.total, results: allResults, stats };

    if (stats.total > 1 && !options.json) {
      printSummary(stats);
    }
  }

  // 输出 JSON
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  }

  // 返回退出码
  if (result.stats?.failed === result.stats?.total) return enrich.ExitCode.SYSTEM_ERROR;
  if (result.stats?.failed > 0 || result.stats?.partial > 0) return enrich.ExitCode.PARTIAL_SUCCESS;
  return enrich.ExitCode.SUCCESS;
}

// 导出
module.exports = {
  main,
  parseArgs,
  processSingle,
  processDirectory,
  processAll
};

// CLI 入口
if (require.main === module) {
  main(process.argv.slice(2)).then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error(`${colors.red}错误: ${error.message}${colors.reset}`);
    process.exit(enrich.ExitCode.SYSTEM_ERROR);
  });
}
