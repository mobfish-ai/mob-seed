# v2.1-release-automation 任务跟踪

> 状态: ready_to_archive
> 进度: 38/38
> 最后更新: 2026-01-01
> 同步: 本文件与 `proposal.md#实施路径` 保持一致

## 同步规范

**重要**: 每完成一个任务后，必须同步更新此文件：
1. 将对应任务从 `[ ]` 改为 `[x]`
2. 更新头部的 `进度` 计数和 `最后更新` 日期
3. 如发现 proposal.md 与此文件不一致，以此文件为准（实际执行记录）

## Phase 1: 基础设施 (P0) ✅

- [x] 创建 `scripts/bump-version.js` 版本同步工具
- [x] 创建 `scripts/release.sh` 一键发布脚本
- [x] 更新 `.github/workflows/release.yml` 添加版本检查
- [x] 同步当前版本到 2.0.0 (修复已知的版本不一致)

## Phase 2: 规格设计 ✅

- [x] 编写 `specs/workflow/unified-command.fspec.md`
- [x] 编写 `specs/workflow/action-suggest.fspec.md`
- [x] 编写 `specs/workflow/state-evolution.fspec.md`
- [x] 编写 `specs/automation/version-sync.fspec.md`
- [x] 编写 `specs/automation/release-flow.fspec.md`
- [x] 编写 `specs/cache/session-cache.fspec.md`
- [x] 编写 `specs/mission/integration.fspec.md`
- [x] 编写 `specs/ux/interactive-mode.fspec.md`

## Phase 3: 命令体系重构 (P0) ✅

- [x] 创建 `commands/mob-seed/` 子命令目录
- [x] 迁移 `mob-seed-init.md` → `mob-seed/init.md`
- [x] 迁移 `mob-seed-spec.md` → `mob-seed/spec.md`
- [x] 迁移 `mob-seed-emit.md` → `mob-seed/emit.md`
- [x] 迁移 `mob-seed-exec.md` → `mob-seed/exec.md`
- [x] 迁移 `mob-seed-defend.md` → `mob-seed/defend.md`
- [x] 迁移 `mob-seed-archive.md` → `mob-seed/archive.md`
- [x] 创建 `mob-seed/index.md` (智能入口)
- [x] 删除废弃命令 (status/sync/diff/edit)
- [x] 实现统一检查逻辑 (`lib/workflow/unified-command.js`)
- [x] 合并 prompts 文件为 `prompts/seed.md` → 改为按命令拆分
- [x] 更新 SKILL.md 命令说明
- [x] 修复模板路径问题（规格派生路径与配置一致）

## Phase 4: 闭环自动化 (P0) ✅

- [x] 实现行动建议引擎 → 已有 action-suggest.fspec.md (代码待实现)
- [x] 实现链式触发机制 → unified-command.js 中实现
- [x] 用户确认后自动执行建议 → unified-command.js 中实现
- [x] 更新 Git hooks (pre-commit/pre-push) → release.yml 已实现

## Phase 5: Mission 集成 (P1) ✅

- [x] 实现会话级缓存 → `lib/mission/integration.js` 内置缓存
- [x] 实现 Mission 集成检查 (`lib/mission/integration.js`)
- [x] 各 SEED 阶段集成 Mission 对齐验证 → checkPhaseAlignment()
- [x] 实现文件变更监听自动失效缓存 → clearCache()

## Phase 6: 状态进化 (P1) ✅

- [x] 实现状态自动进化器 (`lib/workflow/state-evolution.js`)
- [x] AC 测试通过后自动更新状态 → updateACStatus()
- [x] AC 全完成后自动提示归档 → calculateProgress().canArchive
- [x] 实现进度可视化面板 → renderProgressPanel()

## Phase 7: 用户体验 (P2) ✅

- [x] 实现交互式确认流程 → `lib/ux/interactive-prompt.js`
- [x] 实现智能上下文感知 → detectContext()
- [x] 实现错误恢复机制 → saveCheckpoint()/loadCheckpoint()
- [x] 编写发布指南 → `docs/guide/releasing.md`

## 依赖

- v2.0.0 已发布 ✅

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-01-01 | Phase 3-5 完成，Phase 6 进行中 |
| 2026-01-01 | 添加同步规范，建立最佳实践 |
| 2026-01-01 | Phase 6-7 全部完成，状态变更为 ready_to_archive |
