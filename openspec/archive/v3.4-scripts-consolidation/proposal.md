---
status: archived
created: 2026-01-04
updated: 2026-01-04
archived: 2026-01-04
version: 3.4.0
---

# v3.4 Scripts Consolidation - 脚本整合与架构修正完成

## 动机 (Motivation)

### 问题：v3.3 架构修正未实现

v3.3 Brownfield Support 发布时，**提案中的架构修正部分被完全遗漏**：

| v3.3 规划 | 实际状态 | 影响 |
|-----------|----------|------|
| 脚本移动到分层结构 | ❌ 未实现 | 用户无法使用 |
| defend 命令扩展 | ❌ 未实现 | 功能缺失 |
| 库/CLI 分离 | ❌ 未实现 | 无法程序化调用 |
| Git Hooks 三层回退 | ❌ 未实现 | hooks 失效 |
| 文档更新 | ❌ 未实现 | 文档与实际不符 |
| 测试覆盖 | ❌ 未实现 | 无质量保障 |

### 问题：更多遗漏发现

深度挖掘发现项目中还有大量工具未纳入发布产品：

| 来源 | 文件 | 用途 | 发布状态 |
|------|------|------|----------|
| `.seed/scripts/` | 4 个 js 文件 | Git Hooks 检查 | ❌ 未发布 |
| `.seed/hooks/` | pre-commit, pre-push | Hook 模板 | ❌ 未发布 |
| `hooks/` | ace-pre-commit, ace-pre-push | ACE Hook 模板 | ❌ 未发布 |
| `scripts/` | verify-*.js (5个) | 验证工具 | ❌ 未发布 |
| `scripts/` | reverse-engineer.js | Brownfield 工具 | ❌ 未发布 |

### 根因分析

1. **规格与实现脱节**：v3.3 规格写得很详细，但执行时跳过了架构修正阶段
2. **缺乏 defend 验证**：归档前未运行完整验证，遗漏未被发现
3. **目录职责不清**：项目内部工具与发布产品混在一起

## 目标 (Goals)

1. **完成 v3.3 遗漏的架构修正**（复用已有规格）
2. **整合所有应发布的工具**（脚本、hooks、verify 工具）
3. **建立 dogfooding 机制**（符号链接，单一真相源）
4. **验证安装流程**（在 mars-nexus 测试）

## Delta（变更内容）

### 1. 复用 v3.3 架构修正规格

直接引用 `openspec/specs/core/architecture-refactor.fspec.md`，完整实现其中的：

- FR-001: 分层目录结构（validation/, cache/, hooks/, cli/）
- FR-002: defend 命令扩展（--quick, --incremental, --cached）
- FR-003: 库/CLI 分离
- FR-004: 规格派生路径更新
- FR-005: 命令文档示例更新
- FR-006: Git Hooks 三层回退策略
- FR-007: 按风险分级的测试

### 2. 整合遗漏的工具

#### 2.1 Git Hooks 模板

```diff
+ skills/mob-seed/hooks/           # 新增目录
+   ├── pre-commit                 # SEED pre-commit 模板
+   ├── pre-push                   # SEED pre-push 模板
+   ├── ace-pre-commit             # ACE pre-commit 模板
+   └── ace-pre-push               # ACE pre-push 模板
```

#### 2.2 验证工具

```diff
+ skills/mob-seed/scripts/
+   ├── verify-archive.js          # 归档验证
+   ├── verify-seed-sync.js        # SEED 同步验证
+   ├── verify-docs.js             # 文档验证
+   ├── verify-task-progress.js    # 任务进度验证
+   └── verify-architecture-decisions.js  # 架构决策验证
```

### 3. Dogfooding 机制

mob-seed 项目自身使用符号链接指向发布产品：

```
mob-seed/
├── scripts/                       # 内部开发工具（不发布）
│   ├── bump-version.js
│   ├── release.sh
│   └── check-proposal-tasks-sync.js
│
├── skills/mob-seed/               # 发布产品（唯一真相源）
│   ├── lib/                       # 分层库
│   │   ├── validation/
│   │   ├── cache/
│   │   ├── hooks/
│   │   └── cli/
│   ├── scripts/                   # 用户工具
│   └── hooks/                     # Hook 模板
│
└── .seed/                         # dogfooding
    ├── config.json
    ├── scripts → ../skills/mob-seed/scripts  # 符号链接
    └── hooks → ../skills/mob-seed/hooks      # 符号链接
```

