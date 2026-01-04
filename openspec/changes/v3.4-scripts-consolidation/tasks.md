# v3.4 Scripts Consolidation - Tasks

## 进度概览

| 阶段 | 描述 | 状态 | 进度 |
|------|------|------|------|
| Phase 0 | 清理和准备 | pending | 0/3 |
| Phase 1 | 分层库实现 | pending | 0/8 |
| Phase 2 | 工具整合 | pending | 0/4 |
| Phase 3 | Dogfooding 建立 | pending | 0/4 |
| Phase 4 | 命令扩展 | pending | 0/4 |
| Phase 5 | 测试实现 | pending | 0/5 |
| Phase 6 | 安装验证（渐进式） | pending | 0/6 |
| Phase 7 | 发布 | pending | 0/3 |

**总体进度**: 0/37 (0%)

---

## Phase 0: 清理和准备

### T0.1 撤销临时复制
- [ ] AC-001: 移除之前会话中临时复制到 `skills/mob-seed/scripts/` 的脚本
- [ ] AC-002: 确保不影响现有功能

### T0.2 清理重复文件
- [ ] AC-001: 识别所有重复的脚本文件
- [ ] AC-002: 确定每个脚本的真相源位置

### T0.3 确定最终目录结构
- [ ] AC-001: 绘制完整的目标目录树
- [ ] AC-002: 标记每个文件的来源和去向

---

## Phase 1: 分层库实现

> **引用规格**: `openspec/specs/core/architecture-refactor.fspec.md` FR-001, FR-003

### T1.1 创建 lib/validation/ 目录
- [ ] AC-001: 创建 `skills/mob-seed/lib/validation/` 目录
- [ ] AC-002: 实现 `quick.js` - 快速验证逻辑（纯函数）
- [ ] AC-003: 实现 `incremental.js` - 增量验证逻辑（纯函数）
- [ ] AC-004: 实现 `full.js` - 完整验证逻辑（纯函数）
- [ ] AC-005: 导出 Zod schema 用于参数验证

### T1.2 创建 lib/cache/ 目录
- [ ] AC-001: 创建 `skills/mob-seed/lib/cache/` 目录
- [ ] AC-002: 实现 `validator.js` - 缓存有效性检查
- [ ] AC-003: 实现 `reader.js` - 缓存读取
- [ ] AC-004: 实现 `writer.js` - 缓存写入
- [ ] AC-005: 支持可配置的缓存路径

### T1.3 创建 lib/hooks/ 目录
- [ ] AC-001: 创建 `skills/mob-seed/lib/hooks/` 目录
- [ ] AC-002: 实现 `pre-commit.js` - pre-commit 检查逻辑
- [ ] AC-003: 实现 `pre-push.js` - pre-push 检查逻辑
- [ ] AC-004: 支持三层回退路径解析

### T1.4 创建 lib/cli/ 目录
- [ ] AC-001: 创建 `skills/mob-seed/lib/cli/` 目录
- [ ] AC-002: 实现 `validate-quick.js` - CLI 包装器
- [ ] AC-003: 实现 `validate-incremental.js` - CLI 包装器
- [ ] AC-004: 实现 `validate-cache.js` - CLI 包装器
- [ ] AC-005: 所有 CLI 都有 `--help` 支持

### T1.5 重构现有脚本
- [ ] AC-001: 将 `.seed/scripts/check-cache.js` 逻辑迁移到 lib/cache/
- [ ] AC-002: 将 `.seed/scripts/quick-defend.js` 逻辑迁移到 lib/validation/
- [ ] AC-003: 将 `.seed/scripts/incremental-defend.js` 逻辑迁移到 lib/validation/
- [ ] AC-004: 将 `.seed/scripts/update-cache.js` 逻辑迁移到 lib/cache/

### T1.6 实现库接口
- [ ] AC-001: 所有库函数接受 Zod 验证的参数
- [ ] AC-002: 所有库函数返回结构化结果对象
- [ ] AC-003: 导出 TypeScript 类型定义（JSDoc）

### T1.7 创建索引文件
- [ ] AC-001: `lib/validation/index.js` 导出所有验证函数
- [ ] AC-002: `lib/cache/index.js` 导出所有缓存函数
- [ ] AC-003: `lib/hooks/index.js` 导出所有 hooks 函数
- [ ] AC-004: `lib/cli/index.js` 导出所有 CLI 入口

### T1.8 添加分层库测试
- [ ] AC-001: `test/validation/*.test.js` 覆盖所有验证函数
- [ ] AC-002: `test/cache/*.test.js` 覆盖所有缓存函数
- [ ] AC-003: `test/hooks/*.test.js` 覆盖所有 hooks 函数
- [ ] AC-004: `test/cli/*.test.js` 覆盖所有 CLI 入口

---

## Phase 2: 工具整合

