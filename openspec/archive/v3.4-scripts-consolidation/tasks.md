# v3.4 Scripts Consolidation - Tasks

> 状态: archived
> 归档日期: 2026-01-04

## 进度概览

| 阶段 | 描述 | 状态 | 进度 |
|------|------|------|------|
| Phase 1 | 分层库实现 | ✅ 完成 | 100% |
| Phase 2 | 工具整合 | ✅ 完成 | 100% |
| Phase 3 | Dogfooding 建立 | ✅ 完成 | 100% |
| Phase 4 | 场景检测 | ✅ 完成 | 100% |
| Phase 5 | 测试实现 | ✅ 完成 | 100% |

**总体进度**: 100%

---

## Phase 1: 分层库实现

### T1.1 lib/hooks/ 模块
- [x] AC-001: 创建 `skills/mob-seed/lib/hooks/` 目录
- [x] AC-002: 实现 `scenario.js` - 场景检测逻辑
- [x] AC-003: 实现 `quick-defender.js` - 快速检查逻辑
- [x] AC-004: 实现 `incremental-defender.js` - 增量检查逻辑
- [x] AC-005: 实现 `cache-checker.js` - 缓存检查
- [x] AC-006: 实现 `cache-updater.js` - 缓存更新
- [x] AC-007: 实现 `index.js` - 模块导出

---

## Phase 2: 工具整合

### T2.1 验证工具迁移
- [x] AC-001: `verify-archive.js` 存在于 `skills/mob-seed/scripts/`
- [x] AC-002: `verify-seed-sync.js` 存在于 `skills/mob-seed/scripts/`
- [x] AC-003: `verify-docs.js` 存在于 `skills/mob-seed/scripts/`
- [x] AC-004: `verify-task-progress.js` 存在于 `skills/mob-seed/scripts/`
- [x] AC-005: `verify-architecture-decisions.js` 存在于 `skills/mob-seed/scripts/`

### T2.2 Brownfield 工具
- [x] AC-001: `reverse-engineer.js` 存在于 `skills/mob-seed/scripts/`

### T2.3 Hooks 模板
- [x] AC-001: 创建 `skills/mob-seed/hooks/` 目录
- [x] AC-002: `pre-commit` 模板已创建
- [x] AC-003: `pre-push` 模板已创建
- [x] AC-004: `ace-pre-commit` 模板已创建
- [x] AC-005: `ace-pre-push` 模板已创建
- [x] AC-006: `README.md` 文档已创建

### T2.4 内部工具分离
- [x] AC-001: `scripts/bump-version.js` 保留在根目录
- [x] AC-002: `scripts/release.sh` 保留在根目录
- [x] AC-003: `scripts/check-proposal-tasks-sync.js` 保留在根目录
- [x] AC-004: `scripts/README.md` 说明内部工具

---

## Phase 3: Dogfooding 建立

### T3.1 符号链接
- [x] AC-001: `.seed/scripts` 是符号链接指向 `../skills/mob-seed/scripts`
- [x] AC-002: `.seed/hooks` 是符号链接指向 `../skills/mob-seed/hooks`
- [x] AC-003: 链接使用相对路径
- [x] AC-004: 链接可正常解析

### T3.2 功能验证
- [x] AC-001: 通过链接访问的脚本可执行
- [x] AC-002: 通过链接访问的 hooks 可执行
- [x] AC-003: Git commit 触发 pre-commit
- [x] AC-004: Git push 触发 pre-push

---

## Phase 4: 场景检测

### T4.1 场景检测模块
- [x] AC-001: `lib/hooks/scenario.js` 已创建
- [x] AC-002: `detectScenario()` 函数实现
- [x] AC-003: `formatLabel()` 函数实现
- [x] AC-004: `isDevelopment()` 函数实现
- [x] AC-005: `isUserProject()` 函数实现

### T4.2 场景集成
- [x] AC-001: `hooks/pre-commit` 显示场景标识
- [x] AC-002: `hooks/pre-push` 显示场景标识
- [x] AC-003: `lib/hooks/quick-defender.js` 集成场景检测
- [x] AC-004: `lib/hooks/incremental-defender.js` 集成场景检测

### T4.3 五种场景支持
- [x] AC-001: dogfooding 场景 - [开发模式]
- [x] AC-002: user-env 场景 - [用户项目] 环境变量
- [x] AC-003: user-plugin 场景 - [用户项目] Claude Code 插件
- [x] AC-004: compat 场景 - [兼容模式]
- [x] AC-005: missing 场景 - [错误]

---

## Phase 5: 测试实现

### T5.1 Hooks 测试
- [x] AC-001: `test/hooks/scenario.test.js` - 场景检测测试
- [x] AC-002: `test/hooks/quick-defender.test.js` - 快速检查测试
- [x] AC-003: `test/hooks/incremental-defender.test.js` - 增量检查测试
- [x] AC-004: `test/hooks/cache-checker.test.js` - 缓存检查测试
- [x] AC-005: `test/hooks/cache-updater.test.js` - 缓存更新测试

### T5.2 测试统计
- **测试数量**: 100 个测试
- **通过**: 100
- **失败**: 0
- **覆盖率**: hooks 模块 100%

---

## 产物清单

### 代码文件
| 文件 | 行数 | 说明 |
|------|------|------|
| `lib/hooks/scenario.js` | 108 | 场景检测 |
| `lib/hooks/quick-defender.js` | 119 | 快速检查 |
| `lib/hooks/incremental-defender.js` | 195 | 增量检查 |
| `lib/hooks/cache-checker.js` | 58 | 缓存检查 |
| `lib/hooks/cache-updater.js` | 63 | 缓存更新 |
| `lib/hooks/index.js` | 27 | 模块导出 |

### Hooks 模板
| 文件 | 说明 |
|------|------|
| `hooks/pre-commit` | SEED pre-commit 钩子 |
| `hooks/pre-push` | SEED pre-push 钩子 |
| `hooks/ace-pre-commit` | ACE pre-commit 钩子 |
| `hooks/ace-pre-push` | ACE pre-push 钩子 |
| `hooks/README.md` | Hooks 使用文档 |

### 脚本工具
| 文件 | 说明 |
|------|------|
| `scripts/verify-archive.js` | 归档验证 |
| `scripts/verify-seed-sync.js` | SEED 同步验证 |
| `scripts/verify-docs.js` | 文档验证 |
| `scripts/verify-task-progress.js` | 任务进度验证 |
| `scripts/verify-architecture-decisions.js` | 架构决策验证 |
| `scripts/reverse-engineer.js` | Brownfield 逆向工程 |

---

## 验收标准映射

### 来自 proposal.md 的 AC

| AC | 描述 | 状态 |
|----|------|------|
| 所有验证工具在 `skills/mob-seed/scripts/` | 6 个验证工具 | ✅ |
| 所有 hooks 模板在 `skills/mob-seed/hooks/` | 5 个模板 | ✅ |
| `.seed/scripts/` 是符号链接 | 指向 skills/mob-seed/scripts | ✅ |
| `.seed/hooks/` 是符号链接 | 指向 skills/mob-seed/hooks | ✅ |
| mob-seed 项目自身功能正常 | 测试通过 | ✅ |
| 场景检测模块 | lib/hooks/scenario.js | ✅ |
| 五种场景支持 | dogfooding/user-env/user-plugin/compat/missing | ✅ |
| 开发模式验证 | [开发模式] 青色标识 | ✅ |
