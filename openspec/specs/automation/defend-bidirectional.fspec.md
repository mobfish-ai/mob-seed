---
status: draft
created: 2026-01-03
updated: 2026-01-03
architecture_decisions_completed: true
---

# defend-bidirectional - 双向同步守护

> 版本: 1.0.0
> 创建时间: 2026-01-03
> 最后更新: 2026-01-03
> 模板: feature

---

## 概述 (Overview)

### 功能描述

扩展 `/mob-seed:defend` 命令，支持双向同步：不仅检查代码是否符合规格（Spec → Code 守护），还支持从代码变更反向更新规格（Code → Spec 同步），并集成 ACE 观察机制，自动记录偏离和建议规格更新。

### 目标用户

- **活跃开发者**: 频繁修改代码，需要规格自动跟进
- **重构团队**: 大规模代码变更后需要同步规格
- **维护者**: 希望规格保持最新，减少手动更新

### 核心价值

- **减少手动同步**: 代码变更后自动建议规格更新，从手动 2-3 小时 → 自动 5 分钟
- **降低规格腐化风险**: 实时检测偏离，防止规格成为"历史文档"
- **闭环反馈**: 集成 ACE 观察，让规格从执行反馈中学习演化

### 使用场景

- **场景1: 紧急 Hotfix 后同步**
  - 修复紧急 bug，直接改代码
  - 运行 `/mob-seed:defend --sync-direction=code`
  - 自动更新规格，标记需要审核的部分

- **场景2: 大规模重构后同步**
  - 重构 100+ 文件，函数签名变更
  - 批量运行双向同步
  - 自动生成规格更新提案

- **场景3: CI/CD 持续守护**
  - 每次 PR 运行 defend
  - 检测到偏离时创建 ACE 观察
  - 自动评论 PR: "检测到规格偏离，建议更新 spec XYZ"

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
- 双向同步是 `defend` 模块的扩展，应放在 `lib/defend/`
- 文件组织: `lib/defend/bidirectional-sync.js`, `lib/defend/code-to-spec.js`
- 与现有 `lib/defend/validator.js`, `lib/defend/drift-detector.js` 一致

---

### 2. 命名规范

**决策点**: 文件和函数如何命名？

- [ ] 动词-对象模式（推荐：`validate-quick.js`, `parse-spec.js`）
- [x] 对象-动词模式（`quick-validator.js`, `spec-parser.js`）
- [ ] 名词模式（`validator.js`, `parser.js`）

**选择**: 对象-动词模式

**理由**:
- 文件名：`bidirectional-sync.js` (对象=bidirectional, 动词=sync)
- 函数名：`syncCodeToSpec()`, `detectDrift()`, `proposeUpdate()`
- 与现有 defend 模块命名一致

---

### 3. 库与 CLI 分离

**决策点**: 是否需要分离库函数和 CLI 入口？

- [x] **是** - 分离（推荐：复用性高的核心逻辑）
  - 库函数：`lib/defend/*.js`
  - CLI 包装：`lib/cli/defend.js`
- [ ] **否** - 混合（CLI 和库在同一文件）

**选择**: 是 - 分离

**适用场景**:
- Git Hooks 需要调用库函数：`require('../../lib/defend/bidirectional-sync')`
- CI/CD 编程式调用：`syncCodeToSpec({ files: changedFiles })`
- 其他工具集成：emit 后自动调用 defend

---

### 4. 错误处理策略

**决策点**: 如何处理错误和失败？

- [ ] 优雅降级（推荐：缓存失败→完整检查）
- [x] 快速失败（立即抛出错误）
- [ ] 静默失败（记录日志但不中断）

**选择**: 快速失败

**降级路径**:
```
规格-代码不一致 → 立即停止 → 报告差异 → 等待用户决策
├─ 不自动修改规格（防止误更新）
└─ 提供建议更新内容，用户确认后执行

AST 解析失败 → 立即失败 → 报告错误位置 → 提示修复代码
├─ 不回退到简单正则（可能遗漏关键变更）
└─ 要求用户修复语法错误后重试

Git 状态不干净 → 立即失败 → 提示先 commit → 防止误操作
├─ defend 修改规格前需要 clean working tree
└─ 确保所有变更可追溯
```

