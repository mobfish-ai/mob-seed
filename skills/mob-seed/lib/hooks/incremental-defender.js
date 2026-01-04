#!/usr/bin/env node
/**
 * SEED 增量检查
 *
 * 检查所有未推送的 commits 涉及的文件
 * 检查项：
 * 1. 完整 SEED 四字诀验证
 * 2. 派生链验证
 * 3. 同步检查
 * 4. 原则合规检查（简化版）
 *
 * @module skills/mob-seed/lib/hooks/incremental-defender
 */

const fs = require('fs');
const path = require('path');
const { detectScenario, formatLabel, isDevelopment } = require('./scenario');

// 可选依赖：js-yaml（mission.md 解析需要）
let yaml = null;
try {
  yaml = require('js-yaml');
} catch {
  // js-yaml 不可用时，loadMission 返回 null
}

// 颜色定义
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
};

// 当前运行场景
let currentScenario = null;

/**
 * 加载配置
 */
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync('.seed/config.json', 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 从 Markdown 提取 YAML frontmatter
 */
function extractFrontmatter(content) {
  const lines = content.split('\n');
  if (lines[0].trim() !== '---') return '';
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { endIndex = i; break; }
  }
  return endIndex > 0 ? lines.slice(1, endIndex).join('\n') : '';
}

/**
 * 加载 mission（支持 .md 和 .yaml）
 */
