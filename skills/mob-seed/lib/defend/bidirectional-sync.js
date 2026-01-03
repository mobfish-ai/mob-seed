/**
 * 双向同步引擎
 *
 * 支持规格→代码和代码→规格的双向同步检测和更新。
 *
 * 安全说明: 使用 spawnSync 而非 exec 避免命令注入
 *
 * @module skills/mob-seed/lib/defend/bidirectional-sync
 */

const fs = require('fs');
const path = require('path');
// 安全: 使用 spawnSync 而非 exec，避免 shell 注入风险
const { spawnSync } = require('node:child_process');
const { detectDrift, formatDriftReport, calculateDriftSummary, DriftSeverity } = require('./drift-detector');
const { generateUpdateProposal, applyUpdates, validateUpdates } = require('./update-proposer');

/**
 * 同步方向
 */
const SyncDirection = {
  SPEC: 'spec',           // 规格→代码（单向验证）
  CODE: 'code',           // 代码→规格（反向同步）
  BIDIRECTIONAL: 'bidirectional'  // 双向
};

/**
 * 退出码
 */
const ExitCode = {
  SUCCESS: 0,             // 规格-代码完全同步
  DRIFT_DETECTED: 1,      // 检测到偏离（单向检查模式）
  SYNC_REQUIRED: 2,       // 需要同步（双向同步模式）
  USER_DECLINED: 3,       // 用户拒绝更新建议
  GIT_DIRTY: 4,           // Git 工作区不干净
  SYSTEM_ERROR: 5,        // 系统错误
  TIMEOUT: 124,           // 操作超时
  INTERRUPTED: 130        // 用户中断
};

/**
 * 双向同步主函数
 *
 * @param {Object} options - 同步选项
 * @param {string} options.projectPath - 项目路径
 * @param {string} [options.syncDirection='bidirectional'] - 同步方向
 * @param {boolean} [options.interactive=true] - 是否交互式确认
 * @param {boolean} [options.dryRun=false] - 预览模式
 * @param {boolean} [options.incremental=true] - 增量模式
 * @param {Function} [options.onProgress] - 进度回调
 * @returns {Promise<Object>} 同步结果
 */
