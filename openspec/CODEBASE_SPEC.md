# mob-seed 代码规格概览

> 自动生成于: 2025-12-31
> 生成方式: /mob-seed:spec 逆向同步

## 项目概述

mob-seed 是 SEED 方法论的 Claude Code 插件实现，提供规格驱动开发的完整工作流，与 OpenSpec 规范完全兼容。

## 模块结构

| 模块 | 路径 | 功能 | 规格文件 |
|------|------|------|----------|
| lifecycle | skills/mob-seed/lib/lifecycle/ | OpenSpec 生命周期管理（解析、归档、迁移） | specs/lifecycle/parser.fspec.md |
| stacks | skills/mob-seed/lib/stacks/ | 技术栈包运行时加载与匹配 | specs/stacks/loader.fspec.md |
| adapters | skills/mob-seed/adapters/ | SEED 核心工具函数 | specs/adapters/seed-utils.fspec.md |
| commands | commands/ | Claude Code 命令定义 | specs/commands/commands.fspec.md |

## 模块详情

### 1. lifecycle - 生命周期管理

**路径**: `skills/mob-seed/lib/lifecycle/`

**文件**:
- `parser.js` - 规格文件解析器
- `archiver.js` - 变更提案归档
- `types.js` - 类型定义

**核心能力**:
- 元数据解析（状态、版本、技术栈、派生路径）
- Delta 需求解析（ADDED/MODIFIED/REMOVED）
- 规格状态更新
- 变更提案扫描
- 状态概览生成

**规格覆盖**: 7 个功能需求 (REQ)，17 个验收标准 (AC)

### 2. stacks - 技术栈加载器

**路径**: `skills/mob-seed/lib/stacks/`

**文件**:
- `loader.js` - StackLoader 类
- `resolver.js` - 栈解析
- `types.js` - 类型定义

**核心能力**:
- 运行时扫描 stacks/ 目录
- 按扩展名匹配技术栈
- 解析技术栈声明字符串
- 获取派生提示模板
- 获取规格模板

**规格覆盖**: 6 个功能需求 (REQ)，12 个验收标准 (AC)

### 3. adapters - SEED 工具函数

**路径**: `skills/mob-seed/adapters/`

**文件**:
- `seed-utils.js` - 核心工具函数
- `defend-checker.js` - 漂移检测
- `emit-engine.js` - 派生引擎

**核心能力**:
- 配置管理（加载、保存、默认值合并）
- 项目结构智能扫描
- 规格文件扫描
- 规格状态检查
- 差异检测（FR/AC 覆盖率）
- 代码/测试骨架生成

**规格覆盖**: 10 个功能需求 (REQ)，25 个验收标准 (AC)

### 4. commands - SEED 命令系统

**路径**: `commands/`

**文件**:
- `seed.md` - 智能入口（状态面板 + 建议行动）
- `init.md` - 项目初始化
- `spec.md` - 规格定义
- `emit.md` - 自动派生
- `exec.md` - 自动执行
- `defend.md` - 守护规范
- `archive.md` - 归档提案

**命令架构**:
```
/mob-seed:seed            # 智能入口（状态面板 + 建议行动）
├── /mob-seed:init        # 项目初始化
├── /mob-seed:spec        # S: 规格定义
├── /mob-seed:emit        # E: 自动派生
├── /mob-seed:exec        # E: 自动执行
├── /mob-seed:defend      # D: 守护规范
└── /mob-seed:archive     # 归档提案
```

**规格覆盖**: 7 个功能需求 (REQ)，21 个验收标准 (AC)

## 依赖关系

```
commands/
    └── depends on → adapters/seed-utils.js
                  → lib/lifecycle/parser.js
                  → lib/stacks/loader.js

adapters/seed-utils.js
    └── depends on → lib/lifecycle/parser.js

lib/lifecycle/parser.js
    └── standalone (no internal deps)

lib/stacks/loader.js
    └── standalone (no internal deps)
```

## 同步状态

| 模块 | 规格文件 | 状态 |
|------|----------|------|
| lifecycle | parser.fspec.md | archived |
| stacks | loader.fspec.md | archived |
| adapters | seed-utils.fspec.md | archived |
| commands | commands.fspec.md | archived |

## 统计汇总

| 指标 | 数值 |
|------|------|
| 规格文件总数 | 4 |
| 功能需求 (REQ) 总数 | 34 |
| 验收标准 (AC) 总数 | 87 |
| 代码模块覆盖率 | 100% |

## 下一步

1. 审查生成的规格文件，补充业务细节
2. 运行 `/mob-seed:seed` 验证同步状态
3. 使用 `/mob-seed:defend --diff` 检查规格与代码的详细差异
4. 根据需要创建变更提案 `/mob-seed:spec --proposal "feature-name"`
