/**
 * Brownfield 编排器 (Orchestrator)
 *
 * 编排完整的 Brownfield 迁移流程:
 * 1. 项目检测
 * 2. 批量规格提取
 * 3. 智能补充
 * 4. 同步验证
 * 5. 报告生成
 *
 * @module skills/mob-seed/lib/brownfield/orchestrator
 */

const fs = require('fs');
const path = require('path');

const { detectProject, generateSuggestedConfig } = require('./project-detector');
const {
  loadState,
  saveState,
  clearState,
  hasIncompleteState,
  createInitialState,
  updatePhase,
  updateProgress,
  markFileCompleted
} = require('./state-manager');
const { generateReport, generateSummary, generateJsonReport } = require('./report-generator');

// 延迟加载依赖模块（避免循环依赖）
let fromCode = null;
let enrich = null;

function getFromCode() {
  if (!fromCode) {
    fromCode = require('../spec/from-code');
  }
  return fromCode;
}

function getEnrich() {
  if (!enrich) {
    enrich = require('../spec/enrich');
  }
  return enrich;
}

/**
 * 退出码
 */
const ExitCode = {
  SUCCESS: 0,              // 所有文件成功提取
  PARTIAL_SUCCESS: 1,      // 部分文件失败，但生成了规格
  SYSTEM_ERROR: 2,         // 系统错误
  CONFIG_ERROR: 3,         // 配置错误
  INVALID_INPUT: 4,        // 用户输入错误
  TIMEOUT: 124,            // 操作超时
  INTERRUPTED: 130         // 用户中断
};

/**
 * 迁移阶段
 */
const MigrationPhase = {
  DETECTING: 'detecting',
  EXTRACTING: 'extracting',
  ENRICHING: 'enriching',
  VALIDATING: 'validating',
  REPORTING: 'reporting',
  COMPLETED: 'completed'
};

/**
 * 编排完整的 Brownfield 迁移流程
 *
 * @param {Object} options - 迁移选项
 * @param {string} options.projectPath - 项目根路径
 * @param {boolean} [options.resume=false] - 是否恢复中断的迁移
 * @param {number} [options.concurrency=5] - 并发数
 * @param {boolean} [options.enrichEnabled=true] - 是否启用智能补充
 * @param {boolean} [options.dryRun=false] - 预览模式
 * @param {function} [options.onProgress] - 进度回调
 * @param {function} [options.onPhase] - 阶段切换回调
 * @returns {Promise<Object>} 迁移结果
 */