async function syncBidirectional(options) {
  const {
    projectPath,
    syncDirection = SyncDirection.BIDIRECTIONAL,
    interactive = true,
    dryRun = false,
    incremental = true,
    onProgress
  } = options;

  const result = {
    success: true,
    exitCode: ExitCode.SUCCESS,
    filesChecked: 0,
    driftsDetected: 0,
    updatesApplied: 0,
    updatesDeclined: 0,
    warnings: []
  };

  try {
    // 步骤 1: 检查 Git 状态（非 dryRun 模式）
    if (!dryRun && syncDirection !== SyncDirection.SPEC) {
      const gitStatus = checkGitStatus(projectPath);
      if (!gitStatus.clean) {
        result.success = false;
        result.exitCode = ExitCode.GIT_DIRTY;
        result.error = 'Git 工作区不干净，请先提交更改';
        result.warnings.push({
          type: 'git_dirty',
          message: gitStatus.message
        });
        return result;
      }
    }

    // 步骤 2: 获取要检查的文件列表
    if (onProgress) onProgress('detecting', '检测代码变更...');
    const changedFiles = incremental
      ? await detectChangedFiles(projectPath)
      : await getAllSourceFiles(projectPath);

    result.filesChecked = changedFiles.length;

    if (changedFiles.length === 0) {
      if (onProgress) onProgress('complete', '没有需要检查的文件');
      return result;
    }

    // 步骤 3: 分析每个文件的偏离
    if (onProgress) onProgress('analyzing', `分析 ${changedFiles.length} 个文件...`);
    const allDrifts = [];
    const allProposals = [];

    for (let i = 0; i < changedFiles.length; i++) {
      const file = changedFiles[i];
      if (onProgress) {
        onProgress('file', `检查 ${path.basename(file.path)}...`, i + 1, changedFiles.length);
      }

      // 查找对应的规格文件
      const specPath = findRelatedSpec(projectPath, file.path);
      if (!specPath) {
        result.warnings.push({
          type: 'no_spec',
          file: file.path,
          message: `${file.path} 没有对应规格`
        });
        continue;
      }

      // 解析代码和规格
      const codeInfo = await parseCodeFile(file.path);
      const spec = loadSpec(specPath);

      if (!codeInfo || !spec) {
        continue;
      }

      // 检测偏离
      const drifts = detectDrift(spec, codeInfo);
      if (drifts.length > 0) {
        allDrifts.push(...drifts.map(d => ({ ...d, file: file.path, specPath })));

        // 如果是双向同步模式，生成更新建议
        if (syncDirection !== SyncDirection.SPEC) {
          const proposal = generateUpdateProposal(spec, codeInfo, drifts);
          if (proposal.updates.length > 0) {
            allProposals.push({
              file: file.path,
              specPath,
              proposal
            });
          }
        }
      }
    }

    result.driftsDetected = allDrifts.length;

    // 步骤 4: 处理偏离
    if (allDrifts.length === 0) {
      if (onProgress) onProgress('complete', '✅ 所有文件与规格同步');
      return result;
    }

    // 报告偏离
    if (onProgress) onProgress('drifts', formatDriftReport(allDrifts));

    // 如果只是单向检查模式，到此结束
    if (syncDirection === SyncDirection.SPEC) {
      result.exitCode = ExitCode.DRIFT_DETECTED;
      result.driftSummary = calculateDriftSummary(allDrifts);
      return result;
    }

    // 步骤 5: 用户确认（如果是交互模式）
    let approvedUpdates = allProposals;
    if (interactive && allProposals.length > 0) {
      approvedUpdates = await confirmUpdates(allProposals);
      result.updatesDeclined = allProposals.length - approvedUpdates.length;
    }

    // 步骤 6: 应用更新
    if (!dryRun && approvedUpdates.length > 0) {
      if (onProgress) onProgress('applying', `应用 ${approvedUpdates.length} 个更新...`);

      for (const update of approvedUpdates) {
        try {
          // 备份规格
          await backupSpec(projectPath, update.specPath);

          // 应用更新
          const specContent = fs.readFileSync(update.specPath, 'utf-8');
          const updatedContent = applyUpdates(specContent, update.proposal.updates);
          fs.writeFileSync(update.specPath, updatedContent, 'utf-8');

          result.updatesApplied++;

          // 创建 ACE 观察（如果可用）
          await createSyncObservation(projectPath, update);

        } catch (error) {
          result.warnings.push({
            type: 'apply_error',
            file: update.specPath,
            message: error.message
          });
        }
      }
    } else if (dryRun) {
      // 预览模式只显示更新内容
      if (onProgress) onProgress('preview', '预览模式，不应用更新');
      for (const update of approvedUpdates) {
        if (onProgress) {
          onProgress('preview_item', `\n--- ${update.specPath} ---\n${update.proposal.diff}`);
        }
      }
    }

    // 设置最终退出码
    if (result.updatesDeclined > 0 && result.updatesApplied === 0) {
      result.exitCode = ExitCode.USER_DECLINED;
    } else if (allDrifts.length > result.updatesApplied) {
      result.exitCode = ExitCode.SYNC_REQUIRED;
    }

    return result;

  } catch (error) {
    return {
      success: false,
      exitCode: ExitCode.SYSTEM_ERROR,
      error: error.message,
      filesChecked: result.filesChecked,
      driftsDetected: result.driftsDetected,
      updatesApplied: result.updatesApplied
    };
  }
}

/**
 * 检查 Git 状态（使用 spawnSync 避免命令注入）
 *
 * @param {string} projectPath - 项目路径
 * @returns {Object} Git 状态
 */
function checkGitStatus(projectPath) {
  // 安全: spawnSync 不经过 shell，参数不会被解释
  const result = spawnSync('git', ['diff-index', '--quiet', 'HEAD', '--'], {
    encoding: 'utf8',
    cwd: projectPath
  });

  if (result.status !== 0) {
    return {
      clean: false,
      message: '存在未提交的更改'
    };
  }

  return { clean: true };
}

