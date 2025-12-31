---
description: SEED 初始化 - 创建 OpenSpec 标准目录结构
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
argument-hint: [--force]
---

# mob-seed-init

执行内容：$ARGUMENTS

## 📦 依赖资源

```
.claude/skills/mob-seed/
├── lib/lifecycle/
│   └── parser.js           # 规格解析
├── lib/mission/
│   └── loader.js           # Mission 加载器
├── adapters/
│   └── seed-utils.js       # 工具模块
└── templates/
    └── openspec/           # OpenSpec 模板
        ├── mission.yaml    # Mission Statement 模板
        ├── project.md      # 项目约定模板
        └── AGENTS.md       # AI 工作流模板
```

## 设计理念

**OpenSpec 原生 + 零侵入**：
- 创建 OpenSpec 标准目录结构
- 只创建 `.seed/` 隐藏目录存放配置
- 智能扫描识别现有项目结构

## 执行步骤

### 步骤0: 检查参数

**参数检查**：
- 无参数：进入 **OpenSpec 初始化**（步骤 1）
- `--force`：强制重新初始化

**检查已初始化**：
- 如果 `.seed/config.json` 存在且无 `--force`：显示当前配置，询问是否重新初始化
- 如果有 `--force`：备份后重新初始化

### 步骤1: 创建 OpenSpec 目录结构

创建 OpenSpec 标准目录结构：

```
project/
├── openspec/
│   ├── specs/                    # 真相源（已实现的规格）
│   │   └── .gitkeep
│   ├── changes/                  # 变更提案（开发中的规格）
│   │   └── .gitkeep
│   ├── project.md                # 项目约定
│   └── AGENTS.md                 # AI 工作流指令
├── .seed/
│   ├── config.json               # SEED 配置
│   └── mission.yaml              # Mission Statement（项目使命）
└── ...
```

**执行操作**：
1. 创建 `openspec/specs/` 目录
2. 创建 `openspec/changes/` 目录
3. 复制 `project.md` 模板到 `openspec/project.md`
4. 复制 `AGENTS.md` 模板到 `openspec/AGENTS.md`
5. 生成 `.seed/config.json`
6. 复制 `mission.yaml` 模板到 `.seed/mission.yaml`（替换 `{{TIMESTAMP}}` 为当前时间）

**输出**：
```
✅ OpenSpec 结构已创建

openspec/
├── specs/          # 真相源（已实现的规格）
├── changes/        # 变更提案
├── project.md      # 项目约定
└── AGENTS.md       # AI 工作流

.seed/
├── config.json     # SEED 配置
└── mission.yaml    # 项目使命声明（ACE 自演化指南）

下一步:
1. 编辑 .seed/mission.yaml 定义项目使命和原则
2. 编辑 openspec/project.md 填写项目信息
3. 创建规格提案: /mob-seed-spec --proposal "feature-name"
4. 查看状态: /mob-seed-status
```

### 步骤2: 保存配置并完成

```bash
mkdir -p .seed
# 写入配置文件
```

输出完成信息：

```
✅ SEED 初始化完成

配置文件: .seed/config.json

下一步:
1. 检查配置: cat .seed/config.json
2. 创建规格: /mob-seed-spec "功能名称"
3. 查看状态: /mob-seed-status
```

## 参数说明

| 参数 | 说明 |
|------|------|
| （无参数） | **创建 OpenSpec 标准目录结构** |
| `--force` | 强制重新初始化（备份现有配置） |

## 示例用法

```bash
# 初始化 OpenSpec 结构（默认）
/mob-seed-init

# 强制重新初始化
/mob-seed-init --force
```

## 配置文件详解

`.seed/config.json` 完整格式：

```json
{
  "version": "2.0.0",
  "created": "ISO时间戳",
  "updated": "ISO时间戳",

  "openspec": {
    "enabled": true,
    "root": "openspec",
    "specsDir": "specs",
    "changesDir": "changes"
  },

  "mission": {
    "enabled": true,
    "path": ".seed/mission.yaml",
    "language": "en"
  },

  "paths": {
    "specs": "openspec/specs",
    "src": "src",
    "test": "test",
    "docs": "docs",
    "output": ".seed/output"
  },

  "patterns": {
    "spec": "*.fspec.md",
    "code": "*.js",
    "test": "*.test.js"
  },

  "emit": {
    "codeTemplate": "skeleton",
    "testTemplate": "jest",
    "docTemplate": "markdown"
  },

  "sync": {
    "autoBackup": true,
    "defaultDirection": "spec"
  }
}
```

**mission 配置说明**：
| 字段 | 说明 | 默认值 |
|------|------|--------|
| `enabled` | 是否启用 Mission Statement | `true` |
| `path` | Mission 文件路径 | `.seed/mission.yaml` |
| `language` | 默认显示语言 (`en`/`zh`) | `en` |