async function orchestrateMigration(options) {
  const {
    projectPath,
    resume = false,
    concurrency = 5,
    enrichEnabled = true,
    dryRun = false,
    onProgress = null,
    onPhase = null
  } = options;

  // 验证项目路径
  if (!projectPath || !fs.existsSync(projectPath)) {
    return {
      success: false,
      exitCode: ExitCode.INVALID_INPUT,
      error: `项目路径不存在: ${projectPath}`
    };
  }

  let state = null;
  let projectInfo = null;
  let extractResult = null;
  let enrichResult = null;
  let validateResult = null;

  try {
    // 步骤 1: 检查是否有中断状态
    if (resume) {
      state = loadState(projectPath);
      if (state) {
        notifyPhase(onPhase, 'resuming', `从 ${state.phase} 阶段恢复`);
      } else {
        notifyPhase(onPhase, 'info', '未找到中断状态，将从头开始');
      }
    }

    // 创建或恢复初始状态
    if (!state) {
      state = createInitialState({
        concurrency,
        enrichEnabled,
        dryRun
      });
    }

    // 步骤 2: 项目检测
    notifyPhase(onPhase, MigrationPhase.DETECTING, '检测项目结构...');
    state = updatePhase(state, MigrationPhase.DETECTING);

    projectInfo = await detectProject(projectPath);

    if (!projectInfo || projectInfo.sourceFiles.length === 0) {
      return {
        success: false,
        exitCode: ExitCode.INVALID_INPUT,
        error: '未检测到有效的源代码文件'
      };
    }

    notifyPhase(onPhase, 'info', `检测到 ${projectInfo.type} 项目`);
    notifyPhase(onPhase, 'info', `源码目录: ${projectInfo.srcDir}`);
    notifyPhase(onPhase, 'info', `源文件数: ${projectInfo.sourceFiles.length}`);

    // 步骤 3: 生成/验证配置
    const configPath = path.join(projectPath, '.seed', 'config.json');
    if (!fs.existsSync(configPath) && !dryRun) {
      await generateConfig(projectPath, projectInfo);
      notifyPhase(onPhase, 'info', '已生成 .seed/config.json');
    }

    // 确定要处理的文件列表
    const filesToProcess = state.files.remaining.length > 0
      ? state.files.remaining
      : projectInfo.sourceFiles;

    // 更新状态
    if (state.files.remaining.length === 0) {
      state.files.remaining = [...filesToProcess];
      state.progress.total = filesToProcess.length;
    }

    // 步骤 4: 批量提取规格
    notifyPhase(onPhase, MigrationPhase.EXTRACTING, '批量提取规格...');
    state = updatePhase(state, MigrationPhase.EXTRACTING);

    extractResult = await batchExtract({
      projectPath,
      files: filesToProcess,
      specsDir: path.join(projectPath, 'openspec', 'specs'),
      concurrency,
      dryRun,
      onProgress: (current, total, file) => {
        notifyProgress(onProgress, current, total, file);
        // 定期保存状态
        if (current % 10 === 0) {
          saveState(projectPath, state);
        }
      },
      onFileComplete: (file, success, error) => {
        state = markFileCompleted(state, file, success, error);
      }
    });

    notifyPhase(onPhase, 'info', `提取完成: ${extractResult.success}/${extractResult.total}`);
    if (extractResult.failed.length > 0) {
      notifyPhase(onPhase, 'warning', `失败文件: ${extractResult.failed.length}`);
    }

    // 保存提取阶段状态
    saveState(projectPath, state);

    // 步骤 5: 智能补充（可选）
    if (enrichEnabled && extractResult.success > 0) {
      notifyPhase(onPhase, MigrationPhase.ENRICHING, '智能补充规格...');
      state = updatePhase(state, MigrationPhase.ENRICHING);

      const specPaths = extractResult.results
        .filter(r => r.success && r.spec)
        .map(r => r.spec.path);

      if (specPaths.length > 0) {
        enrichResult = await batchEnrich({
          specPaths,
          testDir: path.join(projectPath, projectInfo.testDir),
          dryRun
        });

        notifyPhase(onPhase, 'info', `补充完成: ${enrichResult.enriched} 个规格`);
      }
    }

    // 步骤 6: 同步验证
    notifyPhase(onPhase, MigrationPhase.VALIDATING, '验证规格同步状态...');
    state = updatePhase(state, MigrationPhase.VALIDATING);

    validateResult = await validateSync({
      projectPath,
      specsDir: path.join(projectPath, 'openspec', 'specs'),
      srcDir: path.join(projectPath, projectInfo.srcDir)
    });

    notifyPhase(onPhase, 'info', `验证完成: ${validateResult.synced}/${validateResult.total} 同步`);
    if (validateResult.drifted && validateResult.drifted.length > 0) {
      notifyPhase(onPhase, 'warning', `偏离规格: ${validateResult.drifted.length}`);
    }

    // 步骤 7: 生成迁移报告
    notifyPhase(onPhase, MigrationPhase.REPORTING, '生成迁移报告...');
    state = updatePhase(state, MigrationPhase.REPORTING);

    const reportOptions = {
      projectInfo,
      extractResult,
      enrichResult,
      validateResult
    };

    const report = generateReport(reportOptions);
    const jsonReport = generateJsonReport(reportOptions);

    if (!dryRun) {
      const reportDir = path.join(projectPath, '.seed');
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      const reportPath = path.join(reportDir, 'migration-report.md');
      fs.writeFileSync(reportPath, report, 'utf8');

      const jsonReportPath = path.join(reportDir, 'migration-report.json');
      fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2), 'utf8');

      notifyPhase(onPhase, 'info', `报告已保存: ${reportPath}`);
    }

    // 标记完成并清理状态
    state = updatePhase(state, MigrationPhase.COMPLETED);
    if (!dryRun) {
      clearState(projectPath);
    }

    // 计算退出码
    const exitCode = extractResult.failed.length === 0
      ? ExitCode.SUCCESS
      : ExitCode.PARTIAL_SUCCESS;

    return {
      success: true,
      exitCode,
      stats: {
        total: extractResult.total,
        extracted: extractResult.success,
        failed: extractResult.failed.length,
        enriched: enrichResult?.enriched || 0,
        synced: validateResult.synced,
        drifted: validateResult.drifted?.length || 0
      },
      projectInfo,
      reportPath: dryRun ? null : path.join(projectPath, '.seed', 'migration-report.md'),
      summary: generateSummary(reportOptions)
    };

  } catch (error) {
    // 保存当前状态以便恢复
    if (state && !dryRun) {
      saveState(projectPath, state);
    }

    return {
      success: false,
      exitCode: ExitCode.SYSTEM_ERROR,
      error: error.message,
      phase: state?.phase || 'unknown',
      canResume: state !== null
    };
  }
}

/**
 * 批量提取规格
 * @private
 */