/**
 * 检测自上次同步以来变更的文件（使用 spawnSync 避免命令注入）
 *
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Array<Object>>} 变更文件列表
 */
async function detectChangedFiles(projectPath) {
  // 获取上次 defend 的 commit
  const lastDefend = getLastDefendCommit(projectPath) || 'HEAD~10';

  // 安全: spawnSync 不经过 shell，lastDefend 不会被注入
  const result = spawnSync('git', ['diff', `${lastDefend}..HEAD`, '--name-only'], {
    encoding: 'utf8',
    cwd: projectPath
  });

  if (result.error || result.status !== 0) {
    // 如果 git diff 失败，返回所有源文件
    return getAllSourceFiles(projectPath);
  }

  const files = result.stdout
    .split('\n')
    .filter(line => line.trim())
    .filter(line => /\.(js|ts|jsx|tsx)$/.test(line))
    .filter(line => !line.includes('test'))
    .filter(line => !line.includes('spec'))
    .map(filePath => ({
      path: path.join(projectPath, filePath),
      status: 'modified'
    }));

  return files;
}

/**
 * 获取所有源文件
 *
 * @param {string} projectPath - 项目路径
 * @returns {Promise<Array<Object>>} 源文件列表
 */
async function getAllSourceFiles(projectPath) {
  const files = [];

  // 查找 lib/ 或 src/ 目录
  const srcDirs = ['lib', 'src'];
  for (const dir of srcDirs) {
    const dirPath = path.join(projectPath, dir);
    if (fs.existsSync(dirPath)) {
      findFilesRecursive(dirPath, files);
    }
  }

  return files;
}

/**
 * 递归查找文件
 */
function findFilesRecursive(dir, files, extensions = ['.js', '.ts']) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'test', 'tests', '__tests__'].includes(entry.name)) {
        findFilesRecursive(fullPath, files, extensions);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
        files.push({ path: fullPath, status: 'unknown' });
      }
    }
  }
}

/**
 * 获取上次 defend 的 commit
 *
 * @param {string} projectPath - 项目路径
 * @returns {string|null} commit hash
 */
function getLastDefendCommit(projectPath) {
  const cacheFile = path.join(projectPath, '.seed', 'defend-cache.json');
  if (fs.existsSync(cacheFile)) {
    try {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      return cache.lastCommit;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 查找文件对应的规格
 *
 * @param {string} projectPath - 项目路径
 * @param {string} filePath - 源文件路径
 * @returns {string|null} 规格文件路径
 */
function findRelatedSpec(projectPath, filePath) {
  const fileName = path.basename(filePath, path.extname(filePath));

  // 尝试多种规格路径
  const specPaths = [
    path.join(projectPath, 'openspec', 'specs', `${fileName}.fspec.md`),
    path.join(projectPath, 'openspec', 'specs', `${fileName}-spec.fspec.md`),
    path.join(projectPath, '.seed', 'specs', `${fileName}.fspec.md`)
  ];

  for (const specPath of specPaths) {
    if (fs.existsSync(specPath)) {
      return specPath;
    }
  }

  return null;
}

/**
 * 解析代码文件
 *
 * @param {string} filePath - 文件路径
 * @returns {Promise<Object|null>} 代码信息
 */
async function parseCodeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 简单的正则解析
    const methods = [];
    const functionRegex = /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g;

    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const name = match[1] || match[3];
      const params = match[2] || match[4];
      methods.push({
        name,
        signature: `${name}(${params})`,
        params: params.split(',').map(p => p.trim()).filter(Boolean)
      });
    }

    // 提取模块导出
    const exportsMatch = content.match(/module\.exports\s*=\s*\{([^}]+)\}/);
    const exports = exportsMatch
      ? exportsMatch[1].split(',').map(e => e.trim().split(':')[0].trim()).filter(Boolean)
      : [];

    return {
      path: filePath,
      methods,
      exports
    };

  } catch (error) {
    return null;
  }
}

/**
 * 加载规格文件
 *
 * @param {string} specPath - 规格文件路径
 * @returns {Object|null} 规格对象
 */
