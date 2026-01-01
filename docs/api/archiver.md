# OpenSpec Archiver (规格归档器)

> OpenSpec 提案归档与 Delta 合并

## 概述

OpenSpec 归档逻辑，支持归档前置条件检查、Delta 规格合并到真相源、批量归档操作。

## 安装

```javascript
const {
  checkArchivePreConditions,
  extractDomain,
  mergeDeltaToSpec,
  formatRequirement,
  archiveProposal,
  getArchivableProposals,
  archiveAll
} = require('mob-seed/lib/lifecycle/archiver');
```

## API

### checkArchivePreConditions(proposalPath, options)

检查归档前置条件。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| proposalPath | string | 提案目录路径 |
| options | Object | 选项 |
| options.force | boolean | 是否跳过测试检查 (默认: false) |

**返回:**

```javascript
{
  canArchive: boolean,    // 是否可归档
  currentState: string,   // 当前状态
  testsPass: boolean,     // 测试是否通过
  filesComplete: boolean, // 文件是否完整
  issues: string[]        // 问题列表
}
```

**示例:**

```javascript
const preCheck = checkArchivePreConditions('openspec/changes/add-auth');
if (preCheck.canArchive) {
  console.log('可以归档');
} else {
  console.log('问题:', preCheck.issues);
}
```

### extractDomain(filePath)

从文件路径提取领域名称。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| filePath | string | 规格文件路径 |

**返回:** `string` - 领域名称

**示例:**

```javascript
const domain = extractDomain('openspec/changes/add-oauth/specs/auth/oauth.fspec.md');
// 'auth'

const domain2 = extractDomain('openspec/changes/add-oauth/specs/oauth.fspec.md');
// 'oauth'
```

### mergeDeltaToSpec(targetSpecPath, delta, options)

合并 Delta 规格到目标真相源。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| targetSpecPath | string | 目标规格文件路径 |
| delta | Object | Delta 规格对象 |
| delta.added | Array | 新增需求 |
| delta.modified | Array | 修改需求 |
| delta.removed | Array | 删除需求 |
| options | Object | 选项 |
| options.dryRun | boolean | 是否仅预览 (默认: false) |

**返回:**

```javascript
{
  success: boolean,     // 是否成功
  targetPath: string,   // 目标路径
  added: string[],      // 已添加的需求 ID
  modified: string[],   // 已修改的需求 ID
  removed: string[],    // 已删除的需求 ID
  errors: string[]      // 错误列表
}
```

**示例:**

```javascript
const result = mergeDeltaToSpec('openspec/specs/auth/spec.fspec.md', {
  added: [{ id: 'REQ-001', title: '用户登录' }],
  modified: [],
  removed: []
}, { dryRun: true });
```

### formatRequirement(req)

格式化需求为 Markdown。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| req | Object | 需求对象 |
| req.id | string | 需求 ID |
| req.title | string | 需求标题 |
| req.description | string | 需求描述 (可选) |
| req.scenarios | Array | 场景列表 (可选) |
| req.acceptance | Array | 验收标准 (可选) |

**返回:** `string` - Markdown 格式的需求

**示例:**

```javascript
const md = formatRequirement({
  id: 'REQ-001',
  title: '用户登录',
  scenarios: [{ name: '正常登录', when: '输入正确密码', then: '登录成功' }],
  acceptance: ['AC-001: 登录后跳转首页']
});
```

### archiveProposal(proposalName, openspecRoot, options)

执行归档操作。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| proposalName | string | 提案名称 |
| openspecRoot | string | OpenSpec 根目录 |
| options | Object | 选项 |
| options.dryRun | boolean | 是否仅预览 (默认: false) |
| options.force | boolean | 是否强制归档 (默认: false) |

**返回:**

```javascript
{
  success: boolean,       // 是否成功
  proposalName: string,   // 提案名称
  archivePath: string,    // 归档路径
  deltaSummary: Object,   // Delta 合并摘要
  errors: string[],       // 错误列表
  warnings: string[]      // 警告列表
}
```

**示例:**

```javascript
const result = archiveProposal('add-oauth', 'openspec', { dryRun: true });
if (result.success) {
  console.log('归档到:', result.archivePath);
}
```

### getArchivableProposals(openspecRoot)

获取所有可归档的提案。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| openspecRoot | string | OpenSpec 根目录 |

**返回:** `string[]` - 可归档的提案名称列表

**示例:**

```javascript
const proposals = getArchivableProposals('openspec');
// ['add-oauth', 'fix-login']
```

### archiveAll(openspecRoot, options)

批量归档所有可归档的提案。

**参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| openspecRoot | string | OpenSpec 根目录 |
| options | Object | 选项 (同 archiveProposal) |

**返回:** `ArchiveResult[]` - 归档结果列表

**示例:**

```javascript
const results = archiveAll('openspec');
console.log(`归档了 ${results.filter(r => r.success).length} 个提案`);
```

## 相关模块

- [parser](./parser.md) - 规格解析
- [types](./types.md) - 状态类型定义
