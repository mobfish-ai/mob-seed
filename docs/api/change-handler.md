# Change Handler (变更处理器)

> fspec 变更检测、影响分析与执行

## 概述

处理开发过程中的需求变更，支持变更影响分析、规格更新、代码同步，确保变更过程可控且可追溯。

## 安装

```javascript
const {
  detectChanges,
  watchFspec,
  compareVersions,
  analyzeImpact,
  findAffectedFiles,
  estimateEffort,
  requestApproval,
  recordDecision,
  executeChange,
  rollbackChange,
  recordChange,
  getChangeHistory,
  getChangeById,
  batchProcess,
  mergeImpacts
} = require('mob-seed/lib/ops/change-handler');
```

## API

### detectChanges(fspecPath)

检测 fspec 文件的变更。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| fspecPath | string | fspec 文件路径 |

**返回:**

```javascript
[
  {
    type: string,      // 'ADDED' | 'MODIFIED' | 'REMOVED' | 'CLARIFIED'
    target: string,    // 'REQ-001' | 'AC-002'
    description: string,
    diff: string       // diff 格式的变更内容
  }
]
```

### watchFspec(dir, callback)

监控 fspec 目录变更。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| dir | string | 监控目录 |
| callback | function | 变更回调 |

**返回:** `Watcher` - 监控器对象

**示例:**

```javascript
const watcher = watchFspec('/specs', (change) => {
  console.log('检测到变更:', change);
});
// 稍后停止监控
watcher.stop();
```

### compareVersions(oldContent, newContent)

对比两个版本的 fspec 内容。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| oldContent | string | 旧版本内容 |
| newContent | string | 新版本内容 |

**返回:**

```javascript
{
  added: string[],    // 新增的需求 ID
  modified: string[], // 修改的需求 ID
  removed: string[]   // 删除的需求 ID
}
```

### analyzeImpact(change)

分析变更影响。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| change | Change | 变更对象 |

**返回:**

```javascript
{
  codeFiles: string[],    // 受影响的源文件
  testFiles: string[],    // 需要更新的测试
  dependencies: string[], // 受影响的下游模块
  effort: {
    hours: number,
    breakdown: object
  }
}
```

### findAffectedFiles(change)

查找受变更影响的文件。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| change | Change | 变更对象 |

**返回:** `string[]` - 受影响的文件路径列表

### estimateEffort(impact)

评估变更工作量。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| impact | ImpactAnalysis | 影响分析结果 |

**返回:**

```javascript
{
  totalHours: number,
  codeModification: string,  // '~30分钟'
  testUpdate: string,
  verification: string
}
```

### requestApproval(change, impact)

请求变更审批。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| change | Change | 变更对象 |
| impact | ImpactAnalysis | 影响分析 |

**返回:** `Promise<Decision>` - 审批决策

### recordDecision(changeId, decision, reason)

记录审批决策。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| changeId | string | 变更 ID |
| decision | string | 'approved' | 'rejected' | 'deferred' |
| reason | string | 决策原因 |

**返回:** void

### executeChange(change, impact)

执行已批准的变更。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| change | Change | 变更对象 |
| impact | ImpactAnalysis | 影响分析 |

**返回:**

```javascript
{
  success: boolean,
  filesModified: string[],
  gitCommit: string,
  errors: Error[]
}
```

### rollbackChange(changeId)

回滚变更。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| changeId | string | 变更 ID |

**返回:** void

### recordChange(change, execution)

记录变更历史。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| change | Change | 变更对象 |
| execution | ExecutionResult | 执行结果 |

**返回:** void

### getChangeHistory(fspecPath?)

获取变更历史。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| fspecPath | string | 可选，过滤特定文件 |

**返回:** `ChangeRecord[]` - 变更记录列表

### getChangeById(changeId)

根据 ID 获取变更记录。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| changeId | string | 变更 ID |

**返回:** `ChangeRecord`

### batchProcess(changes)

批量处理变更。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| changes | Change[] | 变更列表 |

**返回:**

```javascript
{
  processed: number,
  succeeded: number,
  failed: number,
  results: ExecutionResult[]
}
```

### mergeImpacts(impacts)

合并多个影响分析。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| impacts | ImpactAnalysis[] | 影响分析列表 |

**返回:** `MergedImpact` - 合并后的影响分析

## 变更类型

| 类型 | Delta 标记 | 影响 |
|------|-----------|------|
| 新增需求 | ADDED | 需要新实现 |
| 修改需求 | MODIFIED | 需要更新实现 |
| 删除需求 | REMOVED | 需要清理代码 |
| 澄清细节 | CLARIFIED | 可能需要调整 |

## 审批流程

```
变更检测 → 影响分析 → 审批决策 → 执行变更
                          │
              ┌───────────┼───────────┐
              │           │           │
              ▼           ▼           ▼
            批准        拒绝        延后
              │           │           │
              ▼           │           │
          执行变更        │           │
                          ▼           ▼
                      记录原因    加入待办
```

## 配置项

```json
{
  "changeHandler": {
    "watchEnabled": false,
    "autoApprove": false,
    "approvalRequired": ["MODIFIED", "REMOVED"],
    "historyDir": ".seed/changes/",
    "batchStrategy": "serial",
    "rollbackOnFailure": true
  }
}
```

## 相关链接

- [规格文件](../../openspec/specs/ops/change-handler.fspec.md)
- [源代码](../../skills/mob-seed/lib/ops/change-handler.js)
- [测试](../../skills/mob-seed/test/ops/change-handler.test.js)