**理由**:
- 双向同步涉及规格修改，错误成本高
- "快速失败 + 明确报告" 优于 "静默降级 + 隐藏问题"
- 用户决策优于自动猜测

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
  SUCCESS: 0,              // 规格-代码完全同步
  DRIFT_DETECTED: 1,       // 检测到偏离（单向检查模式）
  SYNC_REQUIRED: 2,        // 需要同步（双向同步模式）
  USER_DECLINED: 3,        // 用户拒绝更新建议
  GIT_DIRTY: 4,            // Git 工作区不干净
  SYSTEM_ERROR: 5,         // 系统错误（文件读写失败）
  TIMEOUT: 124,            // 操作超时
  INTERRUPTED: 130         // 用户中断（Ctrl+C）
};
```

**理由**:
- CI/CD 需要区分"检测到偏离"和"系统错误"
- Git Hooks 需要知道是否允许 commit（exit 0 or non-zero）
- 与现有 defend 命令退出码一致

---

### 6. Git Hooks 集成方式

**决策点**: 如果需要 Git Hooks，如何调用？

- [x] 三层回退（推荐：配置 → 命令 → 库路径）
- [ ] 单一方式（只支持命令或只支持库）
- [ ] 不需要 Git Hooks

**选择**: 三层回退

**回退策略**:
```bash
#!/bin/sh
# .git/hooks/pre-commit

# 层级 1: 读取配置
DEFEND_CMD=$(git config seed.defend.command)
if [ -n "$DEFEND_CMD" ]; then
  $DEFEND_CMD --sync-direction=bidirectional
  exit $?
fi

# 层级 2: 尝试命令路径
if command -v mob-seed >/dev/null 2>&1; then
  mob-seed defend --sync-direction=bidirectional
  exit $?
fi

# 层级 3: 直接调用库（绝对路径）
PROJECT_ROOT=$(git rev-parse --show-toplevel)
node "$PROJECT_ROOT/skills/mob-seed/lib/cli/defend.js" --sync-direction=bidirectional
```

**理由**:
- 用户可能在不同环境（开发/CI/远程服务器）
- 配置优先允许自定义行为
- 库路径回退确保总能运行

---

### 7. 测试覆盖率要求

**决策点**: 各模块的测试覆盖率目标？

- [x] 按风险分级（推荐：High 95%+, Medium 85%+, Low 75%+）
- [ ] 统一标准（全部 90%+）
- [ ] 无强制要求

**选择**: 按风险分级

**风险分级**:
- 🔴 High Risk (≥95%):
  - `bidirectional-sync.js` - 核心同步逻辑，错误会破坏规格
  - `code-to-spec.js` - 代码解析和规格更新，错误会导致信息丢失
  - `conflict-resolver.js` - 冲突解决，错误会导致数据损坏

- 🟡 Medium Risk (≥85%):
  - `drift-detector.js` - 偏离检测，假阳性可容忍
  - `update-proposer.js` - 更新建议，用户可审核

- 🟢 Low Risk (≥75%):
  - `cli-formatter.js` - 输出格式化，视觉问题
  - `progress-reporter.js` - 进度显示，不影响功能

**理由**:
- 双向同步直接修改规格，错误成本极高
- 必须通过严格测试确保正确性
- 假阳性（误报偏离）可容忍，假阴性（遗漏偏离）不可容忍

---

### 8. 废弃策略

**决策点**: 如果需要废弃旧功能，如何平滑过渡？

- [x] 版本化废弃（推荐：v{n} deprecate → v{n+1} break → v{n+2} remove, +3 months each）
- [ ] 立即废弃（下一版本直接移除）
- [ ] 不需要废弃

**选择**: 版本化废弃

**时间线**:
```
v3.3.0 (2026 Q1) - 首次发布 --sync-direction=bidirectional
  ├─ 默认模式: 单向守护（Spec → Code）
  └─ 新增选项: --sync-direction=code, --sync-direction=bidirectional

v3.4.0 (2026 Q2) - 默认改为双向同步
  ├─ Deprecate: 单向模式成为非默认选项
  ├─ 警告: "单向模式将在 v3.5 移除，请使用 --sync-direction=spec 显式指定"
  └─ 文档: 更新最佳实践为双向同步

v3.5.0 (2026 Q3) - 移除单向模式
  ├─ Breaking: 移除单向模式
  ├─ 所有 defend 默认双向同步
  └─ 用户必须适配或固定在 v3.4

