# unified-command 规格

> 版本: 1.0.0
> 创建时间: 2026-01-01
> 最后更新: 2026-01-01
> 优先级: P0

## 概述 (Overview)

统一命令入口，将 11 个独立命令整合为 6 个子命令，遵循业界标准的空格分隔子命令模式。

### 目标用户
- SEED 方法论使用者
- Claude Code 开发者

### 核心价值
- 减少命令数量 45%（11 → 6）
- 对齐 git/npm/docker 业界标准
- 智能入口自动检测上下文

## 需求 (Requirements)

### 功能需求

- [ ] FR-001: 子命令路由 - `/mob-seed <subcommand>` 路由到对应处理器
- [ ] FR-002: 智能默认入口 - 无参数时执行全量检查 + 建议行动
- [ ] FR-003: 项目检测 - 检查 `.seed/config.json` 并加载配置
- [ ] FR-004: 状态收集 - 收集规格/代码/测试/AC 状态
- [ ] FR-005: 同步检查 - 规格与代码/测试/文档一致性
- [ ] FR-006: 漂移检测 - 识别新增/缺失/不一致问题
- [ ] FR-007: 报告输出 - 状态面板 + 建议行动列表

### 非功能需求

- [ ] NFR-001: `--quick` 模式 < 3 秒完成
- [ ] NFR-002: 默认模式 < 30 秒完成
- [ ] NFR-003: 错误信息清晰可操作

## 约束 (Constraints)

### 技术约束
- 使用 Node.js 实现
- 兼容 Claude Code 技能系统
- 子命令目录结构: `commands/mob-seed/`

### 业务约束
- 遵循 SEED 四字诀: Spec → Emit → Exec → Defend
- 保持与 OpenSpec 生命周期一致

## 接口设计 (Interface)

### 命令格式

```
/mob-seed [subcommand] [options]
```

### 子命令列表

| 子命令 | 说明 |
|--------|------|
| (无) | 智能状态面板 + 建议行动 |
| init | 项目初始化 |
| spec | 规格管理 |
| emit | 自动派生 |
| exec | 执行测试 |
| defend | 守护检查 |
| archive | 归档提案 |

### 全局选项

| 选项 | 说明 |
|------|------|
| --quick | 快速检查（秒级） |
| --fix | 自动修复可修复问题 |
| --auto | 自动执行所有建议 |
| --ci | CI 模式（严格检查） |
| --strict | 严格模式（警告算失败） |

### API 接口

```javascript
// lib/workflow/unified-command.js

/**
 * 路由子命令
 * @param {string} subcommand - 子命令名称
 * @param {string[]} args - 参数列表
 * @param {object} options - 选项
 * @returns {Promise<CommandResult>}
 */
function routeSubcommand(subcommand, args, options);

/**
 * 执行智能入口（无子命令时）
 * @param {object} options - 选项
 * @returns {Promise<StatusReport>}
 */
function executeSmartEntry(options);

/**
 * 收集项目状态
 * @returns {Promise<ProjectStatus>}
 */
function collectStatus();

/**
 * 检查同步状态
 * @returns {Promise<SyncResult>}
 */
function checkSync();

/**
 * 检测漂移
 * @returns {Promise<DriftResult>}
 */
function detectDrift();
```

## 验收标准 (Acceptance Criteria)

### AC-001: 无参数执行全量检查
- Given: 用户在已初始化的 SEED 项目中
- When: 执行 `/mob-seed` 无参数
- Then: 输出状态面板 + 同步检查 + 漂移检测 + 建议行动

### AC-002: 子命令路由正确
- Given: 用户执行 `/mob-seed spec test-feature`
- When: 命令解析完成
- Then: 路由到 spec 子命令处理器，传递 `test-feature` 参数

### AC-003: --quick 模式秒级完成
- Given: 项目有 10 个规格文件
- When: 执行 `/mob-seed --quick`
- Then: 3 秒内返回结果

### AC-004: --fix 自动修复
- Given: 检测到文档版本过时
- When: 执行 `/mob-seed --fix`
- Then: 自动更新文档版本号

### AC-005: --auto 无需确认
- Given: 检测到 3 个可修复问题
- When: 执行 `/mob-seed --auto`
- Then: 自动执行所有修复，无需用户确认

## 派生产物 (Derived Outputs)

> 路径遵循 `.seed/config.json` 配置，相对于 `skills/mob-seed/` 目录

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/workflow/unified-command.js | 统一命令入口 |
| 测试 | skills/mob-seed/test/workflow/unified-command.test.js | 单元测试 |
| 文档 | docs/api/unified-command.md | API 文档 |
| 命令 | commands/mob-seed/seed.md | 主入口命令文件 |