async function batchExtract(options) {
  const {
    projectPath,
    files,
    specsDir,
    concurrency,
    dryRun,
    onProgress,
    onFileComplete
  } = options;

  const fromCodeModule = getFromCode();
  const results = [];
  const failed = [];
  let success = 0;

  // 简单的串行处理（可扩展为并发）
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.isAbsolute(file)
      ? file
      : path.join(projectPath, file);

    try {
      const result = fromCodeModule.extractFromFile(filePath, { specsDir });

      if (result.success) {
        success++;

        // 写入规格文件
        if (!dryRun && result.spec) {
          const writeResult = fromCodeModule.writeSpec(result, { overwrite: false });
          if (!writeResult.success && !writeResult.existing) {
            failed.push({ file, error: writeResult.error });
            onFileComplete?.(file, false, writeResult.error);
            continue;
          }
        }

        results.push({
          file,
          success: true,
          quality: result.quality,
          spec: result.spec
        });

        onFileComplete?.(file, true);
      } else {
        failed.push({ file, error: result.error });
        onFileComplete?.(file, false, result.error);
      }
    } catch (error) {
      failed.push({ file, error: error.message });
      onFileComplete?.(file, false, error.message);
    }

    onProgress?.(i + 1, files.length, file);
  }

  return {
    total: files.length,
    success,
    failed,
    results
  };
}

/**
 * 批量补充规格
 * @private
 */
async function batchEnrich(options) {
  const {
    specPaths,
    testDir,
    dryRun
  } = options;

  const enrichModule = getEnrich();
  let enriched = 0;
  let acExtracted = 0;
  let frGenerated = 0;

  for (const specPath of specPaths) {
    try {
      const result = await enrichModule.enrichSpec({
        specPath,
        testDir,
        extractTests: true,
        extractJSDoc: true,
        useAI: false,  // AI 补充默认关闭
        dryRun
      });

      if (result.success && result.stats) {
        if (result.stats.acsAdded > 0 || result.stats.frsEnriched > 0) {
          enriched++;
        }
        acExtracted += result.stats.acsAdded || 0;
        frGenerated += result.stats.frsEnriched || 0;
      }
    } catch (error) {
      // 补充失败不阻塞流程
      continue;
    }
  }

  return {
    total: specPaths.length,
    enriched,
    acExtracted,
    frGenerated
  };
}

/**
 * 验证规格同步状态
 * @private
 */
async function validateSync(options) {
  const {
    projectPath,
    specsDir,
    srcDir
  } = options;

  // 简化验证：检查规格文件是否存在对应代码文件
  const synced = [];
  const drifted = [];
  let total = 0;

  if (!fs.existsSync(specsDir)) {
    return { total: 0, synced: 0, drifted: [] };
  }

  // 递归查找所有规格文件
  function findSpecs(dir) {
    const specs = [];
    if (!fs.existsSync(dir)) return specs;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        specs.push(...findSpecs(fullPath));
      } else if (entry.name.endsWith('.fspec.md')) {
        specs.push(fullPath);
      }
    }
    return specs;
  }

  const specFiles = findSpecs(specsDir);
  total = specFiles.length;

  for (const specFile of specFiles) {
    // 从规格文件提取源文件路径
    try {
      const content = fs.readFileSync(specFile, 'utf8');
      const sourceMatch = content.match(/源文件:\s*([^\n]+)/);

      if (sourceMatch) {
        const sourcePath = sourceMatch[1].trim();
        const fullSourcePath = path.isAbsolute(sourcePath)
          ? sourcePath
          : path.join(projectPath, sourcePath);

        if (fs.existsSync(fullSourcePath)) {
          synced.push(specFile);
        } else {
          drifted.push(specFile);
        }
      } else {
        // 无源文件标记，视为同步
        synced.push(specFile);
      }
    } catch (error) {
      drifted.push(specFile);
    }
  }

  return {
    total,
    synced: synced.length,
    drifted
  };
}

/**
 * 生成配置文件
 * @private
 */
async function generateConfig(projectPath, projectInfo) {
  const config = generateSuggestedConfig(projectInfo);
  const configDir = path.join(projectPath, '.seed');

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const configPath = path.join(configDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

  return configPath;
}

/**
 * 通知阶段变化
 * @private
 */
function notifyPhase(callback, phase, message) {
  if (typeof callback === 'function') {
    callback(phase, message);
  }
}

/**
 * 通知进度
 * @private
 */
function notifyProgress(callback, current, total, file) {
  if (typeof callback === 'function') {
    callback(current, total, file);
  }
}

/**
 * 检查是否有未完成的迁移
 * @param {string} projectPath - 项目路径
 * @returns {Object|null} 未完成迁移的状态摘要
 */
function checkIncomplete(projectPath) {
  if (!hasIncompleteState(projectPath)) {
    return null;
  }

  const state = loadState(projectPath);
  if (!state) {
    return null;
  }

  return {
    phase: state.phase,
    startedAt: state.startedAt,
    progress: {
      total: state.progress.total,
      processed: state.progress.processed,
      remaining: state.files.remaining.length
    }
  };
}

/**
 * 取消未完成的迁移
 * @param {string} projectPath - 项目路径
 * @returns {boolean} 是否成功取消
 */
function cancelMigration(projectPath) {
  return clearState(projectPath);
}

// 导出
module.exports = {
  // 退出码
  ExitCode,

  // 阶段
  MigrationPhase,

  // 核心 API
  orchestrateMigration,

  // 辅助 API
  checkIncomplete,
  cancelMigration
};
