# Mission Integration API

> Derived from: `skills/mob-seed/lib/mission/integration.js`

## Overview

SEED 阶段集成检查模块，将项目使命声明集成到 SEED 各阶段，确保开发过程与项目使命保持对齐。

## Constants

### PHASE_CHECKS

阶段检查配置：

| 阶段 | 名称 | 检查内容 |
|------|------|----------|
| `spec` | 规格定义 | 规格是否符合核心原则？是否触犯反目标？ |
| `emit` | 派生执行 | 派生策略是否符合简单优先原则？ |
| `exec` | 执行测试 | 测试覆盖是否满足质量要求？ |
| `defend` | 守护检查 | 变更是否偏离使命？对齐分数达标？ |

### VIOLATION_SUGGESTIONS

违规建议映射：

| 反目标 | 建议 |
|--------|------|
| `feature_creep` | 建议拆分为独立提案 |
| `over_engineering` | 建议简化实现 |
| `sync_breaking` | 强制要求先更新规格 |
| `black_box_magic` | 建议添加清晰注释和文档 |
| `ai_replacement_mindset` | 建议增加人工确认点 |

## Functions

### loadMission(projectRoot)

加载 Mission 文件（带会话级缓存）。

**Parameters:**
- `projectRoot` (string): 项目根目录

**Returns:** `Mission|null`

### getCachedMission(projectRoot)

获取缓存的 Mission。

**Parameters:**
- `projectRoot` (string): 项目根目录

**Returns:** `Mission|null`

### clearMissionCache()

清除 Mission 缓存。

### checkPhaseAlignment(phase, context, options)

检查阶段对齐。

**Parameters:**
- `phase` (string): SEED 阶段 (`spec|emit|exec|defend`)
- `context` (Object): 操作上下文
- `options` (Object): 选项
  - `strict` (boolean): 严格模式

**Returns:** `PhaseCheckResult`

```javascript
// PhaseCheckResult 结构
{
  phase: string,
  passed: boolean,
  score: number,
  violations: string[],
  warnings: string[],
  suggestions: string[]
}
```

### evaluateAlignment(mission, context)

评估操作与使命的对齐度。

**Parameters:**
- `mission` (Mission): 使命配置
- `context` (Object): 操作上下文

**Returns:** `AlignmentResult`

```javascript
// AlignmentResult 结构
{
  total: number,          // 总体对齐分数 (0-1)
  meetsThreshold: boolean, // 是否达到阈值
  violations: string[],   // 违反的原则列表
  warnings: string[],     // 警告列表
  suggestions: string[]   // 改进建议
}
```

### checkAntiGoals(content, antiGoals)

检测内容是否触犯反目标。

**Parameters:**
- `content` (string): 待检查内容
- `antiGoals` (string[]): 反目标列表

**Returns:** `string[]` - 触犯的反目标

## Usage

```javascript
const { loadMission, checkPhaseAlignment, evaluateAlignment } = require('./integration');

// 加载 Mission
const mission = loadMission('/project/root');

// 检查阶段对齐
const result = checkPhaseAlignment('emit', { content: '...' });

// 评估对齐度
const alignment = evaluateAlignment(mission, context);
if (!alignment.meetsThreshold) {
  console.log('对齐分数不足:', alignment.total);
}
```

## Related

- Spec: `openspec/specs/mission/integration.fspec.md`
- Test: `test/mission/integration.test.js`
