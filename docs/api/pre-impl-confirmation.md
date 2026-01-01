# Pre-Implementation Confirmation (实现前确认)

> 实现前变更预览与确认机制

## 概述

在开始实现阶段之前，展示即将执行的操作清单供用户确认，避免意外的大规模变更，确保用户对即将发生的修改有清晰的预期。

## 安装

```javascript
const {
  generateChangePreview,
  analyzeChanges,
  assessRisk,
  getRiskLevel,
  showConfirmation,
  processUserChoice,
  saveImplPlan,
  loadImplPlan,
  createRollbackPoint,
  executeRollback
} = require('mob-seed/lib/workflow/pre-impl-confirmation');
```

## API

### generateChangePreview(designPlan)

生成变更预览。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| designPlan | object | 设计方案 |

**返回:**

```javascript
{
  summary: {
    create: number,    // 新建文件数
    modify: number,    // 修改文件数
    delete: number     // 删除文件数
  },
  changes: ChangeItem[],
  riskLevel: string,
  warnings: string[]
}
```

### analyzeChanges(designPlan)

分析设计方案的变更项。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| designPlan | object | 设计方案 |

**返回:**

```javascript
[
  {
    type: string,          // 'create' | 'modify' | 'delete'
    path: string,          // 文件路径
    estimatedLines: number,// 预估行数
    additions: number,     // 新增行数
    deletions: number,     // 删除行数
    risk: string          // 风险等级
  }
]
```

### assessRisk(changes)

评估变更风险。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| changes | ChangeItem[] | 变更列表 |

**返回:**

```javascript
{
  overall: string,        // 'low' | 'medium' | 'high'
  breakdown: {
    fileCount: string,    // 文件数量风险
    coreFiles: string,    // 核心文件风险
    deletions: string,    // 删除操作风险
    dependencies: string, // 依赖变更风险
    scope: string         // 影响范围风险
  },
  warnings: string[]
}
```

### getRiskLevel(change)

获取单项变更的风险等级。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| change | ChangeItem | 变更项 |

**返回:** `'low' | 'medium' | 'high'`

### showConfirmation(preview)

显示确认界面。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| preview | ChangePreview | 变更预览 |

**返回:** `Promise<UserChoice>` - 用户选择

### processUserChoice(choice, preview)

处理用户选择。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| choice | UserChoice | 用户选择 |
| preview | ChangePreview | 变更预览 |

**返回:**

```javascript
{
  action: 'proceed' | 'cancel' | 'modify',
  skipItems: string[],    // 跳过的项
  modifiedPlan: object    // 修改后的计划
}
```

### saveImplPlan(changes, userChoices)

保存实现计划。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| changes | ChangeItem[] | 变更列表 |
| userChoices | object | 用户选择 |

**返回:** void

### loadImplPlan(flowId)

加载实现计划。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:** `ImplPlan | null`

### createRollbackPoint(changes)

创建回滚点。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| changes | ChangeItem[] | 变更列表 |

**返回:**

```javascript
{
  flowId: string,
  timestamp: Date,
  backupDir: string,
  gitCommit: string,
  rollbackScript: string
}
```

### executeRollback(flowId)

执行回滚。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| flowId | string | 工作流 ID |

**返回:** void

## 变更类型

| 类型 | 展示内容 | 风险等级 |
|------|----------|----------|
| 新建文件 | 文件路径、预估行数 | 低 |
| 修改文件 | 文件路径、变更范围 | 中 |
| 删除文件 | 文件路径、是否有备份 | 高 |
| 依赖变更 | 新增/删除的依赖 | 中 |
| 配置变更 | 配置文件修改项 | 中 |

## 风险评估维度

| 维度 | 低风险 | 中风险 | 高风险 |
|------|--------|--------|--------|
| 文件数量 | <=5 | 6-15 | >15 |
| 修改核心文件 | 无 | 1-2个 | >2个 |
| 删除操作 | 无 | 有备份 | 无备份 |
| 依赖变更 | 无 | 小版本 | 大版本/新增 |
| 影响范围 | 单模块 | 跨模块 | 全局 |

## 用户选项

| 输入 | 动作 |
|------|------|
| Y/yes/回车 | 确认全部变更，开始实现 |
| n/no | 取消实现，返回设计阶段 |
| v/view | 查看某个文件的详细变更 |
| s/skip | 跳过某个变更项 |
| e/edit | 手动编辑变更清单 |

## 确认界面示例

```
实现前确认
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

变更概览
   新建: 5 个文件
   修改: 3 个文件
   删除: 1 个文件

详细清单

新建文件:
   + lib/router/complexity.js      (~120 行)
   + lib/router/flow.js            (~200 行)
   + lib/sync/task-sync.js         (~150 行)
   + test/router.test.js           (~80 行)
   + test/sync.test.js             (~60 行)

修改文件:
   ~ lib/core/engine.js            (+30/-10 行)
   ~ config/seed.config.json       (+15/-0 行)
   ~ SKILL.md                      (+20/-5 行)

删除文件:
   - lib/deprecated/old-router.js  (已备份)

风险提示:
   - 修改 engine.js 可能影响现有功能
   - 建议先运行现有测试确保基线通过

确认开始实现? [Y/n/查看详情/跳过某项]
```

## 配置项

```json
{
  "preImplConfirmation": {
    "enabled": true,
    "batchSize": 10,
    "highRiskConfirmPhrase": "我确认",
    "autoBackup": true,
    "backupDir": ".seed/backups/",
    "skipForQuickFlow": true
  }
}
```

## 回滚信息

| 内容 | 存储位置 |
|------|----------|
| 修改文件备份 | `.seed/backups/{flow-id}/` |
| 变更前 git commit | 记录 SHA |
| 回滚脚本 | `.seed/rollback-{flow-id}.sh` |

## 相关链接

- [规格文件](../../openspec/specs/workflow/pre-impl-confirmation.fspec.md)
- [源代码](../../skills/mob-seed/lib/workflow/pre-impl-confirmation.js)
- [测试](../../skills/mob-seed/test/workflow/pre-impl-confirmation.test.js)
