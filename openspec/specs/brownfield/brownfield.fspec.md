---
status: draft
created: 2026-01-03
updated: 2026-01-03
architecture_decisions_completed: true
---

# brownfield - 一键迁移现有项目到 SEED 方法论

> 版本: 1.0.0
> 创建时间: 2026-01-03
> 最后更新: 2026-01-03
> 模板: feature

---

## 概述 (Overview)

### 功能描述

`brownfield` 命令提供一键式工作流，将现有项目（Brownfield Project）迁移到 SEED 方法论。自动化执行项目检测、规格提取、智能补充和同步验证全流程。

### 目标用户

- **现有项目维护者**: 希望引入 SEED 方法论管理已有代码
- **技术债务清理者**: 需要系统化梳理项目结构和文档
- **团队协作者**: 需要建立规格作为团队沟通的单一真相源

### 核心价值

- **自动化迁移**: 从手动 4-5 天缩短到自动化 1-2 小时
- **渐进式接入**: 允许部分迁移、灵活调整，降低风险
- **质量保障**: 内置验证机制，确保生成规格的完整性和准确性
- **团队对齐**: 生成的规格成为团队沟通的统一语言

### 使用场景

- **场景1: 遗留项目规范化**
  - 10 年老项目，缺乏文档，代码混乱
  - 运行 `/mob-seed:brownfield`
  - 自动生成 50+ 规格文件，建立真相源

- **场景2: 新团队成员 Onboarding**
  - 新成员加入，需要理解项目架构
  - 基于自动生成的规格快速掌握全局

- **场景3: 重构前准备**
  - 计划大规模重构，需要先固化现状
  - 生成规格作为重构的 baseline

---

## 架构决策检查清单 (Architecture Decisions)

> **重要**: 在编写详细规格前，先完成以下架构决策检查。
> 完成所有检查后，将 frontmatter 中 `architecture_decisions_completed` 设为 `true`。

### 1. 目录结构设计

**决策点**: 新增代码应该放在哪个目录？

- [ ] 按功能分层（推荐：`lib/validation/`, `lib/cache/`, `lib/hooks/`, `lib/cli/`）
- [x] 按模块分组（`lib/spec/`, `lib/defend/`, `lib/emit/`）
- [ ] 扁平结构（`lib/*.js`）

**选择**: 按模块分组

**理由**:
- `brownfield` 是独立的功能模块，需要明确的边界
- 按模块分组方便集成和测试（`lib/brownfield/`）
- 与现有结构一致（`lib/spec/`, `lib/defend/` 已存在）

---

### 2. 命名规范

**决策点**: 文件和函数如何命名？

- [ ] 动词-对象模式（推荐：`validate-quick.js`, `parse-spec.js`）
- [x] 对象-动词模式（`quick-validator.js`, `spec-parser.js`）
- [ ] 名词模式（`validator.js`, `parser.js`）

**选择**: 对象-动词模式

**理由**:
- 文件名：`brownfield-orchestrator.js`（清晰表达角色）
- 函数名：`orchestrateMigration()`, `detectProject()`, `generateReport()`
- 这种模式在复杂工作流中更清晰（对象=brownfield, 动词=orchestrate）

---

### 3. 库与 CLI 分离

**决策点**: 是否需要分离库函数和 CLI 入口？

- [x] **是** - 分离（推荐：复用性高的核心逻辑）
  - 库函数：`lib/brownfield/*.js`
  - CLI 包装：`lib/cli/brownfield.js`
- [ ] **否** - 混合（CLI 和库在同一文件）

**选择**: 是 - 分离

**适用场景**:
- 编程式 API 调用：其他工具可直接调用 `orchestrateMigration()`
- 测试友好：库函数可独立测试，不依赖 CLI 参数解析
- 自动化集成：CI/CD 可以调用库函数而非 CLI

---

### 4. 错误处理策略

**决策点**: 如何处理错误和失败？

- [x] 优雅降级（推荐：缓存失败→完整检查）
- [ ] 快速失败（立即抛出错误）
- [ ] 静默失败（记录日志但不中断）

**选择**: 优雅降级

