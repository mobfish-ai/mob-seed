---
id: scripts-consolidation
version: 1.0.0
status: archived
created: 2026-01-04
updated: 2026-01-04
archived: 2026-01-04
---

# 脚本整合规格 (Scripts Consolidation)

## 概述 (Overview)

将分散在项目各处的工具脚本和 hooks 模板整合到 `skills/mob-seed/` 发布目录中，使用户项目可以使用这些工具。

## 动机 (Motivation)

### 问题

1. **脚本分散**: 工具脚本分布在 `.seed/scripts/`、`scripts/`、`hooks/` 等多个位置
2. **未发布**: 大部分工具未纳入 `skills/mob-seed/` 发布目录，用户无法使用
3. **职责不清**: 内部开发工具与用户工具混在一起

### 现状

| 位置 | 文件数 | 发布状态 | 用途 |
|------|--------|----------|------|
| `.seed/scripts/` | 4 | 未发布 | Git Hooks 检查脚本 |
| `.seed/hooks/` | 2 | 未发布 | SEED hook 模板 |
| `hooks/` | 2 | 未发布 | ACE hook 模板 |
| `scripts/` | 9 | 未发布 | 混合（工具 + 内部） |
| `skills/mob-seed/scripts/` | 7 | 已发布 | 用户工具 |

## 功能需求 (Functional Requirements)

### FR-001: 验证工具整合

**描述**: 将所有验证工具迁移到 `skills/mob-seed/scripts/`。

**待迁移文件**:

| 源文件 | 目标文件 | 说明 |
|--------|----------|------|
| `scripts/verify-archive.js` | `skills/mob-seed/scripts/verify-archive.js` | 归档完整性验证 |
| `scripts/verify-seed-sync.js` | `skills/mob-seed/scripts/verify-seed-sync.js` | SEED 同步验证 |
| `scripts/verify-docs.js` | `skills/mob-seed/scripts/verify-docs.js` | 文档验证 |
| `scripts/verify-task-progress.js` | `skills/mob-seed/scripts/verify-task-progress.js` | 任务进度验证 |
| `scripts/verify-architecture-decisions.js` | `skills/mob-seed/scripts/verify-architecture-decisions.js` | 架构决策验证 |
| `scripts/reverse-engineer.js` | `skills/mob-seed/scripts/reverse-engineer.js` | Brownfield 逆向工程 |

**验收标准**:
- [x] AC-001: 所有验证工具存在于 `skills/mob-seed/scripts/`
- [x] AC-002: 每个工具可独立执行 (`node script.js --help`)
- [x] AC-003: 工具路径在命令文档中正确引用

### FR-002: Hooks 模板整合

**描述**: 将所有 Git hooks 模板整合到 `skills/mob-seed/hooks/`。

**待整合文件**:

| 源文件 | 目标文件 | 说明 |
|--------|----------|------|
| `.seed/hooks/pre-commit` | `skills/mob-seed/hooks/pre-commit` | SEED pre-commit |
| `.seed/hooks/pre-push` | `skills/mob-seed/hooks/pre-push` | SEED pre-push |
| `hooks/ace-pre-commit` | `skills/mob-seed/hooks/ace-pre-commit` | ACE pre-commit |
| `hooks/ace-pre-push` | `skills/mob-seed/hooks/ace-pre-push` | ACE pre-push |

**验收标准**:
- [x] AC-001: 创建 `skills/mob-seed/hooks/` 目录
- [x] AC-002: 所有 hook 模板存在于该目录
- [x] AC-003: hook 模板有正确的执行权限 (755)
- [x] AC-004: hook 模板引用的脚本路径正确

### FR-003: 内部工具分离

**描述**: 保留内部开发工具在 `scripts/` 目录，不发布。

**内部工具（不迁移）**:

| 文件 | 用途 | 原因 |
|------|------|------|
| `scripts/bump-version.js` | 版本号同步 | 仅 mob-seed 开发使用 |
| `scripts/release.sh` | 发布流程 | 仅 mob-seed 开发使用 |
| `scripts/check-proposal-tasks-sync.js` | 提案任务检查 | 仅 mob-seed 开发使用 |

**验收标准**:
- [x] AC-001: 内部工具保留在 `scripts/` 目录
- [x] AC-002: 内部工具不出现在 `skills/mob-seed/scripts/`
- [x] AC-003: `scripts/README.md` 说明这些是内部工具

### FR-004: 目录清理

**描述**: 迁移完成后清理源目录。

**清理操作**:

| 操作 | 目录 | 说明 |
|------|------|------|
| 删除 | `.seed/scripts/` | 内容已迁移到 lib/ |
| 删除 | `.seed/hooks/` | 内容已迁移到 hooks/ |
| 删除 | `hooks/` | 内容已迁移到 skills/mob-seed/hooks/ |
| 保留 | `scripts/` | 只保留内部工具 |

**验收标准**:
- [x] AC-001: `.seed/scripts/` 目录不存在（或为符号链接）
- [x] AC-002: `.seed/hooks/` 目录不存在（或为符号链接）
- [x] AC-003: `hooks/` 目录不存在
- [x] AC-004: `scripts/` 只包含内部工具

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 脚本 | `skills/mob-seed/scripts/verify-*.js` | 验证工具 |
| 脚本 | `skills/mob-seed/scripts/reverse-engineer.js` | Brownfield 工具 |
| Hooks | `skills/mob-seed/hooks/pre-*` | Git Hook 模板 |
| Hooks | `skills/mob-seed/hooks/ace-pre-*` | ACE Hook 模板 |
| 文档 | `scripts/README.md` | 内部工具说明 |

## 依赖关系 (Dependencies)

- 依赖 `architecture-refactor.fspec.md` 中的分层库结构（hooks 逻辑调用 lib/hooks/）
- 被 `dogfooding.fspec.md` 依赖（建立符号链接前需先完成整合）

## 测试策略 (Testing Strategy)

### 单元测试

| 测试文件 | 覆盖范围 |
|----------|----------|
| `test/scripts/verify-archive.test.js` | verify-archive.js |
| `test/scripts/reverse-engineer.test.js` | reverse-engineer.js |

### 集成测试

| 测试场景 | 验证内容 |
|----------|----------|
| Hook 安装 | hooks 可正确安装到 .git/hooks/ |
| Hook 执行 | hooks 可正确调用验证脚本 |
| 路径解析 | 三层回退正确工作 |

## 风险与缓解 (Risks and Mitigations)

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 路径引用错误 | 中 | 高 | 迁移后运行完整测试 |
| 权限问题 | 低 | 中 | 明确设置 755 权限 |
| 遗漏文件 | 中 | 中 | 使用检查清单验证 |
