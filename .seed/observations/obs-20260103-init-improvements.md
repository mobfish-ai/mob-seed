---
id: obs-20260103-init-improvements
type: user_feedback
source: manual
created: 2026-01-03T16:30:00+08:00
updated: 2026-01-03T16:30:00+08:00
status: raw
---

# Init 命令三大问题

## 观察描述

用户在 mars-nexus 项目中执行 `/mob-seed:init` 后发现三个问题：

### 问题1: mission 模板错误
**现象**: `.seed/mission.md` 被填充为 mob-seed 自己的完整 mission（包含 "MOB-SEED MISSION STATEMENT"）

**期望**: 使用通用项目 mission 模板

**影响**: 用户需要手动清理 mob-seed 专有内容，体验差

### 问题2: 路径配置硬编码
**现象**: `.seed/config.json` 中的路径使用硬编码默认值：
```json
{
  "paths": {
    "specs": "openspec/specs",
    "src": "src",     // 错误：mars-nexus 实际是 "server"
    "test": "test",
    "docs": "docs"
  }
}
```

**期望**: 智能检测项目实际目录结构

**影响**: 配置与实际项目不符，导致 emit/defend 等命令路径错误

### 问题3: project.md 无智能填充
**现象**: `openspec/project.md` 使用模板占位符 `{项目名称}`、`{描述}`等，用户需要手动填写

**期望**: 从 package.json、目录结构等自动提取信息填充模板

**影响**: 增加初始化成本，降低用户体验

## 根因分析

**commands/init.md 步骤1.6**:
> 复制 `mission.md` 模板到 `.seed/mission.md`（替换 `{{TIMESTAMP}}` 为当前时间）

未明确指定应使用 `templates/openspec/mission.yaml` 而非 mob-seed 自己的 mission.md

**config.json 生成逻辑**:
未实现项目目录智能检测，直接使用硬编码默认值

**project.md 复制逻辑**:
未实现从 package.json 提取项目信息填充模板

## 建议解决方案

### 方案1: 修改命令文档（短期）
更新 `commands/init.md` 步骤1.6，明确指定：
- mission.md: 使用 `templates/openspec/mission.yaml`
- 替换 `{{TIMESTAMP}}` 为当前时间
- 不使用 mob-seed 自己的 `.seed/mission.md`

### 方案2: 创建智能检测脚本（中期）
创建 `scripts/detect-project-structure.js`:
```javascript
// 检测项目目录结构
function detectPaths(projectRoot) {
  const candidates = {
    src: ['src', 'lib', 'server', 'app'],
    test: ['test', 'tests', '__tests__', 'spec'],
    docs: ['docs', 'documentation', 'doc']
  };

  // 扫描目录，返回实际存在的路径
}

// 从 package.json 提取项目信息
function extractProjectInfo(projectRoot) {
  const pkg = require(path.join(projectRoot, 'package.json'));
  return {
    name: pkg.name,
    description: pkg.description,
    version: pkg.version,
    // ... 更多字段
  };
}
```

### 方案3: 更新 init 流程集成智能检测（推荐）
修改 `commands/init.md`，在步骤1中增加：
- 步骤1.5: 智能检测项目结构（调用脚本）
- 步骤1.6: 使用检测结果生成 config.json
- 步骤1.7: 从 package.json 提取信息填充 project.md
- 步骤1.8: 使用 mission.yaml 模板而非 mob-seed mission

## 优先级建议

| 问题 | 优先级 | 原因 |
|------|--------|------|
| mission 模板 | P1 (高) | 影响范围大，用户困惑 |
| 路径检测 | P0 (紧急) | 影响核心功能（emit/defend） |
| project.md | P2 (中) | 体验优化，非阻塞 |

## 关联资源

- 命令文档: `commands/init.md`
- Mission 模板: `skills/mob-seed/templates/openspec/mission.yaml`
- Project 模板: `skills/mob-seed/templates/openspec/project.md`
- 配置示例: `.seed/config.json`