**降级路径**:
```
AST 解析失败 → 回退到简单正则提取 → 标记为低质量规格
├─ 继续处理其他文件
└─ 最后汇总报告所有失败

项目检测失败 → 使用默认配置 → 提示用户手动补充
├─ 继续执行提取流程
└─ 生成迁移建议

部分文件提取失败 → 跳过该文件 → 继续处理其余文件
├─ 记录失败列表
└─ 生成完整性报告
```

**理由**:
- Brownfield 项目结构复杂，完全成功不现实
- 部分成功优于全部失败
- 用户可基于报告逐步完善

---

### 5. 退出码设计

**决策点**: CLI 工具如何返回状态？

- [x] 分层退出码（推荐：0=成功, 1=验证失败, 2=系统错误, 3=配置错误, 124=超时, 130=中断）
- [ ] 简单退出码（0=成功, 1=失败）
- [ ] 不关心退出码（始终返回 0）

**选择**: 分层退出码

**码值定义**:
```javascript
const ExitCode = {
  SUCCESS: 0,              // 所有文件成功提取
  PARTIAL_SUCCESS: 1,      // 部分文件失败，但生成了规格
  SYSTEM_ERROR: 2,         // 系统错误（文件系统、权限）
  CONFIG_ERROR: 3,         // 配置错误（.seed/config.json 无效）
  INVALID_INPUT: 4,        // 用户输入错误（路径不存在）
  TIMEOUT: 124,            // 操作超时
  INTERRUPTED: 130         // 用户中断（Ctrl+C）
};
```

**理由**:
- CI/CD 需要区分不同失败类型
- 部分成功（exit 1）仍可用，完全失败（exit 2）需修复
- 与 defend, emit 命令退出码一致

---

### 6. Git Hooks 集成方式

**决策点**: 如果需要 Git Hooks，如何调用？

- [ ] 三层回退（推荐：配置 → 命令 → 库路径）
- [ ] 单一方式（只支持命令或只支持库）
- [x] 不需要 Git Hooks

**选择**: 不需要 Git Hooks

**理由**:
- `brownfield` 是用户主动调用的一次性命令
- 不是每次 commit 都需要执行
- 迁移完成后使用 `defend` 的 Git Hooks

---

### 7. 测试覆盖率要求

**决策点**: 各模块的测试覆盖率目标？

- [x] 按风险分级（推荐：High 95%+, Medium 85%+, Low 75%+）
- [ ] 统一标准（全部 90%+）
- [ ] 无强制要求

**选择**: 按风险分级

**风险分级**:
- 🔴 High Risk (≥95%):
  - `brownfield-orchestrator.js` - 工作流编排，错误影响全局
  - `project-detector.js` - 检测错误导致配置错误

- 🟡 Medium Risk (≥85%):
  - `report-generator.js` - 报告错误不影响核心功能
  - `migration-guide.js` - 建议生成，错误可容忍

- 🟢 Low Risk (≥75%):
  - `cli-formatter.js` - 输出格式化，视觉问题

**理由**:
- orchestrator 失败会导致整个迁移流程中断
- detector 错误可能创建错误配置，难以调试
- 报告和建议生成错误影响相对较小

---

### 8. 废弃策略

**决策点**: 如果需要废弃旧功能，如何平滑过渡？

- [x] 版本化废弃（推荐：v{n} deprecate → v{n+1} break → v{n+2} remove, +3 months each）
- [ ] 立即废弃（下一版本直接移除）
- [ ] 不需要废弃

**选择**: 版本化废弃

**时间线**:
```
v3.3.0 (2026 Q1) - 首次发布 brownfield 命令
  └─ 支持基础项目检测（Node.js, Python, Go）

v3.4.0 (2026 Q2) - 扩展支持（Ruby, Rust）
  ├─ Deprecate: 旧的项目检测 API（`detectProjectLegacy()`）
  └─ 提供新 API `detectProject()` 支持插件化检测器

v3.5.0 (2026 Q3) - 破坏性变更
  ├─ Remove: `detectProjectLegacy()`（已废弃 3 个月）
  └─ 所有调用迁移到新 API

v3.6.0 (2026 Q4) - 清理代码
  └─ 移除废弃代码和兼容层
```

