/**
 * Version Updater - mob-seed 版本更新执行器
 *
 * 功能：
 * - 根据安装场景执行对应的更新命令
 * - 支持 dry-run 模式预览更新
 * - 提供更新前后的版本对比
 */

const { spawn } = require('child_process');
const { getLocalVersion, getUpdateCommand, checkRemoteVersion } = require('./version-checker');

/**
 * 获取更新命令详情
 */
function getUpdateDetails(scenario) {
  const commands = {
    'user-plugin': {
      cmd: 'claude',
      args: ['plugins', 'update', 'mob-seed'],
      description: 'Claude Code 插件更新'
    },
    'user-env': {
      cmd: 'npm',
      args: ['update', '-g', 'mob-seed'],
      description: 'NPM 全局包更新'
    },
    'dogfooding': {
      cmd: 'git',
      args: ['pull'],
      description: 'Git 仓库拉取'
    },
    'compat': {
      cmd: 'npm',
      args: ['update', 'mob-seed'],
      description: 'NPM 本地包更新'
    }
  };
  return commands[scenario] || commands['compat'];
}

/**
 * 执行更新命令
 */
function executeUpdate(scenario, options = {}) {
  return new Promise((resolve, reject) => {
    const details = getUpdateDetails(scenario);
    const { dryRun = false } = options;

    if (dryRun) {
      resolve({
        success: true,
        dryRun: true,
        command: `${details.cmd} ${details.args.join(' ')}`,
        description: details.description
      });
      return;
    }

    const child = spawn(details.cmd, details.args, {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          command: `${details.cmd} ${details.args.join(' ')}`,
          description: details.description
        });
      } else {
        reject(new Error(`更新失败，退出码: ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 完整更新流程
 */
async function performUpdate(options = {}) {
  const { dryRun = false } = options;

  // 1. 获取当前版本信息
  const localInfo = getLocalVersion();
  const scenario = localInfo.scenario;
  const currentVersion = localInfo.version;

  // 2. 检查是否有更新
  const remoteInfo = await checkRemoteVersion();
  const latestVersion = remoteInfo.latest;
  const hasUpdate = remoteInfo.updateAvailable;

  // 3. 构建结果对象
  const result = {
    currentVersion,
    latestVersion,
    hasUpdate,
    scenario,
    updateCommand: getUpdateCommand(scenario)
  };

  if (!hasUpdate) {
    result.message = '已是最新版本';
    return result;
  }

  // 4. 执行更新
  try {
    const updateResult = await executeUpdate(scenario, { dryRun });
    result.updated = updateResult.success;
    result.dryRun = updateResult.dryRun;

    if (dryRun) {
      result.message = `预览模式: 将执行 "${updateResult.command}"`;
    } else {
      result.message = `更新成功: ${currentVersion} → ${latestVersion}`;
    }
  } catch (error) {
    result.updated = false;
    result.error = error.message;
    result.message = `更新失败: ${error.message}`;
  }

  return result;
}

/**
 * 格式化更新结果输出
 */
function formatUpdateResult(result) {
  const lines = [];

  if (result.dryRun) {
    lines.push(`📋 更新预览 (dry-run)`);
  } else if (result.updated) {
    lines.push(`✅ 更新完成`);
  } else if (!result.hasUpdate) {
    lines.push(`✅ 已是最新版本`);
  } else {
    lines.push(`❌ 更新失败`);
  }

  lines.push(`   当前版本: v${result.currentVersion}`);

  if (result.latestVersion) {
    lines.push(`   最新版本: v${result.latestVersion}`);
  }

  lines.push(`   运行场景: ${result.scenario}`);
  lines.push(`   更新命令: ${result.updateCommand}`);

  if (result.error) {
    lines.push(`   错误信息: ${result.error}`);
  }

  return lines.join('\n');
}

module.exports = {
  getUpdateDetails,
  executeUpdate,
  performUpdate,
  formatUpdateResult
};
