# mission-integration 规格

> 版本: 1.0.0
> 状态: archived
> 归档日期: 2026-01-01
> 创建时间: 2026-01-01
> 最后更新: 2026-01-01
> 优先级: P1

## 概述 (Overview)

Mission 集成检查，将项目使命声明集成到 SEED 各阶段，确保开发过程与项目使命保持对齐。

### 目标用户
- SEED 方法论使用者
- 需要使命对齐检查的项目

### 核心价值
- 各阶段自动检查使命对齐
- 违反反目标时及时警告
- 会话级缓存避免重复加载

## 需求 (Requirements)

### 功能需求

- [x] FR-001: Mission 加载 - 加载 `.seed/mission.md` 文件
- [x] FR-002: 原则解析 - 解析 Mission 核心结构（principles/anti_goals/evolution）
- [x] FR-003: 对齐评估 - 评估操作与使命的对齐度
- [x] FR-004: 阶段集成 - 在 Spec/Emit/Exec/Defend 各阶段集成检查
- [x] FR-005: 缓存复用 - 会话内复用 Mission 加载结果

### 非功能需求

- [x] NFR-001: 对齐检查 < 100ms
- [x] NFR-002: Mission 解析 < 50ms
- [x] NFR-003: 缓存命中时 < 1ms

## 约束 (Constraints)

### 技术约束
- Mission 文件使用 Markdown 格式
- 支持 Mission 三层结构（principles/anti_goals/evolution）
- 依赖 session-cache 模块

### 业务约束
- 对齐分数 < 0.5 时阻止操作（--strict 模式）
- 对齐分数 < 0.7 时输出警告

## 接口设计 (Interface)

### 阶段检查内容

| 阶段 | 检查内容 |
|------|----------|
| Spec | 规格是否符合核心原则？触犯反目标？ |
| Emit | 派生策略是否符合简单优先原则？ |
| Exec | 测试覆盖是否满足质量要求？ |
| Defend | 变更是否偏离使命？对齐分数达标？ |

### 对齐问题建议

| 问题 | 建议行动 |
|------|----------|
| 触犯 feature_creep | 建议拆分为独立提案 |
| 触犯 over_engineering | 建议简化实现 |
| 触犯 sync_breaking | 强制要求先更新规格 |
| 分数 < 0.5 | 阻止操作，要求人工审核 |

### API 接口

```javascript
// lib/mission/integration.js

/**
 * 加载 Mission 文件
 * @param {string} projectRoot - 项目根目录
 * @returns {Mission}
 */
function loadMission(projectRoot);

/**
 * 解析 Mission 核心结构
 * @param {string} content - Mission 文件内容
 * @returns {MissionCore} { principles, antiGoals, evolution }
 */
function parseMissionCore(content);

/**
 * 评估对齐度
 * @param {Mission} mission - 使命配置
 * @param {object} context - 上下文
 * @returns {AlignmentResult}
 */
function evaluateAlignment(mission, context);

/**
 * 检查阶段对齐
 * @param {string} phase - SEED 阶段 (spec|emit|exec|defend)
 * @param {object} context - 操作上下文
 * @param {object} options - 选项
 * @returns {PhaseCheckResult}
 */
function checkPhaseAlignment(phase, context, options);

/**
 * 获取缓存的 Mission
 * @param {string} projectRoot - 项目根目录
 * @returns {Mission|null}
 */
function getCachedMission(projectRoot);
```

### AlignmentResult 结构

```javascript
{
  total: 0.8,              // 总体对齐分数 (0-1)
  meetsThreshold: true,    // 是否达到阈值
  violations: [],          // 违反的原则列表
  warnings: [],            // 警告列表
  suggestions: []          // 改进建议
}
```

## 验收标准 (Acceptance Criteria)

### AC-019: 阶段 Mission 检查
- Given: Mission 定义了反目标 `feature_creep`
- When: emit 阶段检测到功能蔓延
- Then: 输出警告并建议拆分

### AC-020: 对齐分数警告
- Given: 对齐分数为 0.6（< 0.7 阈值）
- When: 执行检查
- Then: 输出 `⚠️ 对齐分数 0.6 < 阈值 0.7`

### AC-021: strict 模式阻止
- Given: 对齐分数为 0.4（< 0.5）
- When: 执行 `/mob-seed --strict`
- Then: 阻止操作并提示人工审核

### AC-022: 缓存复用
- Given: 首次加载 Mission
- When: 同会话内再次检查
- Then: 使用缓存，不重新加载文件

## 派生产物 (Derived Outputs)

> 路径遵循 `.seed/config.json` 配置，相对于 `skills/mob-seed/` 目录

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/mission/integration.js | Mission 集成 |
| 测试 | skills/mob-seed/test/mission/integration.test.js | 单元测试 |
| 文档 | docs/api/mission-integration.md | API 文档 |