function loadMission() {
  // 如果 js-yaml 不可用，跳过 mission 解析
  if (!yaml) return null;

  try {
    // 优先 .md 格式
    if (fs.existsSync('.seed/mission.md')) {
      const content = fs.readFileSync('.seed/mission.md', 'utf8');
      const frontmatter = extractFrontmatter(content);
      return frontmatter ? yaml.load(frontmatter) : null;
    }
    // 兼容 .yaml 格式
    if (fs.existsSync('.seed/mission.yaml')) {
      return yaml.load(fs.readFileSync('.seed/mission.yaml', 'utf8'));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * SEED 四字诀完整验证
 */
function seedPrincipleCheck(files, config) {
  const results = {
    S: { pass: true, issues: [] },
    E: { pass: true, issues: [] },
    E2: { pass: true, issues: [] },
    D: { pass: true, issues: [] }
  };

  const fileList = files.split('\n').filter(f => f.trim());

  for (const file of fileList) {
    // S: Spec 检查
    if (file.endsWith('.js') || file.endsWith('.ts')) {
      if (!file.includes('.test.') && !file.includes('config')) {
        // 检查是否有对应规格（简化检查）
        const specsDir = config?.paths?.specs || 'openspec/specs';
        if (!fs.existsSync(specsDir)) {
          results.S.issues.push(`${file}: 规格目录不存在`);
        }
      }
    }

    // E: Emit 检查 - 检查是否有 manifest
    if (file.endsWith('.fspec.md')) {
      const manifestDir = config?.paths?.output || '.seed/output';
      const baseName = path.basename(file, '.fspec.md');
      const manifestPath = path.join(manifestDir, baseName, 'manifest.json');

      if (!fs.existsSync(manifestPath)) {
        results.E.issues.push(`${file}: 无派生清单`);
      }
    }

    // E2: Exec 检查 - 检查测试是否存在
    if (file.endsWith('.js') && !file.includes('.test.')) {
      const testPath = file.replace('.js', '.test.js');
      if (!fs.existsSync(testPath)) {
        results.E2.issues.push(`${file}: 无对应测试`);
      }
    }

    // D: Defend 检查 - 通过其他检查体现
  }

  // 设置通过状态
  results.S.pass = results.S.issues.length === 0;
  results.E.pass = results.E.issues.length === 0;
  results.E2.pass = results.E2.issues.length === 0;
  results.D.pass = results.D.issues.length === 0;

  return results;
}

/**
 * 原则合规检查（简化版）
 */
function principleCheck(files, mission) {
  const violations = [];

  if (!mission || !mission.anti_goals) {
    return violations;
  }

  const fileList = files.split('\n').filter(f => f.trim());

  for (const file of fileList) {
    try {
      const content = fs.readFileSync(file, 'utf8');

      // feature_creep: 检查是否有未标记的功能
      if (file.endsWith('.js') && content.includes('// TODO: add to spec')) {
        violations.push({
          antiGoal: 'feature_creep',
          file,
          message: '发现未添加到规格的功能'
        });
      }

      // black_box_magic: 检查复杂逻辑是否有注释
      const lines = content.split('\n');
      let inComplexBlock = false;
      let complexLineCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('if') || line.includes('for') || line.includes('while')) {
          inComplexBlock = true;
          complexLineCount = 0;
        }
        if (inComplexBlock) {
          complexLineCount++;
          if (complexLineCount > 20 && !lines.slice(Math.max(0, i - 5), i).some(l => l.includes('//'))) {
            violations.push({
              antiGoal: 'black_box_magic',
              file,
              message: `第 ${i + 1} 行附近：复杂逻辑块缺少注释`
            });
            inComplexBlock = false;
          }
        }
        if (line.includes('}')) {
          inComplexBlock = false;
        }
      }
    } catch {
      // 文件读取失败，跳过
    }
  }

  return violations;
}

/**
 * 输出检查结果
 */
function printResults(seedResults, violations) {
  console.log(`\n${colors.cyan}📊 SEED 增量检查结果${colors.reset}\n`);

  // SEED 四字诀
  const seedStatus = [
    seedResults.S.pass ? '✅' : '❌',
    seedResults.E.pass ? '✅' : '❌',
    seedResults.E2.pass ? '✅' : '❌',
    seedResults.D.pass ? '✅' : '❌'
  ];
  console.log(`SEED 四字诀: ${seedStatus[0]} S ${seedStatus[1]} E ${seedStatus[2]} E ${seedStatus[3]} D`);

  // 输出问题
  let hasErrors = false;

  for (const [key, result] of Object.entries(seedResults)) {
    if (!result.pass) {
      hasErrors = true;
      console.log(`\n${colors.red}${key} 检查失败:${colors.reset}`);
      for (const issue of result.issues) {
        console.log(`  ${colors.red}• ${issue}${colors.reset}`);
      }
    }
  }

  // 原则违规
  if (violations.length > 0) {
    hasErrors = true;
    console.log(`\n${colors.yellow}原则违规:${colors.reset}`);
    for (const v of violations) {
      console.log(`  ${colors.yellow}• [${v.antiGoal}] ${v.file}: ${v.message}${colors.reset}`);
    }
  }

  if (!hasErrors) {
    console.log(`\n${colors.green}✅ 增量检查通过${colors.reset}`);
  }

  return !hasErrors;
}

// 导出函数供其他模块使用
module.exports = {
  loadConfig,
  extractFrontmatter,
  loadMission,
  seedPrincipleCheck,
  principleCheck,
  printResults
};

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);
  let files = '';
  let verbose = false;

  for (const arg of args) {
    if (arg.startsWith('--files=')) {
      files = arg.substring(8);
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    }
  }

  if (!files) {
    console.error('Usage: incremental-defender.js --files="file1\\nfile2" [--verbose]');
    process.exit(1);
  }

  // 检测运行场景
  const { scenario, pluginPath } = detectScenario();
  currentScenario = scenario;

  // 开发模式显示额外信息
  if (isDevelopment(scenario) && verbose) {
    console.log(`${colors.cyan}[开发模式]${colors.reset} 运行 incremental-defender`);
    console.log(`${colors.cyan}插件路径:${colors.reset} ${pluginPath}`);
  }

  const config = loadConfig();
  const mission = loadMission();
  const seedResults = seedPrincipleCheck(files, config);
  const violations = principleCheck(files, mission);
  const passed = printResults(seedResults, violations);

  process.exit(passed ? 0 : 1);
}