v3.6.0 (2026 Q4) - 清理遗留代码
  └─ 移除废弃警告和兼容层
```

**理由**:
- defend 是核心命令，改变默认行为影响大
- 给用户足够时间适应新模式
- 3 个月周期符合 mob-seed 发布节奏

---

## 需求 (Requirements)

### 功能需求 (Functional Requirements)

- [x] FR-001: 代码变更检测
  - 集成 Git diff，检测自上次 defend 以来的代码变更
  - 识别新增/修改/删除的函数、类、模块
  - 计算变更影响范围（哪些规格受影响）

- [x] FR-002: 规格更新建议生成
  - 基于代码变更生成规格更新建议
  - 使用 AST 提取最新的函数签名、参数、返回值
  - 保留规格中的业务描述和验收标准（不覆盖）

- [x] FR-003: 用户确认流程
  - 显示 diff：规格当前内容 vs 建议更新内容
  - 交互式确认：逐项审核每个更新
  - 批量操作：全部接受 / 全部拒绝 / 逐项选择

- [x] FR-004: 规格安全更新
  - 只更新"派生产物"章节（代码路径、函数签名）
  - 保护"需求"、"验收标准"章节（业务逻辑，不自动修改）
  - 自动备份更新前的规格（.seed/backups/）

- [x] FR-005: ACE 观察集成
  - 检测到偏离时自动创建观察记录
  - 记录偏离类型（签名变更、新增功能、删除功能）
  - 触发反思分析（多次相同偏离 → 规格模板改进）

- [x] FR-006: 冲突解决机制
  - 检测规格-代码冲突（用户改了规格，代码也改了）
  - 三方合并：规格基线 vs 规格当前 vs 代码当前
  - 提示用户手动解决冲突

### 非功能需求 (Non-Functional Requirements)

- [x] NFR-001: 性能 - 增量同步
  - 只处理变更的文件（不全量扫描）
  - 缓存上次同步状态（.seed/defend-cache.json）
  - 1000+ 文件项目，增量同步 < 30 秒

- [x] NFR-002: 安全 - 防止误更新
  - Git 工作区必须干净（无未提交更改）
  - 更新前自动备份规格
  - 提供回滚命令（`/mob-seed:defend --rollback`）

- [x] NFR-003: 可用性 - 清晰反馈
  - 显示每个更新建议的理由
  - 高亮差异（红色=删除，绿色=新增）
  - 提供预览模式（`--dry-run`）

---

## 约束 (Constraints)

### 技术约束

- 技术栈: Node.js (CommonJS), 复用 `lib/defend/*`, `lib/spec/*` 模块
- 兼容性: Node.js 18+
- 依赖:
  - 必需：`@babel/parser`, `@babel/traverse` (代码解析)
  - 必需：`diff` (diff 算法)
  - 可选：`inquirer` (交互式 CLI)

### 业务约束

- 业务规则:
  - 只更新"派生产物"章节，不修改业务需求
  - 不自动删除规格文件（即使代码被删除）
  - 用户必须手动确认每次更新
- 合规要求:
  - 所有规格更新可追溯（Git commit）
  - 自动创建 ACE 观察记录

### 资源约束

- 时间: v3.3.0 发布前完成
- 范围: 仅支持 JavaScript/Node.js 项目（v3.3），其他语言 v3.4+

---

## 验收标准 (Acceptance Criteria)

### AC-001: 代码变更检测准确性

- **Given**: 项目有 10 个源文件，其中 3 个被修改
- **When**: 运行 `/mob-seed:defend --sync-direction=code`
- **Then**:
  - 只检查 3 个修改的文件（不全量扫描）
  - 准确识别变更类型（函数新增/修改/删除）
  - 匹配到对应的规格文件

### AC-002: 规格更新建议正确性

- **Given**: 函数 `foo(a, b)` 改为 `foo(a, b, c)`
- **When**: 生成更新建议
- **Then**:
  - 建议中包含新参数 `c` 的签名
  - 保留规格中现有的需求和 AC（不覆盖）
  - 只更新"派生产物"章节的函数签名

### AC-003: 用户确认流程清晰

- **Given**: 有 5 处规格需要更新
- **When**: 用户运行交互式同步
- **Then**:
  - 逐项显示 diff（当前 vs 建议）
  - 提供选项：Accept / Reject / Skip
  - 最后汇总：接受 3 个，拒绝 2 个

### AC-004: 规格安全更新

- **Given**: 规格有"需求"和"派生产物"两个章节
- **When**: 代码变更导致更新
- **Then**:
  - "派生产物"章节被更新（函数签名）
  - "需求"章节保持不变（业务描述）
  - 更新前自动备份到 `.seed/backups/spec-YYYYMMDD-HHMMSS.fspec.md`

### AC-005: ACE 观察自动记录

- **Given**: 检测到规格偏离
- **When**: defend 运行完成
- **Then**:
  - 创建观察记录：`.seed/observations/obs-YYYYMMDD-HHMMSS.md`
  - 记录偏离类型、文件路径、建议更新
  - 如果拒绝更新，标记为 "user_declined"

### AC-006: 冲突检测和提示

- **Given**: 用户手动修改了规格，代码也改了
- **When**: 运行双向同步
- **Then**:
  - 检测到冲突
  - 提示用户手动解决
  - 退出码为非零（阻止自动 commit）

---

## 技术设计 (Technical Design)

### 双向同步引擎 (bidirectional-sync.js)

```javascript
const { spawnSync } = require('child_process');
const { parseCodeAST } = require('../spec/from-code');
const { loadSpec, updateSpec } = require('../spec/parser');
const { createObservation } = require('../ace/observation');
const { diff } = require('diff');

/**
 * 双向同步主函数
 *
 * @param {Object} options - 同步选项
 * @param {string} options.syncDirection - 同步方向: 'spec' | 'code' | 'bidirectional'
 * @param {boolean} options.interactive - 是否交互式确认
 * @param {boolean} options.dryRun - 预览模式
 * @returns {Promise<SyncResult>}
 */
