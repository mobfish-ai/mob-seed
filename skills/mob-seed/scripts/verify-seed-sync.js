#!/usr/bin/env node
/**
 * SEED 同步验证脚本
 *
 * 程序化检测所有可能的遗漏：
 * 1. 规格 → 代码 同步
 * 2. 代码 → 测试 同步
 * 3. 代码 → 文档 同步
 * 4. 归档状态 → 派生产物 一致性
 *
 * 用法: node scripts/verify-seed-sync.js [--fix] [--verbose]
 */

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// 配置
const CONFIG = {
  specsDir: 'openspec/specs',
  archiveDir: 'openspec/archive',
  codeDir: 'skills/mob-seed/lib',
  testDir: 'skills/mob-seed/test',
  docsDir: 'docs/api',
  scriptsDir: 'scripts'
};

// 特殊映射（规格名 → 实际实现位置）
const SPECIAL_MAPPINGS = {
  // 规格名: { type: 'script'|'code'|'prompt', path: '...' }
  'release-flow': { type: 'script', path: 'scripts/release.sh' },
  'version-sync': { type: 'script', path: 'scripts/bump-version.js' },
  'git-hooks': { type: 'hooks', path: '.seed/hooks/' },
  'commands': { type: 'prompt', path: 'commands/' },
  'interactive-mode': { type: 'code', codeName: 'interactive-prompt', altCode: 'progress-panel', codeDir: 'ux' },
  'integration': { type: 'code', codeName: 'integration', codeDir: 'mission', docName: 'mission-integration' },
  // core/ 规格的实际代码位置
  'complexity-router': { type: 'code', codeDir: 'router' },
  'task-sync': { type: 'code', codeDir: 'sync' },
  // adapters/ 规格对应 ESM 适配器
  'seed-utils': { type: 'adapter', path: 'skills/mob-seed/adapters/seed-utils.js' },
  // cache/ 规格 - session-cache 尚未实现（draft 状态）
  'session-cache': { type: 'future', note: 'v3.0 计划功能' },
  // workflow/ 规格
  'action-suggest': { type: 'future', note: 'v3.0 计划功能' }
};

/**
 * 递归查找文件
 */
