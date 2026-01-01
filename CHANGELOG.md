# Changelog

本项目遵循 [Semantic Versioning](https://semver.org/) 语义化版本规范。

## [Unreleased]

---

## [2.1.0] - 2026-01-01

### ⚠️ Breaking Changes
- **命令系统重构**: 统一为子命令模式 (`/mob-seed:*`)
  - `/mob-seed-spec` → `/mob-seed:spec`
  - `/mob-seed-emit` → `/mob-seed:emit`
  - `/mob-seed-exec` → `/mob-seed:exec`
  - `/mob-seed-defend` → `/mob-seed:defend`
  - `/mob-seed-init` → `/mob-seed:init`
  - `/mob-seed-archive` → `/mob-seed:archive`
  - 移除: `/mob-seed-status`, `/mob-seed-diff`, `/mob-seed-sync`, `/mob-seed-edit`

### Added

**新增核心模块**
- `lib/mission/integration.js` - Mission 集成模块 (333 行测试)
- `lib/ux/interactive-prompt.js` - 交互式提示模块 (248 行测试)
- `lib/ux/progress-panel.js` - 进度面板模块 (113 行测试)
- `lib/workflow/state-evolution.js` - 状态演进模块 (300 行测试)
- `lib/workflow/unified-command.js` - 统一命令模块 (386 行测试)

**新增规格文件 (Phase 2)**
- `openspec/specs/automation/release-flow.fspec.md` - 发布流程规格
- `openspec/specs/automation/version-sync.fspec.md` - 版本同步规格
- `openspec/specs/cache/session-cache.fspec.md` - 会话缓存规格
- `openspec/specs/mission/integration.fspec.md` - Mission 集成规格
- `openspec/specs/ux/interactive-mode.fspec.md` - 交互模式规格
- `openspec/specs/workflow/action-suggest.fspec.md` - 操作建议规格
- `openspec/specs/workflow/state-evolution.fspec.md` - 状态演进规格
- `openspec/specs/workflow/unified-command.fspec.md` - 统一命令规格

**发布自动化**
- `scripts/bump-version.js` - 版本号同步脚本 (334 行)
- `scripts/release.sh` - 发布流程脚本 (345 行)
- `scripts/check-proposal-tasks-sync.js` - 提案任务同步检查
- `.github/workflows/release.yml` - GitHub Release 工作流

**文档**
- `docs/guide/releasing.md` - 发布指南文档

### Changed
- 命令文件添加 `name:` 字段到 frontmatter（符合 Claude Code 插件规范）
- 修正 SEED 派生范围：从仅 API 文档扩展到全部文档类型
- Mission Statement 模块：使用正确的 parseMissionCore 函数
- 重构 openspec/AGENTS.md 和 CODEBASE_SPEC.md

### Fixed
- 修复年份引用：2025 → 2026
- 修复命令文件缺少 `name:` 字段问题
- 修复 Mission 模块 parseACE 别名保持向后兼容

### Removed
- 移除旧命令文件: `mob-seed-status.md`, `mob-seed-diff.md`, `mob-seed-sync.md`, `mob-seed-edit.md`, `mob-seed.md`

### Tests
- 494 tests passed (新增约 1380 行测试代码)

---

## [2.0.0] - 2026-01-01

### Added

**核心模块** (11 个)
- `lib/router/complexity-router.js` - 复杂度路由，自动判断任务规模
- `lib/sync/task-sync.js` - 任务同步，规格与 tasks.md 双向同步
- `lib/workflow/flow-router.js` - 流程路由，根据前置条件选择流程
- `lib/workflow/pre-impl-confirmation.js` - 实现前确认，防止误操作
- `lib/quality/fspec-linter.js` - 规格检查器，验证 fspec 语法
- `lib/quality/phase-gate.js` - 阶段门禁，确保流程顺序
- `lib/quality/debug-protocol.js` - 调试协议，结构化问题诊断
- `lib/ops/metrics.js` - 度量收集，统计派生效果
- `lib/ops/cancellation.js` - 取消机制，支持中断长任务
- `lib/ops/change-handler.js` - 变更处理，规格变更时自动触发
- `lib/automation/scenario-test-mapper.js` - 场景测试映射器

**OpenSpec 架构**
- `openspec/specs/` - 稳定规格目录（真相源）
- `openspec/changes/` - 进行中的变更提案
- `openspec/archive/` - 已完成的历史归档
- Delta 语法支持 (ADDED/MODIFIED/REMOVED/CLARIFIED)
- 生命周期管理 (draft → review → implementing → archived)

**Mission Statement**
- `.seed/mission.md` - 项目使命声明
- 定义项目目的、原则和反目标，用于指导 AI 辅助开发决策

**Git Hooks 自动化**
- `.seed/hooks/pre-commit` - 提交前快速检查
- `.seed/hooks/pre-push` - 推送前增量检查
- `.seed/scripts/check-cache.js` - 检查缓存
- `.seed/scripts/quick-defend.js` - 快速同步检查
- `.seed/scripts/incremental-defend.js` - 增量检查
- `.seed/scripts/update-cache.js` - 更新缓存

**文档体系**
- `docs/api/` - 17 个模块 API 文档
- `docs/guide/getting-started.md` - 快速开始指南
- `docs/guide/writing-specs.md` - 规格编写指南
- `docs/concepts/seed-methodology.md` - SEED 方法论
- `docs/concepts/openspec-lifecycle.md` - OpenSpec 生命周期

### Changed
- 完全移除 `--legacy` 和 `--migrate` 模式，仅支持 OpenSpec
- 重构命令系统为统一入口 `/mob-seed`
- 配置文件从 YAML 改为 JSON (`.seed/config.json`)

### Fixed
- 修复空壳生成问题，改为 Claude 提示模式
- 修复 ES Module 与 CJS 兼容性问题
- 修复配置路径解析问题

### Deprecated
- 移除 `mixins/` 目录（迁移到 OpenSpec）
- 移除 `agents/` 目录（重构为 workflow 模块）

---

## [1.2.0] - 2025-12-15

### Added
- 逆向同步功能：从代码生成规格 (`/mob-seed-sync`)
- GitHub Actions CI/CD 工作流
- 发布工作流自动化

---

## [1.1.0] - 2025-12-10

### Added
- 测试框架集成 (Node.js test runner)
- `package.json` 项目配置
- `install.sh` 手动安装脚本
- 插件市场支持 (Claude Plugins Official)

### Changed
- 移除 `--legacy` 模式，仅支持 OpenSpec
- 更新安装说明为插件市场两步安装方式

### Fixed
- 修复 `plugin.json` 路径和邮箱配置
- 修复插件市场 schema 格式

---

## [1.0.0] - 2025-12-01

### Added
- 初始版本发布
- SEED 方法论核心实现
  - Spec (规格) - `.fspec.md` 规格文件格式
  - Emit (派生) - 代码/测试/文档自动生成
  - Execute (执行) - 测试运行与 AC 更新
  - Defend (守护) - 同步状态检查
- 基础命令
  - `/mob-seed` - 统一入口
  - `/mob-seed-init` - 项目初始化
  - `/mob-seed-spec` - 规格管理
  - `/mob-seed-emit` - 派生生成
  - `/mob-seed-exec` - 测试执行
  - `/mob-seed-defend` - 同步守护
  - `/mob-seed-status` - 状态查看
- Hello World 示例项目

---

[Unreleased]: https://github.com/mobfish-ai/mob-seed/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/mobfish-ai/mob-seed/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/mobfish-ai/mob-seed/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/mobfish-ai/mob-seed/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/mobfish-ai/mob-seed/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mobfish-ai/mob-seed/releases/tag/v1.0.0
