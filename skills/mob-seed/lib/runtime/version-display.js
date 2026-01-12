/**
 * Version Display - 版本信息格式化显示
 *
 * 功能：
 * - 格式化版本显示
 * - 生成场景标签
 * - 生成更新提示
 */

const { SCENARIOS, formatLabel } = require('../hooks/scenario');

// 颜色代码（ANSI）
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

/**
 * 通过场景代码查找场景对象
 * @param {string} scenarioCode - 场景代码（如 'dogfooding', 'user-env'）
 * @returns {object} - 场景对象
 */
function getScenarioByCode(scenarioCode) {
  for (const key of Object.keys(SCENARIOS)) {
    if (SCENARIOS[key].code === scenarioCode) {
      return SCENARIOS[key];
    }
  }
  // 未知场景返回默认
  return { code: scenarioCode, label: '[未知]', description: scenarioCode, color: COLORS.yellow };
}

/**
 * 生成场景标签（复用 scenario.js）
 */
function getScenarioLabel(scenario) {
  const info = SCENARIOS[scenario];
  if (!info) {
    return `[未知场景] ${scenario}`;
  }
  return `${COLORS.magenta}[${info.label}]${COLORS.reset} ${info.description}`;
}

/**
 * 格式化版本行（用于命令入口）
 */
function formatVersionLine(versionInfo) {
  const { version, scenario } = versionInfo;
  const scenarioObj = getScenarioByCode(scenario);
  const scenarioLabel = formatLabel(scenarioObj);

  return `${COLORS.green}🌱 mob-seed${COLORS.reset} v${version} ${scenarioLabel}`;
}

/**
 * 格式化 Hook 版本行（用于 Git hooks）
 */
function formatHookVersion(versionInfo, checkType) {
  const { version, scenario } = versionInfo;
  const scenarioObj = getScenarioByCode(scenario);
  const scenarioLabel = formatLabel(scenarioObj);

  const emoji = checkType === 'quick' ? '🔍' : '📊';
  const checkText = checkType === 'quick' ? '快速检查' : '增量检查';

  return `${COLORS.blue}${emoji} SEED ${checkText}...${COLORS.reset} v${version} ${scenarioLabel}`;
}

/**
 * 格式化更新提示
 */
function formatUpdateTip(versionInfo) {
  const { latest, scenario } = versionInfo;

  if (!latest || !versionInfo.updateAvailable) {
    return null;
  }

  const { getUpdateCommand } = require('./version-checker');
  const updateCmd = getUpdateCommand(scenario);

  return `${COLORS.yellow}💡 新版本 v${latest} 可用，运行 ${updateCmd} 更新${COLORS.reset}`;
}

/**
 * 格式化详细版本信息（用于 --version）
 */
function formatDetailedVersion(versionInfo) {
  const { version, scenario, latest, updateAvailable } = versionInfo;
  const scenarioObj = getScenarioByCode(scenario);

  const lines = [
    `${COLORS.green}mob-seed${COLORS.reset} v${version}`,
    `Node.js ${process.version}`,
    `Platform: ${process.platform} ${process.arch}`,
    `场景: ${formatLabel(scenarioObj)}`
  ];

  if (latest) {
    if (updateAvailable) {
      lines.push(`${COLORS.yellow}最新版本: v${latest} (有更新)${COLORS.reset}`);
    } else {
      lines.push(`${COLORS.green}最新版本: v${latest} (已是最新)${COLORS.reset}`);
    }
  } else {
    lines.push(`最新版本: 未知（离线或检查失败）`);
  }

  return lines.join('\n');
}

/**
 * 显示版本行（命令入口）
 */
function showVersion(versionInfo) {
  console.log(formatVersionLine(versionInfo));
}

/**
 * 显示 Hook 版本行
 */
function showHookVersion(versionInfo, checkType = 'quick') {
  console.log(formatHookVersion(versionInfo, checkType));
}

/**
 * 显示更新提示（如果有）
 */
function showUpdateTip(versionInfo) {
  const tip = formatUpdateTip(versionInfo);
  if (tip) {
    console.log('');
    console.log(tip);
  }
}

/**
 * 显示详细版本信息
 */
function showDetailedVersion(versionInfo) {
  console.log(formatDetailedVersion(versionInfo));
}

module.exports = {
  getScenarioLabel,
  formatVersionLine,
  formatHookVersion,
  formatUpdateTip,
  formatDetailedVersion,
  showVersion,
  showHookVersion,
  showUpdateTip,
  showDetailedVersion,
  COLORS
};
