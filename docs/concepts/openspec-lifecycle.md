# OpenSpec 生命周期

> 规格文件的状态管理与归档流程

## 状态流转

```
draft → review → implementing → archived
  ↑                               │
  └───────── 重新开启 ─────────────┘
```

### draft (草稿)

- **说明**: 初始状态，可自由修改
- **位置**: `openspec/changes/{proposal-name}/`
- **操作**: 编辑规格内容
- **下一步**: 提交评审 → review

### review (评审)

- **说明**: 等待确认，准备实现
- **位置**: `openspec/changes/{proposal-name}/`
- **操作**: 审查规格完整性
- **下一步**: 确认开始 → implementing

### implementing (实现中)

- **说明**: 正在派生代码和测试
- **位置**: `openspec/changes/{proposal-name}/`
- **操作**:
  - `/mob-seed-emit` 派生代码
  - `/mob-seed-exec` 运行测试
  - `/mob-seed-defend` 检查同步
- **下一步**: 完成归档 → archived

### archived (已归档)

- **说明**: 功能完成，进入历史
- **位置**: `openspec/archive/{proposal-name}/`
- **操作**: 只读，不可修改
- **下一步**: 如需修改，创建新提案

## 目录结构

```
openspec/
├── changes/                    # 进行中的变更
│   └── {proposal-name}/
│       ├── proposal.md         # 提案说明
│       ├── specs/              # 规格文件
│       │   └── *.fspec.md
│       └── tasks.md            # 任务跟踪
├── specs/                      # 稳定规格（真相源）
│   └── {domain}/
│       └── *.fspec.md
└── archive/                    # 已归档历史
    └── {proposal-name}/
        ├── proposal.md
        └── specs/
```

## 归档流程

### 前置条件

1. 所有测试通过
2. AC 全部标记 `[x]`
3. 文档已生成
4. 状态为 `implementing`

### 归档步骤

```bash
# 1. 检查状态
/mob-seed-status

# 2. 运行测试
/mob-seed-exec

# 3. 检查同步
/mob-seed-defend

# 4. 执行归档
/mob-seed-archive {proposal-name}
```

### 归档操作

1. Delta 合并到 `specs/` 真相源
2. 提案移动到 `archive/`
3. 状态更新为 `archived`
4. 生成归档报告

## Delta 合并

归档时，Delta 语法合并到稳定规格：

### ADDED

新增内容追加到真相源：

```markdown
# 归档前 (changes/)
## ADDED Requirements
### REQ-003: 新功能

# 归档后 (specs/)
### REQ-003: 新功能
```

### MODIFIED

修改内容替换原有：

```markdown
# 归档前 (changes/)
## MODIFIED Requirements
### REQ-001: 修改后的描述

# 归档后 (specs/)
### REQ-001: 修改后的描述
```

### REMOVED

删除内容从真相源移除：

```markdown
# 归档前 (changes/)
## REMOVED Requirements
### REQ-002: 要删除的功能

# 归档后 (specs/)
# REQ-002 已删除
```

## 版本管理

### 规格版本

每个规格文件包含版本号：

```markdown
> 版本: 1.2.0
```

遵循语义化版本：
- Major: 破坏性变更
- Minor: 新增功能
- Patch: 修复/优化

### 提案命名

推荐格式：`v{version}-{feature}`

示例：
- `v2.0-seed-complete`
- `v2.1-command-unify`

## 相关文档

- [SEED 方法论](./seed-methodology.md)
- [规格编写指南](../guide/writing-specs.md)
