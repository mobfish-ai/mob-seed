# v2.1-release-automation 任务跟踪

> 状态: draft
> 进度: 0/38

## Phase 1: 基础设施 (P0)

- [ ] 创建 `scripts/bump-version.js` 版本同步工具
- [ ] 创建 `scripts/release.sh` 一键发布脚本
- [ ] 更新 `.github/workflows/release.yml` 添加版本检查
- [ ] 同步当前版本到 2.0.0 (修复已知的版本不一致)

## Phase 2: 规格设计

- [ ] 编写 `specs/workflow/unified-command.fspec.md`
- [ ] 编写 `specs/workflow/action-suggest.fspec.md`
- [ ] 编写 `specs/workflow/state-evolution.fspec.md`
- [ ] 编写 `specs/automation/version-sync.fspec.md`
- [ ] 编写 `specs/automation/release-flow.fspec.md`
- [ ] 编写 `specs/cache/session-cache.fspec.md`
- [ ] 编写 `specs/mission/integration.fspec.md`
- [ ] 编写 `specs/ux/interactive-mode.fspec.md`

## Phase 3: 命令体系重构 (P0)

- [ ] 创建 `commands/mob-seed/` 子命令目录
- [ ] 迁移 `mob-seed-init.md` → `mob-seed/init.md`
- [ ] 迁移 `mob-seed-spec.md` → `mob-seed/spec.md`
- [ ] 迁移 `mob-seed-emit.md` → `mob-seed/emit.md`
- [ ] 迁移 `mob-seed-exec.md` → `mob-seed/exec.md`
- [ ] 迁移 `mob-seed-defend.md` → `mob-seed/defend.md`
- [ ] 迁移 `mob-seed-archive.md` → `mob-seed/archive.md`
- [ ] 创建 `mob-seed/index.md` (智能入口)
- [ ] 删除废弃命令 (status/sync/diff/edit)
- [ ] 实现统一检查逻辑 (`lib/workflow/unified-command.js`)
- [ ] 合并 prompts 文件为 `prompts/seed.md`
- [ ] 更新 SKILL.md 命令说明

## Phase 4: 闭环自动化 (P0)

- [ ] 实现行动建议引擎 (`lib/workflow/action-suggest.js`)
- [ ] 实现链式触发机制
- [ ] 用户确认后自动执行建议
- [ ] 更新 Git hooks (pre-commit/pre-push)

## Phase 5: Mission 集成 (P1)

- [ ] 实现会话级缓存 (`lib/cache/session-cache.js`)
- [ ] 实现 Mission 集成检查 (`lib/mission/integration.js`)
- [ ] 各 SEED 阶段集成 Mission 对齐验证
- [ ] 实现文件变更监听自动失效缓存

## Phase 6: 状态进化 (P1)

- [ ] 实现状态自动进化器 (`lib/workflow/state-evolution.js`)
- [ ] AC 测试通过后自动更新状态
- [ ] AC 全完成后自动提示归档
- [ ] 实现进度可视化面板

## Phase 7: 用户体验 (P2)

- [ ] 实现交互式确认流程 (`lib/ux/interactive-prompt.js`)
- [ ] 实现智能上下文感知
- [ ] 实现错误恢复机制 (`--resume`)
- [ ] 编写发布指南 `docs/guide/releasing.md`

## 依赖

- v2.0.0 已发布 ✅