### T2.1 迁移验证工具
- [ ] AC-001: 迁移 `scripts/verify-archive.js` 到 `skills/mob-seed/scripts/`
- [ ] AC-002: 迁移 `scripts/verify-seed-sync.js` 到 `skills/mob-seed/scripts/`
- [ ] AC-003: 迁移 `scripts/verify-docs.js` 到 `skills/mob-seed/scripts/`
- [ ] AC-004: 迁移 `scripts/verify-task-progress.js` 到 `skills/mob-seed/scripts/`
- [ ] AC-005: 迁移 `scripts/verify-architecture-decisions.js` 到 `skills/mob-seed/scripts/`

### T2.2 迁移 Brownfield 工具
- [ ] AC-001: 迁移 `scripts/reverse-engineer.js` 到 `skills/mob-seed/scripts/`
- [ ] AC-002: 更新命令文档中对该工具的引用

### T2.3 迁移 Hooks 模板
- [ ] AC-001: 创建 `skills/mob-seed/hooks/` 目录
- [ ] AC-002: 迁移 `.seed/hooks/pre-commit` 到 `skills/mob-seed/hooks/`
- [ ] AC-003: 迁移 `.seed/hooks/pre-push` 到 `skills/mob-seed/hooks/`
- [ ] AC-004: 迁移 `hooks/ace-pre-commit` 到 `skills/mob-seed/hooks/`
- [ ] AC-005: 迁移 `hooks/ace-pre-push` 到 `skills/mob-seed/hooks/`

### T2.4 更新命令文档
- [ ] AC-001: 更新 `commands/init.md` 中的 hooks 安装路径
- [ ] AC-002: 更新 `commands/defend.md` 中的脚本引用
- [ ] AC-003: 确保所有路径与 `.seed/config.json` 一致

---

## Phase 3: Dogfooding 建立

### T3.1 清理 mob-seed 内部目录
- [ ] AC-001: 删除 `.seed/scripts/` 目录（内容已迁移）
- [ ] AC-002: 删除 `.seed/hooks/` 目录（内容已迁移）
- [ ] AC-003: 保留 `scripts/` 中的内部开发工具（bump-version.js, release.sh 等）

### T3.2 创建符号链接
- [ ] AC-001: 创建 `.seed/scripts` → `../skills/mob-seed/scripts` 符号链接
- [ ] AC-002: 创建 `.seed/hooks` → `../skills/mob-seed/hooks` 符号链接
- [ ] AC-003: 验证符号链接可正常访问

### T3.3 验证 dogfooding 功能
- [ ] AC-001: 运行 `/mob-seed:defend` 验证工作正常
- [ ] AC-002: 运行 Git hooks 验证触发正常
- [ ] AC-003: 验证所有验证脚本可执行

### T3.4 更新 .gitignore
- [ ] AC-001: 确保符号链接被正确追踪（不忽略）
- [ ] AC-002: 确保 `.seed/check-cache.json` 等缓存文件被忽略

---

## Phase 4: 命令扩展

> **引用规格**: `openspec/specs/core/architecture-refactor.fspec.md` FR-002

### T4.1 扩展 defend 命令
- [ ] AC-001: 添加 `--quick` 选项（调用 lib/validation/quick.js）
- [ ] AC-002: 添加 `--incremental` 选项（调用 lib/validation/incremental.js）
- [ ] AC-003: 添加 `--cached` 选项（使用 lib/cache/ 跳过未变更文件）
- [ ] AC-004: 更新 `commands/defend.md` 文档

### T4.2 扩展 init 命令
- [ ] AC-001: 自动安装 hooks 到 `.git/hooks/`
- [ ] AC-002: 支持 `--no-hooks` 选项跳过 hooks 安装
- [ ] AC-003: 更新 `commands/init.md` 文档

### T4.3 实现三层回退
- [ ] AC-001: 优先使用 config.json 中配置的路径
- [ ] AC-002: 回退到命令安装位置
- [ ] AC-003: 回退到库默认路径
- [ ] AC-004: 添加路径解析日志（--verbose 模式）

### T4.4 更新命令帮助
- [ ] AC-001: `/mob-seed:defend --help` 显示所有新选项
- [ ] AC-002: `/mob-seed:init --help` 显示 hooks 相关选项

---

## Phase 5: 测试实现

> **引用规格**: `openspec/specs/core/architecture-refactor.fspec.md` FR-007

### T5.1 高风险测试（立即）
- [ ] AC-001: 测试 pre-commit 在有问题文件时阻止提交
- [ ] AC-002: 测试 pre-push 在同步问题时阻止推送
- [ ] AC-003: 测试缓存失效时重新检查

### T5.2 中等风险测试（重要）
- [ ] AC-001: 测试 `--quick` 选项只检查 staged 文件
- [ ] AC-002: 测试 `--incremental` 选项检查所有未推送 commits
- [ ] AC-003: 测试三层路径回退正确工作

