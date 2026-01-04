---
status: archived
archived: 2026-01-03
version: 1.0.0
created: 2026-01-03
updated: 2026-01-03
模板: feature
层级: L4 (强)
---
# ACE Hooks 保障层规格
## 概述 (Overview)

### 功能描述
创建 Git hooks 脚本，在 commit 和 push 时检查 ACE 状态，确保重要观察不被忽略。

### 目标用户
所有使用 mob-seed 的开发者

### 核心价值
- pre-commit: 提醒未处理的重要观察
- pre-push: 检查是否达到反思阈值
- 程序化保障 ACE 流程执行

### 使用场景
- 场景1: 开发者 commit 时有未处理观察，显示警告但允许继续
- 场景2: 开发者 push 时达到反思阈值，建议先进行反思

---

## 需求 (Requirements)

### 功能需求 (Functional Requirements)

- [x] FR-001: 创建 pre-commit hook 脚本
- [x] FR-002: 创建 pre-push hook 脚本
- [x] FR-003: pre-commit 检查 `.seed/observations/` 中的 raw 状态观察数量
- [x] FR-004: pre-push 检查是否达到反思阈值（same_type >= 3）
- [x] FR-005: hooks 模板在 `/mob-seed:init` 时安装到 `.git/hooks/`

### 非功能需求 (Non-Functional Requirements)

- [x] NFR-001: 非阻塞 - hooks 只警告，不阻止操作
- [x] NFR-002: 快速 - hooks 执行时间 < 1 秒
- [x] NFR-003: 可选 - 用户可以通过 `--no-verify` 跳过

---

## 约束 (Constraints)

### 技术约束
- 语言: Shell (bash)
- 位置: hooks/pre-commit, hooks/pre-push
- 安装: 由 init.md 复制到 .git/hooks/

### 业务约束
- 不能阻止正常的 git 操作
- 警告信息简洁明了

---

## 验收标准 (Acceptance Criteria)

### AC-001: pre-commit hook 检查观察状态
- **Given**: `.seed/observations/` 中有 raw 状态观察
- **When**: 执行 `git commit`
- **Then**:
  - 输出 `⚠️ ACE: {N} 条待处理观察`
  - 允许 commit 继续

### AC-002: pre-push hook 检查反思阈值
- **Given**: 同类型观察 >= 3 个
- **When**: 执行 `git push`
- **Then**:
  - 输出 `⚠️ ACE: 建议先进行反思分析`
  - 输出相关观察列表
  - 允许 push 继续

### AC-003: init 安装 hooks
- **Given**: 项目未初始化
- **When**: 运行 `/mob-seed:init`
- **Then**:
  - `.git/hooks/pre-commit` 存在
  - `.git/hooks/pre-push` 存在
  - hooks 有执行权限

### AC-004: hooks 不阻塞操作
- **Given**: hooks 检测到问题
- **When**: 用户继续操作
- **Then**:
  - hooks 返回 0（成功）
  - 操作正常完成

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 脚本 | hooks/ace-pre-commit | pre-commit hook 模板 |
| 脚本 | hooks/ace-pre-push | pre-push hook 模板 |
| 命令 | commands/init.md | 添加 hooks 安装步骤 |

---

## 依赖 (Dependencies)

### 前置规格
- ace-skill-integration.fspec.md (L1)

### 外部依赖
- git (版本 >= 2.0)

---

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.0 | 2026-01-03 | 初始版本 | Claude + User |