async function syncBidirectional(options) {
  const { syncDirection = 'bidirectional', interactive = true, dryRun = false } = options;

  // 步骤 1: 检查 Git 状态
  if (!dryRun) {
    ensureCleanWorkingTree();
  }

  // 步骤 2: 检测代码变更
  console.log('🔍 检测代码变更...');
  const changedFiles = detectChangedFiles();
  console.log(`   发现 ${changedFiles.length} 个文件变更`);

  // 步骤 3: 分析每个变更文件
  const updates = [];
  for (const file of changedFiles) {
    const specPath = findRelatedSpec(file.path);
    if (!specPath) {
      console.log(`   ⚠️  ${file.path} 没有对应规格，跳过`);
      continue;
    }

    // 解析代码获取最新签名
    const codeInfo = await parseCodeAST(file.path);
    const spec = loadSpec(specPath);

    // 比较规格和代码
    const drift = detectDrift(spec, codeInfo);
    if (drift.length === 0) {
      console.log(`   ✅ ${file.path} 与规格同步`);
      continue;
    }

    // 生成更新建议
    const proposal = generateUpdateProposal(spec, codeInfo, drift);
    updates.push({ file: file.path, specPath, proposal });

    // 创建 ACE 观察
    await createObservation({
      type: 'spec_drift',
      source: file.path,
      specFile: specPath,
      drift,
      proposal
    });
  }

  // 步骤 4: 用户确认
  if (updates.length === 0) {
    console.log('\n✅ 所有文件与规格同步');
    return { exitCode: 0, updatesApplied: 0 };
  }

  console.log(`\n📝 检测到 ${updates.length} 个规格需要更新`);

  let approved = updates;
  if (interactive) {
    approved = await interactiveConfirm(updates);
  }

  // 步骤 5: 应用更新
  if (!dryRun) {
    for (const update of approved) {
      await applyUpdate(update);
      console.log(`   ✅ 已更新 ${update.specPath}`);
    }
  } else {
    console.log('\n🔍 预览模式，不应用更新');
    approved.forEach(u => {
      console.log(`\n--- ${u.specPath} ---`);
      console.log(u.proposal.diff);
    });
  }

  return {
    exitCode: approved.length === updates.length ? 0 : 2,
    updatesApplied: approved.length,
    updatesDeclined: updates.length - approved.length
  };
}

/**
 * 检测代码变更（使用 spawnSync 避免命令注入）
 */