### 3.5 运行场景区分（新增）

SEED Git Hooks 支持五种运行场景，通过四层回退策略自动检测：

| 场景 | 代号 | 颜色标识 | 描述 | 脚本来源路径 |
|------|------|----------|------|--------------|
| **开发模式** | `dogfooding` | 青色 `[开发模式]` | mob-seed 项目自身开发 | `skills/mob-seed/lib/hooks/` |
| **用户项目（环境变量）** | `user-env` | 洋红 `[用户项目]` | init 时设置 SEED_PLUGIN_PATH | `$SEED_PLUGIN_PATH/lib/hooks/` |
| **用户项目（插件路径）** | `user-plugin` | 洋红 `[用户项目]` | Claude Code 插件默认路径 | `~/.claude/plugins/.../lib/hooks/` |
| **兼容模式** | `compat` | 黄色 `[兼容模式]` | 旧版本符号链接 | `.seed/scripts/` |
| **脚本缺失** | `missing` | 红色 `[错误]` | 找不到验证脚本 | 无 |

#### 场景检测模块

新增 `lib/hooks/scenario.js` 提供统一的场景检测逻辑：
- `detectScenario()`: 检测当前运行场景
- `formatLabel()`: 格式化场景标签（带颜色）
- `isDevelopment()`: 判断是否开发模式
- `isUserProject()`: 判断是否用户项目

#### 日志输出示例

```
# 开发模式
🔍 SEED 快速检查... [开发模式] mob-seed dogfooding
✅ SEED 快速检查通过

# 用户项目
🔍 SEED 快速检查... [用户项目] Claude Code 插件
✅ SEED 快速检查通过

# 错误模式
🔍 SEED 快速检查... [错误] 未找到验证脚本
⚠️  请确认 mob-seed 插件已正确安装
```

#### 场景区分涉及的模块

| 模块 | 修改内容 |
|------|----------|
| `lib/hooks/scenario.js` | 新增 - 统一场景检测 |
| `hooks/pre-commit` | 添加场景标识输出 |
| `hooks/pre-push` | 添加场景标识输出 |
| `lib/hooks/quick-defender.js` | 集成场景检测 |
| `lib/hooks/incremental-defender.js` | 集成场景检测 |
| `hooks/README.md` | 完整场景文档 |

### 4. 安装流程验证

采用渐进式验证策略，从轻量级测试项目到真实项目：

#### 4.1 轻量级测试项目（首次验证）

```bash
# 创建测试项目
mkdir test-seed-install && cd test-seed-install
git init

# 测试 greenfield 场景
/mob-seed:init

# 验证安装结果
ls -la .seed/
ls -la .git/hooks/
/mob-seed:defend --quick
```

#### 4.2 Brownfield 测试（有代码场景）

```bash
# 在测试项目中添加示例代码
echo "console.log('hello')" > index.js
git add . && git commit -m "init"

# 测试逆向工程
/mob-seed:spec reverse-engineer

# 验证 Git Hooks 触发
git add . && git commit -m "test"  # 触发 pre-commit
```

#### 4.3 Mars-nexus（最终验证）

在真实项目中验证，确保不干扰现有功能：

```bash
cd mars-nexus

# 初始化（如果已有 .seed/ 会提示）
/mob-seed:init

# 验证与现有代码兼容
/mob-seed:defend --quick
```

**测试项目清理**：验证完成后删除测试项目 `rm -rf test-seed-install`

## 规格清单

### 引用规格（已有）

| 规格文件 | 状态 | 说明 |
|----------|------|------|
| `core/architecture-refactor.fspec.md` | archived | v3.3 详细规格，需完整实现 |

### 新增规格

| 规格文件 | 状态 | 说明 |
|----------|------|------|
| `core/scripts-consolidation.fspec.md` | draft | 脚本整合规格 |
| `core/dogfooding.fspec.md` | draft | Dogfooding 机制规格 |
| `automation/init-hooks.fspec.md` | draft | Init 命令 hooks 安装规格 |