**理由**:
- `brownfield` 是核心功能，突然变更影响大
- 用户需要时间调整脚本和工作流
- 3 个月周期符合 mob-seed 发布节奏

---

## 需求 (Requirements)

### 功能需求 (Functional Requirements)

- [x] FR-001: 项目结构自动检测
  - 检测项目类型（Node.js, Python, Go, etc.）
  - 识别源码目录、测试目录、配置文件
  - 生成 `.seed/config.json` 建议配置

- [x] FR-002: 批量规格提取
  - 调用 `spec extract` 批量处理所有源文件
  - 支持并发提取（可配置并发数）
  - 失败文件不阻塞整体流程

- [x] FR-003: 智能规格补充
  - 调用 `spec enrich` 补充提取的规格
  - 从测试文件提取验收标准
  - AI 辅助生成缺失部分

- [x] FR-004: 同步验证
  - 调用 `defend` 验证生成的规格与代码同步
  - 生成验证报告
  - 标记不一致的规格

- [x] FR-005: 迁移报告生成
  - 统计提取成功/失败数量
  - 质量评分（AST vs 正则 vs 模板）
  - 后续建议（哪些规格需要人工审核）

- [x] FR-006: 用户交互引导
  - 进度显示（当前处理哪个文件）
  - 预估时间（基于文件数量）
  - 中断恢复（支持 Ctrl+C 后继续）

### 非功能需求 (Non-Functional Requirements)

- [x] NFR-001: 性能 - 大型项目支持
  - 1000+ 文件项目，提取时间 < 30 分钟
  - 内存占用 < 500MB（流式处理）
  - 支持增量提取（只处理新增/修改文件）

- [x] NFR-002: 可靠性 - 错误恢复
  - 单文件失败不影响整体流程
  - 自动重试（3 次，指数退避）
  - 状态持久化（支持中断后恢复）

- [x] NFR-003: 可用性 - 用户友好
  - 清晰的进度提示
  - 详细的错误消息
  - 可读的迁移报告

---

## 约束 (Constraints)

### 技术约束

- 技术栈: Node.js (CommonJS), 复用现有 `lib/spec/*`, `lib/defend/*` 模块
- 兼容性: Node.js 18+
- 依赖:
  - 必需：`@babel/parser`, `@babel/traverse`（AST 解析）
  - 可选：`ora` (进度显示), `chalk` (彩色输出)

### 业务约束

- 业务规则:
  - 不修改原有代码文件
  - 生成的规格文件放在 `openspec/specs/` 或用户配置路径
  - 保留原项目结构，不强制重组
- 合规要求:
  - 不上传用户代码到远程（AI 辅助功能可选）
  - 敏感信息过滤（密码、Token）

### 资源约束

- 时间: v3.3.0 发布前完成
- 范围: 仅支持 JavaScript/Node.js 项目（v3.3），其他语言 v3.4+

---

## 验收标准 (Acceptance Criteria)

### AC-001: 项目检测准确性

- **Given**: 一个标准 Node.js 项目（package.json, src/, test/）
- **When**: 运行 `/mob-seed:brownfield`
- **Then**:
  - 正确检测出项目类型为 "Node.js"
  - 识别出 `src/` 为源码目录
  - 识别出 `test/` 为测试目录
  - 生成 `.seed/config.json` 包含正确路径

### AC-002: 批量提取成功

- **Given**: 项目有 50 个 JS 文件
- **When**: 执行批量提取
- **Then**:
  - 所有文件尝试提取（进度显示 50/50）
  - 成功文件生成 `.fspec.md`
  - 失败文件记录在报告中
  - 退出码为 0（全成功）或 1（部分失败）

### AC-003: 智能补充有效性

- **Given**: 提取的规格缺少验收标准
- **When**: 运行智能补充
- **Then**:
  - 从对应测试文件提取 AC
  - AC 格式符合 Given-When-Then
  - 规格文件标记补充来源（Tests/AI）

### AC-004: 同步验证正确性

- **Given**: 生成的规格与代码存在差异
- **When**: 运行 defend 验证
- **Then**:
  - 检测出不一致的规格
  - 报告列出具体差异点
  - 建议用户手动审核