function detectChangedFiles() {
  const lastDefendCommit = getLastDefendCommit() || 'HEAD~1';

  // 使用 spawnSync 而非 exec 避免命令注入
  const result = spawnSync('git', ['diff', `${lastDefendCommit}..HEAD`, '--name-only'], {
    encoding: 'utf8',
    cwd: process.cwd()
  });

  if (result.error || result.status !== 0) {
    throw new Error(`Git diff 失败: ${result.stderr || result.error?.message}`);
  }

  return result.stdout.split('\n')
    .filter(line => line.trim() && (line.endsWith('.js') || line.endsWith('.ts')))
    .filter(line => !line.includes('test/'))  // 排除测试文件
    .map(path => ({ path, status: 'modified' }));
}

/**
 * 检测规格-代码偏离
 */
function detectDrift(spec, codeInfo) {
  const drifts = [];

  // 检查函数签名变更
  codeInfo.methods.forEach(method => {
    const specMethod = findMethodInSpec(spec, method.name);
    if (!specMethod) {
      drifts.push({
        type: 'method_added',
        method: method.name,
        signature: method.signature
      });
    } else if (specMethod.signature !== method.signature) {
      drifts.push({
        type: 'signature_changed',
        method: method.name,
        oldSignature: specMethod.signature,
        newSignature: method.signature
      });
    }
  });

  // 检查删除的函数
  spec.methods?.forEach(specMethod => {
    const codeMethod = codeInfo.methods.find(m => m.name === specMethod.name);
    if (!codeMethod) {
      drifts.push({
        type: 'method_removed',
        method: specMethod.name
      });
    }
  });

  return drifts;
}

/**
 * 生成更新建议
 */
function generateUpdateProposal(spec, codeInfo, drifts) {
  const updates = [];

  drifts.forEach(drift => {
    if (drift.type === 'method_added') {
      updates.push({
        section: 'derived_outputs',
        action: 'add',
        content: `| 函数 | ${drift.method}(${drift.signature}) | 新增函数 |`
      });
    } else if (drift.type === 'signature_changed') {
      updates.push({
        section: 'derived_outputs',
        action: 'update',
        oldContent: `${drift.oldSignature}`,
        newContent: `${drift.newSignature}`,
        reason: '函数签名变更'
      });
    } else if (drift.type === 'method_removed') {
      updates.push({
        section: 'derived_outputs',
        action: 'remove',
        content: `函数 ${drift.method}`,
        reason: '代码中已删除'
      });
    }
  });

  // 生成 diff
  const originalContent = spec.sections.derived_outputs || '';
  const updatedContent = applyUpdatesPreview(originalContent, updates);
  const diffText = diff.createPatch('spec', originalContent, updatedContent);

  return {
    updates,
    diff: diffText,
    summary: `${updates.length} 处变更`
  };
}

/**
 * 交互式确认
 */
async function interactiveConfirm(updates) {
  const inquirer = require('inquirer');
  const approved = [];

  for (const update of updates) {
    console.log(`\n━━━ ${update.specPath} ━━━`);
    console.log(update.proposal.diff);

    const answer = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: '应用此更新?',
      choices: ['Accept', 'Reject', 'Accept All', 'Reject All']
    }]);

    if (answer.action === 'Accept') {
      approved.push(update);
    } else if (answer.action === 'Accept All') {
      approved.push(...updates);
      break;
    } else if (answer.action === 'Reject All') {
      break;
    }
  }

  return approved;
}

/**
 * 应用更新
 */
async function applyUpdate(update) {
  const spec = loadSpec(update.specPath);

  // 备份原规格
  await backupSpec(update.specPath);

  // 应用更新（只更新派生产物章节）
  update.proposal.updates.forEach(u => {
    if (u.section === 'derived_outputs') {
      updateSpecSection(spec, 'derived_outputs', u);
    }
  });

  // 保存规格
  await saveSpec(update.specPath, spec);
}

/**
 * 确保 Git 工作区干净（使用 spawnSync 避免命令注入）
 */
function ensureCleanWorkingTree() {
  const result = spawnSync('git', ['diff-index', '--quiet', 'HEAD', '--'], {
    encoding: 'utf8',
    cwd: process.cwd()
  });

  if (result.status !== 0) {
    console.error('❌ Git 工作区不干净，请先提交更改');
    console.error('   运行: git status 查看未提交更改');
    process.exit(4);
  }
}

module.exports = { syncBidirectional };
```

### 更新建议生成器 (update-proposer.js)

```javascript
/**
 * 生成规格更新建议
 */
