/**
 * SEED 运行场景检测模块
 *
 * 五种运行场景:
 * - dogfooding: mob-seed 项目自身开发
 * - user-env: 用户项目，通过环境变量配置
 * - user-plugin: 用户项目，通过 Claude Code 插件
 * - compat: 兼容模式，使用 .seed/scripts
 * - missing: 未找到脚本
 */

const fs = require('fs');
const path = require('path');

// 场景定义
const SCENARIOS = {
  DOGFOODING: {
    code: 'dogfooding',
    label: '[开发模式]',
    description: 'mob-seed dogfooding',
    color: '\x1b[36m',  // cyan
  },
  USER_ENV: {
    code: 'user-env',
    label: '[用户项目]',
    description: '环境变量配置',
    color: '\x1b[35m',  // magenta
  },
  USER_PLUGIN: {
    code: 'user-plugin',
    label: '[用户项目]',
    description: 'Claude Code 插件',
    color: '\x1b[35m',  // magenta
  },
  COMPAT: {
    code: 'compat',
    label: '[兼容模式]',
    description: '.seed/scripts',
    color: '\x1b[33m',  // yellow
  },
  MISSING: {
    code: 'missing',
    label: '[错误]',
    description: '未找到验证脚本',
    color: '\x1b[31m',  // red
  },
};

const RESET = '\x1b[0m';

/**
 * 检测当前运行场景
 * @param {string} cwd - 当前工作目录
 * @returns {{ scenario: object, pluginPath: string|null }}
 */
function detectScenario(cwd = process.cwd()) {
  // Layer 0: 环境变量指定的路径
  const envPath = process.env.SEED_PLUGIN_PATH;
  if (envPath && fs.existsSync(path.join(envPath, 'lib/hooks'))) {
    return { scenario: SCENARIOS.USER_ENV, pluginPath: envPath };
  }

  // Layer 1: 库路径（mob-seed 项目内 dogfooding）
  const dogfoodingPath = path.join(cwd, 'skills/mob-seed');
  if (fs.existsSync(path.join(dogfoodingPath, 'lib/hooks'))) {
    return { scenario: SCENARIOS.DOGFOODING, pluginPath: dogfoodingPath };
  }

  // Layer 2: .seed/scripts（符号链接或复制）
  const compatPath = path.join(cwd, '.seed/scripts');
  if (fs.existsSync(compatPath)) {
    return { scenario: SCENARIOS.COMPAT, pluginPath: compatPath };
  }

  // Layer 3: Claude Code 用户插件路径
  const userPluginPath = path.join(
    process.env.HOME || '',
    '.claude/plugins/mobfish-ai/mob-seed/skills/mob-seed'
  );
  if (fs.existsSync(path.join(userPluginPath, 'lib/hooks'))) {
    return { scenario: SCENARIOS.USER_PLUGIN, pluginPath: userPluginPath };
  }

  // 未找到
  return { scenario: SCENARIOS.MISSING, pluginPath: null };
}

/**
 * 格式化场景标签（带颜色）
 * @param {object} scenario - 场景对象
 * @param {boolean} withColor - 是否带颜色
 * @returns {string}
 */
function formatLabel(scenario, withColor = true) {
  if (withColor) {
    return `${scenario.color}${scenario.label}${RESET} ${scenario.description}`;
  }
  return `${scenario.label} ${scenario.description}`;
}

/**
 * 判断是否为开发模式
 * @param {object} scenario - 场景对象
 * @returns {boolean}
 */
function isDevelopment(scenario) {
  return scenario.code === 'dogfooding';
}

/**
 * 判断是否为用户项目
 * @param {object} scenario - 场景对象
 * @returns {boolean}
 */
function isUserProject(scenario) {
  return scenario.code === 'user-env' || scenario.code === 'user-plugin';
}

/**
 * 获取验证脚本路径
 * @param {string} scriptName - 脚本名称
 * @param {string} pluginPath - 插件路径
 * @param {object} scenario - 场景对象
 * @returns {string|null}
 */
function getScriptPath(scriptName, pluginPath, scenario) {
  if (!pluginPath) return null;

  // 根据场景确定子目录
  if (scenario.code === 'compat') {
    // 兼容模式：直接在 .seed/scripts 下
    const scriptPath = path.join(pluginPath, `${scriptName}.js`);
    return fs.existsSync(scriptPath) ? scriptPath : null;
  }

  // 其他模式：在 lib/hooks 下
  const scriptPath = path.join(pluginPath, 'lib/hooks', `${scriptName}.js`);
  return fs.existsSync(scriptPath) ? scriptPath : null;
}

/**
 * 打印场景信息（用于调试和日志）
 * @param {object} result - detectScenario 的返回值
 */
function printScenarioInfo(result) {
  const { scenario, pluginPath } = result;
  console.log(`场景: ${formatLabel(scenario)}`);
  if (pluginPath) {
    console.log(`路径: ${pluginPath}`);
  }
}

module.exports = {
  SCENARIOS,
  detectScenario,
  formatLabel,
  isDevelopment,
  isUserProject,
  getScriptPath,
  printScenarioInfo,
};