### T5.3 低风险测试（补充）
- [ ] AC-001: 测试 CLI `--help` 输出格式正确
- [ ] AC-002: 测试缓存文件格式版本兼容性
- [ ] AC-003: 测试无 SEED 项目的友好错误提示

### T5.4 集成测试
- [ ] AC-001: 测试库函数直接调用方式
- [ ] AC-002: 测试 CLI 脚本调用方式
- [ ] AC-003: 测试 Git Hooks 调用方式

### T5.5 覆盖率验证
- [ ] AC-001: 确保新增代码覆盖率 > 80%
- [ ] AC-002: 确保关键路径 100% 覆盖
- [ ] AC-003: 生成覆盖率报告

---

## Phase 6: 安装验证（渐进式）

### T6.1 轻量级测试项目验证（Greenfield）
- [ ] AC-001: 创建空测试项目 `test-seed-install`
- [ ] AC-002: 运行 `git init` 初始化 Git
- [ ] AC-003: 在 Claude Code 中运行 `/mob-seed:init`
- [ ] AC-004: 验证 `.seed/config.json` 创建正确
- [ ] AC-005: 验证 `.seed/mission.md` 创建正确
- [ ] AC-006: 验证 `.git/hooks/` 已安装

### T6.2 Brownfield 测试项目验证
- [ ] AC-001: 在测试项目中添加示例代码
- [ ] AC-002: 测试 `/mob-seed:spec reverse-engineer`
- [ ] AC-003: 验证逆向生成的规格文件
- [ ] AC-004: 验证 Git commit 触发 pre-commit

### T6.3 Mars-nexus 最终验证
- [ ] AC-001: 运行 `/mob-seed:init` 成功（或提示已初始化）
- [ ] AC-002: 验证不干扰现有项目文件
- [ ] AC-003: 验证 `/mob-seed:defend --quick` 正常执行

### T6.4 Claude Code 命令验证
- [ ] AC-001: `/mob-seed:init` 命令输出完整
- [ ] AC-002: `/mob-seed:defend` 系列命令可用
- [ ] AC-003: `/mob-seed:spec` 命令可用
- [ ] AC-004: 命令帮助信息正确

### T6.5 验证 Git Hooks 触发
- [ ] AC-001: `git commit` 触发 pre-commit 检查
- [ ] AC-002: `git push` 触发 pre-push 检查
- [ ] AC-003: 检查失败时正确阻止操作

### T6.6 清理测试项目
- [ ] AC-001: 删除 `test-seed-install` 测试项目
- [ ] AC-002: 确认 mars-nexus 无残留测试数据

---

## Phase 7: 发布

### T7.1 更新 CHANGELOG
- [ ] AC-001: 运行 `git log v3.3.0..HEAD --stat` 获取完整变更
- [ ] AC-002: 按 Keep a Changelog 规范编写 v3.4.0 变更记录
- [ ] AC-003: 突出 Breaking Changes（如有）

### T7.2 更新版本号
- [ ] AC-001: 运行 `node scripts/bump-version.js 3.4.0 --release`
- [ ] AC-002: 验证 4 个版本文件同步更新
- [ ] AC-003: 验证 git status 只有版本文件变更

### T7.3 创建发布
- [ ] AC-001: `git commit -m "chore(release): v3.4.0"`
- [ ] AC-002: `git tag -a v3.4.0 -m "Release v3.4.0"`
- [ ] AC-003: `git push origin main && git push origin v3.4.0`

---

## 验收标准映射

来自 v3.3 `architecture-refactor.fspec.md` 的验收标准：

| v3.3 AC | v3.4 Task | 状态 |
|---------|-----------|------|
| AC-001: 文件移动并分层完成 | T1.1-T1.7 | pending |
| AC-002: 命令选项可用 | T4.1-T4.4 | pending |
| AC-003: 三种调用方式都可用 | T5.4 | pending |
| AC-004: 规格派生路径正确 | T2.4 | pending |
| AC-005: 文档示例更新 | T4.1-T4.2 | pending |
| AC-006: 向后兼容提示 | T4.3 | pending |
| AC-007: Git Hooks 正常工作 | T6.4 | pending |
| AC-008: 测试通过 | T5.1-T5.5 | pending |

新增验收标准：

| v3.4 AC | Task | 状态 |
|---------|------|------|
| 所有验证工具在 `skills/mob-seed/scripts/` | T2.1-T2.2 | pending |
| 所有 hooks 模板在 `skills/mob-seed/hooks/` | T2.3 | pending |
| `.seed/scripts/` 是符号链接 | T3.2 | pending |
| `.seed/hooks/` 是符号链接 | T3.2 | pending |
| mob-seed 项目自身功能正常 | T3.3 | pending |
| mars-nexus 可成功运行 `/mob-seed:init` | T6.1 | pending |
| Git commit 触发 pre-commit 检查 | T6.4 | pending |
| Git push 触发 pre-push 检查 | T6.4 | pending |