## 实施计划

### Phase 0: 清理和准备（0.5 天）

1. 撤销之前的临时复制（我在本会话中做的）
2. 清理重复文件
3. 确定最终目录结构

### Phase 1: 分层库实现（1 天）

1. 创建 `lib/validation/`, `lib/cache/`, `lib/hooks/`, `lib/cli/` 目录
2. 重构 `.seed/scripts/*.js` 为分层结构
3. 实现库函数接口（Zod 验证）
4. 实现 CLI 包装

### Phase 2: 工具整合（0.5 天）

1. 迁移 `verify-*.js` 到 `skills/mob-seed/scripts/`
2. 迁移 hooks 模板到 `skills/mob-seed/hooks/`
3. 更新命令文档引用

### Phase 3: Dogfooding 建立（0.5 天）

1. 删除 `.seed/scripts/`、`.seed/hooks/` 目录
2. 创建符号链接指向 `skills/mob-seed/`
3. 验证本项目功能正常

### Phase 4: 命令扩展（0.5 天）

1. 扩展 defend 命令（--quick, --incremental, --cached）
2. 更新 init 命令（自动安装 hooks）
3. 更新命令文档

### Phase 5: 测试实现（1 天）

1. 按风险分级实现测试
2. 集成测试（三种调用方式）
3. 覆盖率验证

### Phase 6: 安装验证（0.5 天）

1. 在 mars-nexus 测试完整安装
2. 验证所有功能可用
3. 修复发现的问题

### Phase 7: 发布（0.5 天）

1. 更新 CHANGELOG
2. 更新版本号
3. 创建 tag 和 release

## 成功标准

### 架构修正（来自 v3.3 AC）

- [ ] AC-001: 文件移动并分层完成
- [ ] AC-002: 命令选项可用
- [ ] AC-003: 三种调用方式都可用
- [ ] AC-004: 规格派生路径正确
- [ ] AC-005: 文档示例更新
- [ ] AC-006: 向后兼容提示
- [ ] AC-007: Git Hooks 正常工作
- [ ] AC-008: 测试通过

### 脚本整合（新增）

- [ ] 所有验证工具在 `skills/mob-seed/scripts/`
- [ ] 所有 hooks 模板在 `skills/mob-seed/hooks/`
- [ ] 根目录 `scripts/` 只保留内部工具

### Dogfooding（新增）

- [x] `.seed/scripts/` 是符号链接
- [x] `.seed/hooks/` 是符号链接
- [ ] mob-seed 项目自身功能正常

### 场景区分（新增）

- [x] `lib/hooks/scenario.js` 场景检测模块已创建
- [x] `hooks/pre-commit` 显示场景标识
- [x] `hooks/pre-push` 显示场景标识
- [x] `lib/hooks/quick-defender.js` 集成场景检测
- [x] `lib/hooks/incremental-defender.js` 集成场景检测
- [x] `hooks/README.md` 包含完整场景文档
- [x] 开发模式验证通过（青色 [开发模式]）
- [ ] 用户项目验证通过（洋红 [用户项目]）

### 安装验证（新增）

- [ ] 轻量级测试项目可成功运行 `/mob-seed:init`
- [ ] Brownfield 测试项目验证逆向工程和 hooks
- [ ] mars-nexus 作为最终验证通过
- [ ] hooks 正确安装到 `.git/hooks/`
- [ ] `/mob-seed:defend --quick` 可用
- [ ] Git commit 触发 pre-commit 检查
- [ ] Git push 触发 pre-push 检查

### Claude Code 实际验证（新增）

- [ ] 在 Claude Code 中执行 `/mob-seed:init` 命令完整流程
- [ ] 验证命令输出符合预期
- [ ] 验证创建的文件结构正确
- [ ] 验证 hooks 脚本可执行
- [ ] 验证 `/mob-seed:defend` 系列命令可用

## 防止再次遗漏的机制

1. **任务清单强制检查**：tasks.md 中每个 AC 必须有对应测试
2. **归档前验证**：运行 `/mob-seed:defend` 检查规格与实现同步
3. **安装测试**：发布前在真实项目（mars-nexus）验证
4. **CLAUDE.md 教训记录**：新增教训 #18（规格必须完整实现）