### AC-005: 迁移报告完整性

- **Given**: 迁移完成
- **When**: 查看迁移报告
- **Then**:
  - 报告包含统计信息（成功/失败/质量分布）
  - 报告包含后续建议（哪些需要审核）
  - 报告格式清晰易读（表格 + 摘要）

### AC-006: 中断恢复能力

- **Given**: 迁移进行到 60%
- **When**: 用户按 Ctrl+C 中断
- **Then**:
  - 保存当前状态到 `.seed/brownfield-state.json`
  - 下次运行时询问是否继续
  - 继续时从 60% 开始，跳过已完成文件

---

## 技术设计 (Technical Design)

### 工作流编排器 (brownfield-orchestrator.js)

```javascript
const { detectProject } = require('./project-detector');
const { extractSpecs } = require('../spec/from-code');
const { enrichSpecs } = require('../spec/enrich');
const { validateSpecs } = require('../defend/validator');
const { generateReport } = require('./report-generator');
const { loadState, saveState } = require('./state-manager');

/**
 * 编排完整的 Brownfield 迁移流程
 *
 * @param {Object} options - 迁移选项
 * @param {string} options.projectPath - 项目根路径
 * @param {boolean} options.resume - 是否恢复中断的迁移
 * @param {number} options.concurrency - 并发数（默认 5）
 * @param {boolean} options.enrichEnabled - 是否启用智能补充
 * @returns {Promise<MigrationResult>}
 */
async function orchestrateMigration(options) {
  const { projectPath, resume, concurrency = 5, enrichEnabled = true } = options;

  // 步骤 1: 检查是否有中断状态
  let state = null;
  if (resume) {
    state = await loadState(projectPath);
    if (!state) {
      console.warn('⚠️ 未找到中断状态，将从头开始');
    }
  }

  // 步骤 2: 项目检测
  console.log('📦 检测项目结构...');
  const projectInfo = await detectProject(projectPath);
  console.log(`✅ 检测到 ${projectInfo.type} 项目`);
  console.log(`   源码: ${projectInfo.srcDir}`);
  console.log(`   测试: ${projectInfo.testDir}`);

  // 步骤 3: 生成/验证配置
  const configPath = path.join(projectPath, '.seed/config.json');
  if (!fs.existsSync(configPath)) {
    console.log('📝 生成 .seed/config.json...');
    await generateConfig(projectInfo, configPath);
  }

  // 步骤 4: 批量提取规格
  console.log('\n🔍 批量提取规格...');
  const filesToProcess = state ? state.remaining : projectInfo.sourceFiles;
  const extractResult = await extractSpecs({
    files: filesToProcess,
    concurrency,
    onProgress: (current, total) => {
      console.log(`   进度: ${current}/${total}`);
      // 定期保存状态
      if (current % 10 === 0) {
        saveState(projectPath, { remaining: filesToProcess.slice(current) });
      }
    }
  });

  console.log(`✅ 提取完成: ${extractResult.success}/${extractResult.total}`);
  if (extractResult.failed.length > 0) {
    console.log(`⚠️  失败文件: ${extractResult.failed.length}`);
  }

  // 步骤 5: 智能补充（可选）
  let enrichResult = null;
  if (enrichEnabled && extractResult.success > 0) {
    console.log('\n🧠 智能补充规格...');
    enrichResult = await enrichSpecs({
      specs: extractResult.specs,
      testDir: projectInfo.testDir
    });
    console.log(`✅ 补充完成: ${enrichResult.enriched} 个规格`);
  }

  // 步骤 6: 同步验证
  console.log('\n🛡️  验证规格同步状态...');
  const validateResult = await validateSpecs({
    specsDir: path.join(projectPath, 'openspec/specs'),
    codeDir: projectInfo.srcDir
  });

  console.log(`✅ 验证完成: ${validateResult.synced}/${validateResult.total} 同步`);
  if (validateResult.drifted.length > 0) {
    console.log(`⚠️  偏离规格: ${validateResult.drifted.length}`);
  }

  // 步骤 7: 生成迁移报告
  console.log('\n📊 生成迁移报告...');
  const report = await generateReport({
    projectInfo,
    extractResult,
    enrichResult,
    validateResult
  });

  const reportPath = path.join(projectPath, '.seed/migration-report.md');
  fs.writeFileSync(reportPath, report);
  console.log(`✅ 报告已保存: ${reportPath}`);

  // 清理状态文件
  if (state) {
    fs.unlinkSync(path.join(projectPath, '.seed/brownfield-state.json'));
  }

  return {
    success: extractResult.failed.length === 0,
    stats: {
      extracted: extractResult.success,
      failed: extractResult.failed.length,
      enriched: enrichResult?.enriched || 0,
      synced: validateResult.synced,
      drifted: validateResult.drifted.length
    },
    reportPath
  };
}

module.exports = { orchestrateMigration };
```