function proposeSpecUpdate(spec, codeChanges) {
  const proposals = [];

  // 分析代码变更类型
  codeChanges.forEach(change => {
    switch (change.type) {
      case 'function_signature_changed':
        proposals.push(proposeFunctionSignatureUpdate(spec, change));
        break;

      case 'new_function_added':
        proposals.push(proposeNewFunctionSection(spec, change));
        break;

      case 'function_removed':
        proposals.push(proposeFunctionDeletion(spec, change));
        break;

      case 'parameter_added':
        proposals.push(proposeParameterUpdate(spec, change));
        break;

      case 'return_type_changed':
        proposals.push(proposeReturnTypeUpdate(spec, change));
        break;
    }
  });

  return {
    proposals,
    affectedSections: extractAffectedSections(proposals),
    riskLevel: calculateRiskLevel(proposals)
  };
}

/**
 * 建议函数签名更新
 */
function proposeFunctionSignatureUpdate(spec, change) {
  const oldSignature = extractFunctionSignature(spec, change.functionName);
  const newSignature = change.newSignature;

  return {
    type: 'signature_update',
    section: 'derived_outputs',
    function: change.functionName,
    change: {
      before: oldSignature,
      after: newSignature,
      diff: generateSignatureDiff(oldSignature, newSignature)
    },
    reason: '代码中函数签名已变更',
    risk: 'medium',  // 签名变更可能影响下游调用
    autoApplicable: false  // 需要用户确认
  };
}

/**
 * 计算风险等级
 */
function calculateRiskLevel(proposals) {
  const hasHighRisk = proposals.some(p => p.risk === 'high');
  const hasMediumRisk = proposals.some(p => p.risk === 'medium');

  if (hasHighRisk) return 'high';
  if (hasMediumRisk) return 'medium';
  return 'low';
}

module.exports = { proposeSpecUpdate };
```

---

## CLI 使用示例

```bash
# 基本用法: 双向同步（默认）
/mob-seed:defend

# 明确指定双向同步
/mob-seed:defend --sync-direction=bidirectional

# 只检查代码是否符合规格（单向）
/mob-seed:defend --sync-direction=spec

# 只检测代码变更并建议更新规格
/mob-seed:defend --sync-direction=code

# 非交互式（自动接受所有建议）
/mob-seed:defend --sync-direction=code --no-interactive

# 预览模式（不应用更新）
/mob-seed:defend --sync-direction=code --dry-run

# 增量模式（只处理自上次同步以来的变更）
/mob-seed:defend --incremental

# 回滚上次更新
/mob-seed:defend --rollback

# Git Hook 集成（pre-commit）
/mob-seed:defend --mode=pre-commit --sync-direction=bidirectional
```

---

## 派生产物 (Derived Outputs)

> **路径规范**: 所有路径必须遵循 `.seed/config.json` 中的 `paths` 配置。

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/defend/bidirectional-sync.js | 双向同步引擎 |
| 代码 | skills/mob-seed/lib/defend/code-to-spec.js | 代码→规格同步 |
| 代码 | skills/mob-seed/lib/defend/drift-detector.js | 偏离检测器 |
| 代码 | skills/mob-seed/lib/defend/update-proposer.js | 更新建议生成 |
| 代码 | skills/mob-seed/lib/defend/conflict-resolver.js | 冲突解决 |
| 代码 | skills/mob-seed/lib/cli/defend.js | CLI 入口（扩展） |
| 测试 | skills/mob-seed/test/defend/bidirectional-sync.test.js | 双向同步测试 |
| 测试 | skills/mob-seed/test/defend/drift-detector.test.js | 偏离检测测试 |
| 测试 | skills/mob-seed/test/defend/update-proposer.test.js | 建议生成测试 |
| 文档 | commands/defend.md | 命令文档（扩展） |

---

## 依赖 (Dependencies)

### 前置规格

- `spec-extract.fspec.md` - 代码解析能力
- `reverse-engineer-ast.fspec.md` - AST 工具
- 现有 `lib/defend/*` 模块

### 外部依赖

- `@babel/parser` - AST 解析
- `@babel/traverse` - AST 遍历
- `diff` - Diff 算法
- `inquirer` (可选) - 交互式 CLI

---

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.0 | 2026-01-03 | 初始版本，完成架构决策和技术设计 | Claude |
