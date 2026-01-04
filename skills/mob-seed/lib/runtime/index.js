/**
 * Runtime Module - mob-seed 运行时版本管理
 *
 * 统一导出版本检查、显示和更新功能
 */

const versionChecker = require('./version-checker');
const versionDisplay = require('./version-display');
const versionUpdater = require('./version-updater');

/**
 * 显示运行时版本信息（命令入口）
 */
function showRuntimeVersion() {
  const versionInfo = versionChecker.getVersionInfoSync();
  versionDisplay.showVersion(versionInfo);

  // 异步检查远程版本（不阻塞）
  versionChecker.checkRemoteVersion().then((result) => {
    if (result.updateAvailable) {
      versionDisplay.showUpdateTip(result);
    }
  }).catch(() => {
    // 静默失败
  });
}

/**
 * 显示 Hook 版本信息
 */
function showHookVersion(checkType = 'quick') {
  const versionInfo = versionChecker.getVersionInfoSync();
  versionDisplay.showHookVersion(versionInfo, checkType);
  return versionInfo;
}

/**
 * 显示详细版本信息 (--version)
 */
function showDetailedVersion() {
  return versionChecker.checkRemoteVersion().then((result) => {
    const versionInfo = {
      ...versionChecker.getVersionInfoSync(),
      latest: result.latest,
      updateAvailable: result.updateAvailable
    };
    versionDisplay.showDetailedVersion(versionInfo);
    return versionInfo;
  });
}

/**
 * 获取版本信息（编程接口）
 */
function getVersionInfo() {
  return versionChecker.getVersionInfoSync();
}

/**
 * 检查更新（编程接口）
 */
function checkUpdate() {
  return versionChecker.checkRemoteVersion();
}

/**
 * 执行更新 (--update)
 */
async function performUpdate(options = {}) {
  const result = await versionUpdater.performUpdate(options);
  console.log(versionUpdater.formatUpdateResult(result));
  return result;
}

module.exports = {
  // 版本检查
  ...versionChecker,

  // 版本显示
  ...versionDisplay,

  // 版本更新
  ...versionUpdater,

  // 高级接口
  showRuntimeVersion,
  showHookVersion,
  showDetailedVersion,
  getVersionInfo,
  checkUpdate,
  performUpdate
};