function loadSpec(specPath) {
  try {
    const content = fs.readFileSync(specPath, 'utf-8');

    return {
      path: specPath,
      content,
      methods: extractSpecMethods(content)
    };

  } catch (error) {
    return null;
  }
}

/**
 * 从规格内容提取方法列表
 */
function extractSpecMethods(content) {
  const methods = [];

  // 匹配函数定义模式
  const patterns = [
    /\|\s*函数\s*\|\s*`?(\w+)\(([^)]*)\)`?\s*\|/g,
    /\*\*(\w+)\*\*\s*\(([^)]*)\)/g,
    /function\s+(\w+)\s*\(([^)]*)\)/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      if (!methods.find(m => m.name === name)) {
        methods.push({
          name,
          signature: `${name}(${match[2]})`,
          params: match[2].split(',').map(p => p.trim()).filter(Boolean)
        });
      }
    }
  }

  return methods;
}

/**
 * 确认更新（模拟交互）
 *
 * @param {Array<Object>} proposals - 更新建议列表
 * @returns {Promise<Array<Object>>} 批准的更新
 */
async function confirmUpdates(proposals) {
  // 在非交互环境中，只返回自动可应用的更新
  return proposals.filter(p =>
    p.proposal.updates.every(u => u.autoApplicable)
  );
}

/**
 * 备份规格文件
 *
 * @param {string} projectPath - 项目路径
 * @param {string} specPath - 规格文件路径
 */
async function backupSpec(projectPath, specPath) {
  const backupDir = path.join(projectPath, '.seed', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = path.basename(specPath);
  const backupPath = path.join(backupDir, `${fileName}.${timestamp}.backup`);

  fs.copyFileSync(specPath, backupPath);
}

/**
 * 创建同步观察记录
 *
 * @param {string} projectPath - 项目路径
 * @param {Object} update - 更新信息
 */
async function createSyncObservation(projectPath, update) {
  try {
    // 尝试使用 ACE 观察模块（如果可用）
    const observationPath = path.join(projectPath, '.seed', 'observations');
    if (fs.existsSync(observationPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const obsFile = path.join(observationPath, `obs-sync-${timestamp}.md`);

      const content = `---
type: spec_sync
source: ${update.file}
specFile: ${update.specPath}
timestamp: ${new Date().toISOString()}
---

# 规格同步观察

## 变更摘要

${update.proposal.summary}

## 更新详情

${update.proposal.diff}
`;

      fs.writeFileSync(obsFile, content, 'utf-8');
    }
  } catch {
    // 忽略观察记录失败
  }
}

/**
 * 回滚上次同步
 *
 * @param {string} projectPath - 项目路径
 * @returns {Object} 回滚结果
 */
async function rollbackSync(projectPath) {
  const backupDir = path.join(projectPath, '.seed', 'backups');
  if (!fs.existsSync(backupDir)) {
    return {
      success: false,
      message: '没有可回滚的备份'
    };
  }

  const backups = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.backup'))
    .sort()
    .reverse();

  if (backups.length === 0) {
    return {
      success: false,
      message: '没有可回滚的备份'
    };
  }

  // 回滚最近的备份
  let rolledBack = 0;
  const latestBackups = new Map();

  // 找到每个规格的最新备份
  for (const backup of backups) {
    const specName = backup.replace(/\.\d{4}-\d{2}-\d{2}T.*\.backup$/, '');
    if (!latestBackups.has(specName)) {
      latestBackups.set(specName, backup);
    }
  }

  // 执行回滚
  for (const [specName, backupFile] of latestBackups) {
    const backupPath = path.join(backupDir, backupFile);
    const specPath = path.join(projectPath, 'openspec', 'specs', specName);

    if (fs.existsSync(specPath)) {
      fs.copyFileSync(backupPath, specPath);
      rolledBack++;
    }
  }

  return {
    success: true,
    message: `已回滚 ${rolledBack} 个规格文件`
  };
}

// 导出
module.exports = {
  SyncDirection,
  ExitCode,
  syncBidirectional,
  checkGitStatus,
  detectChangedFiles,
  getAllSourceFiles,
  findRelatedSpec,
  parseCodeFile,
  loadSpec,
  backupSpec,
  rollbackSync
};
