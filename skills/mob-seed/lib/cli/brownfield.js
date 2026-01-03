/**
 * Brownfield CLI 命令
 *
 * 一键迁移现有项目到 SEED 方法论。
 *
 * @module skills/mob-seed/lib/cli/brownfield
 */

const path = require('path');
const {
  orchestrateMigration,
  checkIncomplete,
  cancelMigration,
  ExitCode,
  MigrationPhase
} = require('../brownfield/orchestrator');

/**
 * 执行 brownfield 命令
 *
 * @param {Object} options - 命令选项
 * @param {string} [options.projectPath] - 项目路径（默认当前目录）
 * @param {boolean} [options.resume] - 恢复中断的迁移
 * @param {boolean} [options.cancel] - 取消未完成的迁移
 * @param {number} [options.concurrency] - 并发数
 * @param {boolean} [options.noEnrich] - 跳过智能补充
 * @param {boolean} [options.dryRun] - 预览模式
 * @param {boolean} [options.quiet] - 静默模式
 * @param {boolean} [options.json] - JSON 输出
 * @returns {Promise<Object>} 执行结果
 */
async function execute(options = {}) {
  const {
    projectPath = process.cwd(),
    resume = false,
    cancel = false,
    concurrency = 5,
    noEnrich = false,
    dryRun = false,
    quiet = false,
    json = false
  } = options;

  const absolutePath = path.isAbsolute(projectPath)
    ? projectPath
    : path.resolve(process.cwd(), projectPath);

  // 处理取消命令
  if (cancel) {
    return handleCancel(absolutePath, { quiet, json });
  }

  // 检查未完成的迁移
  if (!resume) {
    const incomplete = checkIncomplete(absolutePath);
    if (incomplete) {
      return {
        success: false,
        exitCode: ExitCode.CONFIG_ERROR,
        error: '检测到未完成的迁移',
        incomplete,
        suggestion: '使用 --resume 继续，或 --cancel 取消'
      };
    }
  }

  // 显示开始信息
  if (!quiet) {
    console.log('\n🚀 Brownfield 迁移开始\n');
    if (dryRun) {
      console.log('📋 预览模式 - 不会创建任何文件\n');
    }
  }

  // 执行迁移
  const result = await orchestrateMigration({
    projectPath: absolutePath,
    resume,
    concurrency,
    enrichEnabled: !noEnrich,
    dryRun,
    onPhase: (phase, message) => {
      if (!quiet && !json) {
        printPhase(phase, message);
      }
    },
    onProgress: (current, total, file) => {
      if (!quiet && !json) {
        printProgress(current, total, file);
      }
    }
  });

  // 输出结果
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!quiet) {
    printResult(result);
  }

  return result;
}

/**
 * 处理取消命令
 * @private
 */
function handleCancel(projectPath, options) {
  const { quiet, json } = options;
  const incomplete = checkIncomplete(projectPath);

  if (!incomplete) {
    const result = {
      success: true,
      message: '没有未完成的迁移'
    };
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!quiet) {
      console.log('ℹ️  没有未完成的迁移');
    }
    return result;
  }

  const success = cancelMigration(projectPath);

  const result = {
    success,
    message: success ? '已取消未完成的迁移' : '取消失败'
  };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!quiet) {
    if (success) {
      console.log('✅ 已取消未完成的迁移');
    } else {
      console.log('❌ 取消失败');
    }
  }

  return result;
}

/**
 * 打印阶段信息
 * @private
 */
function printPhase(phase, message) {
  const icons = {
    [MigrationPhase.DETECTING]: '📦',
    [MigrationPhase.EXTRACTING]: '🔍',
    [MigrationPhase.ENRICHING]: '🧠',
    [MigrationPhase.VALIDATING]: '🛡️',
    [MigrationPhase.REPORTING]: '📊',
    [MigrationPhase.COMPLETED]: '✅',
    'resuming': '🔄',
    'info': '  ',
    'warning': '⚠️'
  };

  const icon = icons[phase] || '📌';
  console.log(`${icon} ${message}`);
}

/**
 * 打印进度
 * @private
 */
