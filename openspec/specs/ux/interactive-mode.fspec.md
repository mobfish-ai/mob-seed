# interactive-mode 规格

> 版本: 1.0.0
> 状态: archived
> 归档日期: 2026-01-01
> 创建时间: 2026-01-01
> 最后更新: 2026-01-01
> 优先级: P2

## 概述 (Overview)

交互式体验模块，提供友好的用户交互界面，包括确认流程、智能上下文感知和错误恢复机制。

### 目标用户
- SEED 方法论使用者
- 偏好交互式操作的开发者

### 核心价值
- 交互式确认减少误操作
- 智能上下文感知提升效率
- 错误恢复保证操作连续性

## 需求 (Requirements)

### 功能需求

- [x] FR-001: 交互式确认 - 危险操作前请求用户确认
- [x] FR-002: 选项菜单 - 多选项时显示编号菜单
- [x] FR-003: 上下文感知 - 根据项目状态智能推荐
- [x] FR-004: 错误恢复 - 中断后可继续上次操作
- [x] FR-005: 进度显示 - 长任务显示进度条
- [x] FR-006: 批量确认 - 支持全选或单选操作

### 非功能需求

- [x] NFR-001: 响应延迟 < 100ms
- [x] NFR-002: 支持非 TTY 环境回退
- [x] NFR-003: 终端宽度自适应

## 约束 (Constraints)

### 技术约束
- 使用 Node.js readline 模块
- 支持 CI 环境（非交互模式）
- 兼容 Claude Code 输出格式

### 业务约束
- 危险操作必须明确确认
- 不得静默执行破坏性操作

## 接口设计 (Interface)

### 确认流程

```
检测到 3 个可修复问题:

[1] 📝 lib/workflow/action-suggest.js 未派生
    → 自动派生代码框架

[2] 🧪 3 个测试失败
    → 查看失败详情并提供修复建议

[3] 📊 AC-009, AC-010 未标记完成
    → 根据测试结果自动标记

选择操作:
  [a] 全部执行
  [1-3] 选择单个
  [n] 跳过
  [q] 退出

>
```

### 上下文感知场景

| 场景 | 检测条件 | 建议 |
|------|----------|------|
| 新规格创建 | 检测到新 fspec 文件 | 开始派生代码？ |
| 规格修改 | 检测到 fspec 变更 | 重新派生受影响代码？ |
| 测试全通过 | AC 100% 完成 | 归档此提案？ |
| 版本准备 | 所有检查通过 | 发布新版本？ |

### 错误恢复

```
执行中断? 继续上次操作:

/mob-seed --resume

恢复点: emit action-suggest.js (50% 完成)
[Y] 继续 / [N] 重新开始 / [S] 跳过
```

### API 接口

```javascript
// lib/ux/interactive-prompt.js

/**
 * 请求确认
 * @param {string} message - 确认信息
 * @param {object} options - 选项
 * @returns {Promise<boolean>}
 */
async function confirm(message, options);

/**
 * 显示选项菜单
 * @param {string} title - 标题
 * @param {Option[]} options - 选项列表
 * @returns {Promise<Selection>}
 */
async function showMenu(title, options);

/**
 * 检测上下文并推荐
 * @param {ProjectStatus} status - 项目状态
 * @returns {Recommendation}
 */
function detectContext(status);

/**
 * 保存恢复点
 * @param {string} operation - 操作名称
 * @param {object} state - 状态数据
 */
function saveCheckpoint(operation, state);

/**
 * 加载恢复点
 * @returns {Checkpoint|null}
 */
function loadCheckpoint();

/**
 * 清除恢复点
 */
function clearCheckpoint();

// lib/ux/progress-panel.js

/**
 * 创建进度条
 * @param {string} label - 标签
 * @param {number} total - 总数
 * @returns {ProgressBar}
 */
function createProgressBar(label, total);

/**
 * 渲染状态面板
 * @param {PanelData} data - 面板数据
 * @returns {string}
 */
function renderPanel(data);
```

## 验收标准 (Acceptance Criteria)

### AC-016: 交互式确认
- Given: 检测到可修复问题
- When: 显示确认菜单
- Then: 用户可选择 [a] 全部/[1-3] 单选/[n] 跳过

### AC-017: 智能上下文
- Given: 刚创建新规格文件
- When: 执行 `/mob-seed`
- Then: 自动建议"开始派生代码？"

### AC-018: 错误恢复
- Given: emit 操作中断
- When: 执行 `/mob-seed --resume`
- Then: 提示恢复点并询问继续/重新开始

## 派生产物 (Derived Outputs)

> 路径遵循 `.seed/config.json` 配置，相对于 `skills/mob-seed/` 目录

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ux/interactive-prompt.js | 交互式提示 |
| 代码 | skills/mob-seed/lib/ux/progress-panel.js | 进度面板 |
| 测试 | skills/mob-seed/test/ux/interactive-prompt.test.js | 单元测试 |
| 测试 | skills/mob-seed/test/ux/progress-panel.test.js | 单元测试 |
| 文档 | docs/api/interactive-mode.md | API 文档 |