### 项目检测器 (project-detector.js)

```javascript
const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

/**
 * 检测项目类型和结构
 *
 * @param {string} projectPath - 项目根路径
 * @returns {Promise<ProjectInfo>}
 */
async function detectProject(projectPath) {
  const detectors = [
    detectNodeJS,
    detectPython,
    detectGo,
    // 未来: detectRuby, detectRust, etc.
  ];

  for (const detector of detectors) {
    const result = await detector(projectPath);
    if (result) {
      return result;
    }
  }

  // 回退: 使用默认配置
  return {
    type: 'unknown',
    srcDir: 'src',
    testDir: 'test',
    sourceFiles: await glob.sync('**/*.{js,ts}', {
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**']
    })
  };
}

/**
 * 检测 Node.js 项目
 */
async function detectNodeJS(projectPath) {
  const packageJsonPath = path.join(projectPath, 'package.json');

  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

    // 确认是 Node.js 项目
    if (!packageJson.name) return null;

    // 检测源码目录
    const srcDir =
      (await exists(path.join(projectPath, 'src'))) ? 'src' :
      (await exists(path.join(projectPath, 'lib'))) ? 'lib' :
      '.';

    // 检测测试目录
    const testDir =
      (await exists(path.join(projectPath, 'test'))) ? 'test' :
      (await exists(path.join(projectPath, 'tests'))) ? 'tests' :
      (await exists(path.join(projectPath, '__tests__'))) ? '__tests__' :
      'test';

    // 获取所有源文件
    const sourceFiles = await glob.sync(`${srcDir}/**/*.{js,ts}`, {
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**']
    });

    return {
      type: 'Node.js',
      srcDir,
      testDir,
      sourceFiles,
      packageManager: await detectPackageManager(projectPath)
    };
  } catch (error) {
    return null;
  }
}

async function exists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

module.exports = { detectProject };
```

### 迁移报告生成器 (report-generator.js)

```javascript
/**
 * 生成迁移报告
 */
async function generateReport({ projectInfo, extractResult, enrichResult, validateResult }) {
  const qualityDistribution = calculateQualityDistribution(extractResult.specs);

  return `# Brownfield 迁移报告

> 项目: ${projectInfo.type}
> 时间: ${new Date().toISOString()}

## 📊 统计摘要

| 指标 | 数量 | 百分比 |
|------|------|--------|
| 总文件数 | ${extractResult.total} | 100% |
| 提取成功 | ${extractResult.success} | ${percent(extractResult.success, extractResult.total)} |
| 提取失败 | ${extractResult.failed.length} | ${percent(extractResult.failed.length, extractResult.total)} |
| 智能补充 | ${enrichResult?.enriched || 0} | ${percent(enrichResult?.enriched || 0, extractResult.success)} |
| 同步验证通过 | ${validateResult.synced} | ${percent(validateResult.synced, validateResult.total)} |
| 规格偏离 | ${validateResult.drifted.length} | ${percent(validateResult.drifted.length, validateResult.total)} |

## 🎯 质量分布

| 质量等级 | 数量 | 说明 |
|----------|------|------|
| ⭐⭐⭐ 高质量 | ${qualityDistribution.high} | AST 解析 + 完整 JSDoc |
| ⭐⭐ 中等质量 | ${qualityDistribution.medium} | 正则提取 + 部分文档 |
| ⭐ 低质量 | ${qualityDistribution.low} | 模板生成 + 需人工补充 |