function findFiles(dir, pattern) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...findFiles(fullPath, pattern));
    } else if (pattern.test(item.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * 从规格文件提取名称
 */
function extractSpecName(specPath) {
  const fileName = path.basename(specPath, '.fspec.md');
  return fileName;
}

/**
 * 检查规格状态
 */
function getSpecStatus(specPath) {
  const content = fs.readFileSync(specPath, 'utf-8');
  if (content.includes('状态: archived') || content.includes('status: archived')) {
    return 'archived';
  }
  if (content.includes('状态: implementing') || content.includes('status: implementing')) {
    return 'implementing';
  }
  if (content.includes('状态: draft') || content.includes('status: draft')) {
    return 'draft';
  }
  return 'unknown';
}

/**
 * 解析规格的派生产物
 */
function parseDerivedOutputs(specPath) {
  const content = fs.readFileSync(specPath, 'utf-8');
  const outputs = { code: null, test: null, doc: null };

  // 解析派生产物表格
  const tableMatch = content.match(/\| 代码 \| ([^\|]+) \|/);
  if (tableMatch) {
    outputs.code = tableMatch[1].trim();
  }

  const testMatch = content.match(/\| 测试 \| ([^\|]+) \|/);
  if (testMatch) {
    outputs.test = testMatch[1].trim();
  }

  const docMatch = content.match(/\| 文档 \| ([^\|]+) \|/);
  if (docMatch) {
    outputs.doc = docMatch[1].trim();
  }

  return outputs;
}

/**
 * 检查文件是否存在
 */
function fileExists(filePath) {
  // 处理相对于项目根目录的路径
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  return fs.existsSync(absolutePath);
}

/**
 * 主验证逻辑
 */
function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const fix = args.includes('--fix');

  console.log(`\n━━━ 🔍 SEED 同步验证 ━━━\n`);

  const errors = [];
  const warnings = [];
  const stats = {
    specs: 0,
    codeFiles: 0,
    testFiles: 0,
    docFiles: 0
  };

  // 1. 收集所有规格
  const specFiles = findFiles(CONFIG.specsDir, /\.fspec\.md$/);
  stats.specs = specFiles.length;

  console.log(`📋 规格文件: ${specFiles.length}`);

  // 2. 检查每个规格
  for (const specPath of specFiles) {
    const specName = extractSpecName(specPath);
    const status = getSpecStatus(specPath);
    const outputs = parseDerivedOutputs(specPath);
    const mapping = SPECIAL_MAPPINGS[specName];

    if (verbose) {
      console.log(`\n检查: ${specName} (${status})`);
    }

    // 跳过非代码类型的规格
    if (mapping?.type === 'script') {
      if (!fileExists(mapping.path)) {
        errors.push(`${specName}: 脚本不存在 - ${mapping.path}`);
      }
      continue;
    }

    if (mapping?.type === 'hooks') {
      if (!fs.existsSync(mapping.path)) {
        errors.push(`${specName}: Hooks 目录不存在 - ${mapping.path}`);
      }
      continue;
    }

    if (mapping?.type === 'prompt') {
      continue; // 命令类型规格不需要代码
    }

    if (mapping?.type === 'adapter') {
      // ESM 适配器类型
      if (!fileExists(mapping.path)) {
        errors.push(`${specName}: 适配器不存在 - ${mapping.path}`);
      }
      continue;
    }

    if (mapping?.type === 'future') {
      // 计划功能，跳过检查但显示信息
      if (verbose) {
        console.log(`  ℹ️ ${specName}: ${mapping.note}`);
      }
      continue;
    }

    // 检查代码文件
    let codePath;
    if (mapping?.codeName) {
      const codeDir = mapping.codeDir || path.dirname(specPath).split('/').pop();
      codePath = `${CONFIG.codeDir}/${codeDir}/${mapping.codeName}.js`;
    } else if (mapping?.codeDir) {
      // 有目录映射但没有名称映射（文件名与规格名相同）
      codePath = `${CONFIG.codeDir}/${mapping.codeDir}/${specName}.js`;
    } else if (outputs.code) {
      codePath = outputs.code;
    } else {
      // 推断代码路径
      const specDir = path.dirname(specPath).split('/').pop();
      codePath = `${CONFIG.codeDir}/${specDir}/${specName}.js`;
    }

    if (!fileExists(codePath)) {
      if (status === 'archived') {
        errors.push(`❌ ${specName}: 代码缺失 (规格已 archived) - ${codePath}`);
      } else {
        warnings.push(`⚠️ ${specName}: 代码缺失 (${status}) - ${codePath}`);
      }
    } else {
      stats.codeFiles++;

      // 检查测试文件
      const testPath = codePath
        .replace(CONFIG.codeDir, CONFIG.testDir)
        .replace('.js', '.test.js');

      if (!fileExists(testPath)) {
        if (status === 'archived') {
          errors.push(`❌ ${specName}: 测试缺失 (规格已 archived) - ${testPath}`);
        } else {
          warnings.push(`⚠️ ${specName}: 测试缺失 - ${testPath}`);
        }
      } else {
        stats.testFiles++;
      }

      // 检查文档
      const docPath = `${CONFIG.docsDir}/${specName}.md`;
      if (!fileExists(docPath)) {
        // 尝试替代名称（优先 docName，然后 codeName）
        const altDocPaths = [
          mapping?.docName ? `${CONFIG.docsDir}/${mapping.docName}.md` : null,
          mapping?.codeName ? `${CONFIG.docsDir}/${mapping.codeName}.md` : null
        ].filter(Boolean);

        const foundAltDoc = altDocPaths.some(p => fileExists(p));
        if (!foundAltDoc) {
          if (status === 'archived') {
            warnings.push(`⚠️ ${specName}: 文档缺失 - ${docPath}`);
          }
        } else {
          stats.docFiles++;
        }
      } else {
        stats.docFiles++;
      }
    }

    // 检查 altCode (如 interactive-mode 有 interactive-prompt 和 progress-panel)
    if (mapping?.altCode) {
      const altCodePath = `${CONFIG.codeDir}/ux/${mapping.altCode}.js`;
      if (!fileExists(altCodePath)) {
        if (status === 'archived') {
          errors.push(`❌ ${specName}: 替代代码缺失 - ${altCodePath}`);
        }
      }
    }
  }

  // 3. 输出结果
  console.log(`\n━━━ 统计 ━━━`);
  console.log(`规格: ${stats.specs}`);
  console.log(`代码: ${stats.codeFiles} (已验证)`);
  console.log(`测试: ${stats.testFiles} (已验证)`);
  console.log(`文档: ${stats.docFiles} (已验证)`);

  console.log(`\n━━━ 结果 ━━━\n`);

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`${GREEN}✅ 验证通过！所有规格与派生产物同步。${RESET}\n`);
    process.exit(0);
  }

  if (errors.length > 0) {
    console.log(`${RED}❌ 错误 (${errors.length}):${RESET}`);
    errors.forEach(e => console.log(`   ${RED}${e}${RESET}`));
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`${YELLOW}⚠️ 警告 (${warnings.length}):${RESET}`);
    warnings.forEach(w => console.log(`   ${YELLOW}${w}${RESET}`));
    console.log();
  }

  if (errors.length > 0) {
    console.log(`${RED}SEED 同步检查失败！${RESET}`);
    console.log(`${CYAN}修复建议:${RESET}`);
    console.log(`  1. 如果规格不应该 archived，将状态改回 implementing`);
    console.log(`  2. 如果功能确实需要，运行 /mob-seed:emit 派生代码`);
    console.log(`  3. 如果是误归档，恢复规格到 changes/ 目录\n`);
    process.exit(1);
  }

  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error(`${RED}错误: ${err.message}${RESET}`);
  process.exit(1);
}