function printProgress(current, total, file) {
  const percent = Math.round((current / total) * 100);
  const bar = createProgressBar(percent);
  const fileName = path.basename(file);

  // 使用 \r 覆盖当前行
  process.stdout.write(`\r   ${bar} ${percent}% (${current}/${total}) ${fileName.padEnd(30)}`);

  if (current === total) {
    console.log(); // 换行
  }
}

/**
 * 创建进度条
 * @private
 */
function createProgressBar(percent) {
  const width = 20;
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

/**
 * 打印最终结果
 * @private
 */
function printResult(result) {
  console.log('\n' + '─'.repeat(50));

  if (result.success) {
    console.log('✅ 迁移完成！\n');

    console.log('📊 统计摘要:');
    console.log(`   总文件数:   ${result.stats.total}`);
    console.log(`   提取成功:   ${result.stats.extracted}`);
    console.log(`   提取失败:   ${result.stats.failed}`);
    console.log(`   智能补充:   ${result.stats.enriched}`);
    console.log(`   同步验证:   ${result.stats.synced}/${result.stats.synced + result.stats.drifted}`);

    if (result.stats.drifted > 0) {
      console.log(`   ⚠️ 偏离规格: ${result.stats.drifted}`);
    }

    console.log(`\n📁 报告路径: ${result.reportPath || '(预览模式)'}`);

    // 下一步建议
    console.log('\n📝 下一步操作:');
    if (result.stats.failed > 0) {
      console.log('   1. 检查失败文件，手动补充规格');
    }
    if (result.stats.drifted > 0) {
      console.log('   2. 审核偏离规格，确保代码与规格一致');
    }
    console.log('   3. 运行 /mob-seed:defend 验证规格');
    console.log('   4. 配置 Git Hooks: /mob-seed:init --hooks');

  } else {
    console.log('❌ 迁移失败\n');
    console.log(`   错误: ${result.error}`);

    if (result.canResume) {
      console.log('\n💡 提示: 使用 --resume 恢复迁移');
    }

    if (result.incomplete) {
      console.log('\n📋 未完成迁移状态:');
      console.log(`   阶段: ${result.incomplete.phase}`);
      console.log(`   进度: ${result.incomplete.progress.processed}/${result.incomplete.progress.total}`);
    }
  }

  console.log('─'.repeat(50) + '\n');
}

/**
 * 解析命令行参数
 * @param {Array<string>} args - 命令行参数
 * @returns {Object} 解析后的选项
 */
function parseArgs(args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--resume' || arg === '-r') {
      options.resume = true;
    } else if (arg === '--cancel') {
      options.cancel = true;
    } else if (arg === '--no-enrich') {
      options.noEnrich = true;
    } else if (arg === '--dry-run' || arg === '-n') {
      options.dryRun = true;
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg.startsWith('--concurrency=')) {
      options.concurrency = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--concurrency' || arg === '-c') {
      options.concurrency = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      options.projectPath = arg;
    }
  }

  return options;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
Brownfield 迁移命令 - 一键迁移现有项目到 SEED 方法论

用法:
  /mob-seed:brownfield [选项] [项目路径]

选项:
  --resume, -r         恢复中断的迁移
  --cancel             取消未完成的迁移
  --no-enrich          跳过智能补充
  --concurrency=N, -c  设置并发数 (默认: 5)
  --dry-run, -n        预览模式，不创建文件
  --quiet, -q          静默模式
  --json               JSON 格式输出
  --help, -h           显示帮助信息

示例:
  /mob-seed:brownfield                    # 迁移当前目录
  /mob-seed:brownfield /path/to/project   # 迁移指定项目
  /mob-seed:brownfield --resume           # 恢复中断的迁移
  /mob-seed:brownfield --dry-run          # 预览模式
  /mob-seed:brownfield --no-enrich        # 跳过智能补充

退出码:
  0 - 成功
  1 - 部分成功（有失败文件）
  2 - 系统错误
  3 - 配置错误
  4 - 输入错误
`);
}

// 导出
module.exports = {
  execute,
  parseArgs,
  showHelp,
  ExitCode
};