## ⚠️ 失败文件列表

${extractResult.failed.map(f => `- \`${f.file}\`: ${f.error}`).join('\n')}

## 📝 后续建议

### 高优先级

${validateResult.drifted.map(spec =>
  `- [ ] 审核 \`${spec}\` - 检测到代码与规格不一致`
).join('\n')}

### 中优先级

${qualityDistribution.lowQualitySpecs.slice(0, 10).map(spec =>
  `- [ ] 补充 \`${spec}\` - 自动提取质量较低，需人工审核`
).join('\n')}

### 低优先级

- [ ] 检查所有规格的验收标准（AC）是否完整
- [ ] 运行 \`/mob-seed:defend\` 定期验证同步状态
- [ ] 配置 Git Hooks 自动运行 defend

## 🚀 下一步操作

1. 审核高优先级规格（${validateResult.drifted.length} 个）
2. 补充低质量规格（${qualityDistribution.lowQualitySpecs.length} 个）
3. 运行 \`/mob-seed:defend\` 验证修改后的规格
4. 配置 Git Hooks: \`/mob-seed:init --hooks\`

---

**迁移完成度**: ${calculateCompleteness(extractResult, validateResult)}%
`;
}

function calculateQualityDistribution(specs) {
  const high = specs.filter(s => s.quality === 'high').length;
  const medium = specs.filter(s => s.quality === 'medium').length;
  const low = specs.filter(s => s.quality === 'low').length;
  const lowQualitySpecs = specs.filter(s => s.quality === 'low').map(s => s.path);

  return { high, medium, low, lowQualitySpecs };
}

function percent(value, total) {
  return total === 0 ? '0%' : `${Math.round(value / total * 100)}%`;
}

function calculateCompleteness(extractResult, validateResult) {
  const extractScore = (extractResult.success / extractResult.total) * 50;
  const syncScore = (validateResult.synced / validateResult.total) * 50;
  return Math.round(extractScore + syncScore);
}

module.exports = { generateReport };
```

---

## CLI 使用示例

```bash
# 基本用法: 一键迁移当前项目
/mob-seed:brownfield

# 指定项目路径
/mob-seed:brownfield /path/to/project

# 跳过智能补充（仅提取）
/mob-seed:brownfield --no-enrich

# 设置并发数（默认 5）
/mob-seed:brownfield --concurrency=10

# 恢复中断的迁移
/mob-seed:brownfield --resume

# 增量模式（只处理新文件）
/mob-seed:brownfield --incremental

# 预览模式（不生成文件）
/mob-seed:brownfield --dry-run
```

---

## 派生产物 (Derived Outputs)

> **路径规范**: 所有路径必须遵循 `.seed/config.json` 中的 `paths` 配置。

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/brownfield/orchestrator.js | 主编排器 |
| 代码 | skills/mob-seed/lib/brownfield/project-detector.js | 项目检测器 |
| 代码 | skills/mob-seed/lib/brownfield/report-generator.js | 报告生成器 |
| 代码 | skills/mob-seed/lib/brownfield/state-manager.js | 状态管理 |
| 代码 | skills/mob-seed/lib/cli/brownfield.js | CLI 入口 |
| 测试 | skills/mob-seed/test/brownfield/orchestrator.test.js | 编排器测试 |
| 测试 | skills/mob-seed/test/brownfield/project-detector.test.js | 检测器测试 |
| 测试 | skills/mob-seed/test/brownfield/report-generator.test.js | 报告生成测试 |
| 文档 | commands/brownfield.md | 命令文档 |

---

## 依赖 (Dependencies)

### 前置规格

- `spec-extract.fspec.md` - 规格提取引擎
- `spec-enrich.fspec.md` - 规格补充引擎
- `reverse-engineer-ast.fspec.md` - AST 解析工具

### 外部依赖

- `@babel/parser` - AST 解析
- `@babel/traverse` - AST 遍历
- `glob` - 文件匹配
- `ora` (可选) - 进度显示
- `chalk` (可选) - 彩色输出

---

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.0 | 2026-01-03 | 初始版本，完成架构决策和技术设计 | Claude |
