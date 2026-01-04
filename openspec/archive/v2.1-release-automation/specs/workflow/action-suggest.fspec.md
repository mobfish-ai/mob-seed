---
status: archived
archived: 2026-01-01
version: 1.0.0
created: 2026-01-01
updated: 2026-01-01
priority: P0
---
# action-suggest 规格
## 概述 (Overview)

行动建议引擎，检测到问题后自动分析并给出最优行动建议，实现"检测 → 建议 → 确认 → 执行"的闭环自动化。

### 目标用户
- SEED 方法论使用者
- 希望减少手动操作的开发者

### 核心价值
- 智能分析问题并推荐解决方案
- 用户只需确认(Y/N)，无需记忆命令
- 链式触发实现流程自动衔接

## 需求 (Requirements)

### 功能需求

- [x] FR-001: 问题分析 - 解析检测到的问题类型和严重程度
- [x] FR-002: 行动映射 - 根据问题类型映射到对应的修复命令
- [x] FR-003: 建议生成 - 生成用户可读的建议行动列表
- [x] FR-004: 确认执行 - 用户确认后执行建议的命令
- [x] FR-005: 链式触发 - 操作完成后自动检查是否需要下一步
- [x] FR-006: 批量执行 - 支持一次确认执行多个建议

### 非功能需求

- [x] NFR-001: 建议响应 < 1 秒
- [x] NFR-002: 建议准确率 > 95%
- [x] NFR-003: 支持取消正在执行的操作

## 约束 (Constraints)

### 技术约束
- 使用 Node.js 实现
- 危险操作必须要求确认
- 支持 `--auto` 跳过确认

### 业务约束
- 遵循 SEED 四字诀顺序
- 不得自动执行破坏性操作

## 接口设计 (Interface)

### 问题 → 行动映射

| 问题类型 | 建议行动 | 用户交互 |
|----------|----------|----------|
| 规格未派生 | `/mob-seed emit` | [Y] 立即派生 |
| 测试未运行 | `/mob-seed exec` | [Y] 运行测试 |
| 测试失败 | 修复指导 + 重新执行 | [Y] 查看详情 |
| 文档未生成 | `/mob-seed emit --docs` | [Y] 生成文档 |
| 文档过时 | `/mob-seed emit --docs` | [Y] 更新文档 |
| AC 未完成 | 更新规格状态 | [Y] 自动标记 |
| 代码漂移 | 逆向同步建议 | [Y] 同步到规格 |
| 可归档 | `/mob-seed archive` | [Y] 执行归档 |
| 版本不一致 | `bump-version` | [Y] 同步版本 |

### API 接口

```javascript
// lib/workflow/action-suggest.js

/**
 * 问题类型枚举
 */
const PROBLEM_TYPES = {
  SPEC_NOT_EMITTED: 'spec_not_emitted',
  TEST_NOT_RUN: 'test_not_run',
  TEST_FAILED: 'test_failed',
  DOCS_NOT_GENERATED: 'docs_not_generated',
  DOCS_OUTDATED: 'docs_outdated',
  AC_INCOMPLETE: 'ac_incomplete',
  CODE_DRIFT: 'code_drift',
  READY_TO_ARCHIVE: 'ready_to_archive',
  VERSION_MISMATCH: 'version_mismatch'
};

/**
 * 分析问题并生成建议
 * @param {Problem[]} problems - 检测到的问题列表
 * @returns {Suggestion[]} 建议列表
 */
function analyzeProblem(problems);

/**
 * 获取问题对应的修复命令
 * @param {string} problemType - 问题类型
 * @param {object} context - 上下文信息
 * @returns {Command} 修复命令
 */
function getFixCommand(problemType, context);

/**
 * 执行建议的命令
 * @param {Suggestion} suggestion - 建议
 * @param {object} options - 选项
 * @returns {Promise<ExecutionResult>}
 */
async function executeSuggestion(suggestion, options);

/**
 * 检查是否需要链式触发
 * @param {ExecutionResult} result - 上一步执行结果
 * @returns {Suggestion|null} 下一步建议或 null
 */
function checkChainTrigger(result);

/**
 * 批量执行建议
 * @param {Suggestion[]} suggestions - 建议列表
 * @param {object} options - 选项
 * @returns {Promise<BatchResult>}
 */
async function executeBatch(suggestions, options);
```

### 链式触发规则

```
emit 完成 → 自动检查: 是否需要运行测试？
                 ↓ [Y]
exec 完成 → 自动检查: AC 是否全部通过？
                 ↓ [Y]
更新 AC   → 自动检查: 是否可以归档？
                 ↓ [Y]
archive   → 自动检查: 版本是否需要更新？
```

## 验收标准 (Acceptance Criteria)

### AC-006: 检测问题输出建议
- Given: 检测到规格未派生
- When: 分析问题
- Then: 输出建议 `[1] 派生 xxx.js → /mob-seed emit`

### AC-007: 确认后执行
- Given: 用户看到建议列表
- When: 输入 `1` 或 `Y`
- Then: 执行对应的 emit 命令

### AC-008: 链式触发
- Given: emit 完成
- When: 检测到测试未运行
- Then: 自动提示 `是否运行测试？ [Y/n]`

## 派生产物 (Derived Outputs)

> 路径遵循 `.seed/config.json` 配置，相对于 `skills/mob-seed/` 目录

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/workflow/action-suggest.js | 行动建议引擎 |
| 测试 | skills/mob-seed/test/workflow/action-suggest.test.js | 单元测试 |
| 文档 | docs/api/action-suggest.md | API 文档 |
