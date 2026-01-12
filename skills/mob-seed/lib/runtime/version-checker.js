/**
 * Version Checker - mob-seed 运行时版本管理
 *
 * 功能：
 * - 读取本地版本号
 * - 检查远程最新版本
 * - 根据安装场景提供更新命令
 *
 * @note 已移除缓存机制，直接请求 npm registry 以确保数据一致性
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

/**
 * 五层回退查找 package.json
 *
 * 优先级:
 * 1. dogfooding: mob-seed 项目内开发
 * 2. user-env: 用户环境变量配置
 * 3. self: 基于 __dirname 自动定位（支持任意安装路径，含 Claude Code 插件缓存）
 * 4. compat: .seed/package.json 兼容模式
 */
function findPackageJson() {
  // Layer 1: dogfooding (mob-seed 项目内)
  const dogfoodingPath = path.join(process.cwd(), 'skills/mob-seed/package.json');
  if (fs.existsSync(dogfoodingPath)) {
    return { path: dogfoodingPath, scenario: 'dogfooding' };
  }

  // Layer 2: 用户环境变量
  if (process.env.SEED_PLUGIN_PATH) {
    const envPath = path.join(process.env.SEED_PLUGIN_PATH, 'package.json');
    if (fs.existsSync(envPath)) {
      return { path: envPath, scenario: 'user-env' };
    }
  }

  // Layer 3: 基于 __dirname 自动定位（最可靠，支持 Claude Code 插件缓存等任意路径）
  // version-checker.js 在 lib/runtime/，package.json 在 ../../package.json
  const selfPath = path.join(__dirname, '../../package.json');
  if (fs.existsSync(selfPath)) {
    return { path: selfPath, scenario: 'user-plugin' };
  }

  // Layer 4: compat (.seed/package.json)
  const compatPath = path.join(process.cwd(), '.seed/package.json');
  if (fs.existsSync(compatPath)) {
    return { path: compatPath, scenario: 'compat' };
  }

  return null;
}

/**
 * 读取本地版本号
 */
function getLocalVersion() {
  const result = findPackageJson();
  if (!result) {
    return { version: null, scenario: 'missing' };
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(result.path, 'utf8'));
    return {
      version: pkg.version || null,
      scenario: result.scenario,
      path: result.path
    };
  } catch (error) {
    return { version: null, scenario: result.scenario, error: error.message };
  }
}

/**
 * 从 npm registry 获取最新版本
 */
function getLatestVersionFromNpm() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'registry.npmjs.org',
      path: '/mob-seed',
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'mob-seed-version-check'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const pkg = JSON.parse(data);
          resolve(pkg['dist-tags']?.latest || null);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * 检查远程最新版本（异步）
 * @note 直接请求 npm registry，不使用缓存
 */
async function checkRemoteVersion() {
  try {
    const latest = await getLatestVersionFromNpm();
    const local = getLocalVersion();

    return {
      current: local.version,
      latest: latest,
      checkedAt: new Date().toISOString(),
      updateAvailable: latest && latest !== local.version
    };
  } catch (error) {
    // 远程检查失败，返回本地版本信息
    return {
      current: getLocalVersion().version,
      latest: null,
      checkedAt: new Date().toISOString(),
      updateAvailable: false,
      error: error.message
    };
  }
}

/**
 * 获取更新命令（根据场景）
 */
function getUpdateCommand(scenario) {
  const commands = {
    'user-plugin': 'claude plugins update mob-seed',
    'user-env': 'npm update -g mob-seed',
    'dogfooding': 'git pull',
    'compat': 'npm update mob-seed'
  };
  return commands[scenario] || 'npm update mob-seed';
}

/**
 * 同步获取版本信息（用于即时显示）
 * @note 只返回本地版本信息，远程版本需要异步检查
 */
function getVersionInfoSync() {
  const local = getLocalVersion();

  return {
    version: local.version || 'unknown',
    scenario: local.scenario,
    latest: null,
    updateAvailable: false
  };
}

module.exports = {
  getLocalVersion,
  checkRemoteVersion,
  getLatestVersionFromNpm,
  getUpdateCommand,
  getVersionInfoSync
};
