/**
 * Version Checker - mob-seed 运行时版本管理
 *
 * 功能：
 * - 读取本地版本号
 * - 检查远程最新版本
 * - 缓存检查结果
 * - 根据安装场景提供更新命令
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// 缓存文件路径
const CACHE_DIR = path.join(process.cwd(), '.seed', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'version.json');

// 缓存有效期（24小时）
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * 四层回退查找 package.json（复用 scenario 检测逻辑）
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

  // Layer 3: Claude Code 用户插件路径
  const ccPluginPath = path.join(
    os.homedir(),
    '.claude/plugins/mobfish-ai/mob-seed/skills/mob-seed/package.json'
  );
  if (fs.existsSync(ccPluginPath)) {
    return { path: ccPluginPath, scenario: 'user-plugin' };
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
 * 加载缓存
 */
function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return null;
    }
    const data = fs.readFileSync(CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

/**
 * 保存缓存
 */
function saveCache(data) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    // 静默失败，不影响主流程
  }
}

/**
 * 检查缓存是否过期
 */
function isCacheExpired(cache) {
  if (!cache || !cache.checkedAt) {
    return true;
  }
  const checkedAt = new Date(cache.checkedAt).getTime();
  const now = Date.now();
  return (now - checkedAt) > CACHE_TTL;
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
 */
async function checkRemoteVersion() {
  // 先检查缓存
  const cache = loadCache();
  if (!isCacheExpired(cache)) {
    return cache;
  }

  // 缓存过期，检查远程
  try {
    const latest = await getLatestVersionFromNpm();
    const local = getLocalVersion();

    const result = {
      current: local.version,
      latest: latest,
      checkedAt: new Date().toISOString(),
      updateAvailable: latest && latest !== local.version
    };

    // 更新缓存
    saveCache(result);
    return result;
  } catch (error) {
    // 远程检查失败，返回缓存或空值
    return cache || {
      current: getLocalVersion().version,
      latest: null,
      checkedAt: null,
      updateAvailable: false
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
 */
function getVersionInfoSync() {
  const local = getLocalVersion();
  const cache = loadCache();

  return {
    version: local.version || 'unknown',
    scenario: local.scenario,
    latest: cache?.latest,
    updateAvailable: cache?.updateAvailable || false
  };
}

module.exports = {
  getLocalVersion,
  checkRemoteVersion,
  getLatestVersionFromNpm,
  getUpdateCommand,
  getVersionInfoSync,
  loadCache,
  saveCache,
  isCacheExpired
};
