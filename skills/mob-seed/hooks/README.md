# SEED Git Hooks 架构说明

## 运行场景完整规划

SEED Git Hooks 支持五种运行场景，通过四层回退策略自动检测：

| 场景 | 代号 | 颜色标识 | 描述 | 脚本来源路径 |
|------|------|----------|------|--------------|
| **开发模式** | `dogfooding` | 青色 `[开发模式]` | mob-seed 项目自身开发 | `skills/mob-seed/lib/hooks/` |
| **用户项目（环境变量）** | `user-env` | 洋红 `[用户项目]` | init 时设置 SEED_PLUGIN_PATH | `$SEED_PLUGIN_PATH/lib/hooks/` |
| **用户项目（插件路径）** | `user-plugin` | 洋红 `[用户项目]` | Claude Code 插件默认路径 | `~/.claude/plugins/.../lib/hooks/` |
| **兼容模式** | `compat` | 黄色 `[兼容模式]` | 旧版本符号链接 | `.seed/scripts/` |
| **脚本缺失** | `missing` | 红色 `[错误]` | 找不到验证脚本 | 无 |

## 场景 A: mob-seed 项目自身（Dogfooding）

```
mob-seed/
├── .seed/
│   ├── scripts → ../skills/mob-seed/scripts  (符号链接)
│   └── hooks → ../skills/mob-seed/hooks      (符号链接)
├── skills/mob-seed/
│   ├── lib/hooks/                            (验证逻辑)
│   ├── scripts/                              (用户工具)
│   └── hooks/                                (Hook 模板)
└── .git/hooks/
    ├── pre-commit                            (从 skills/mob-seed/hooks 复制)
    └── pre-push                              (从 skills/mob-seed/hooks 复制)
```

**特点**:
- `.seed/scripts` 和 `.seed/hooks` 是符号链接
- Hook 脚本使用 **Layer 1** 路径找到 `skills/mob-seed/lib/hooks/`
- 输出: `🔍 SEED 快速检查... [开发模式] mob-seed dogfooding`
- 自我测试，确保发布产品可用

## 场景 B: 用户项目（如 mars-nexus）

```
user-project/
├── .seed/
│   ├── config.json                           (配置文件)
│   └── mission.md                            (使命声明)
│   (无 scripts/hooks 目录)
└── .git/hooks/
    ├── pre-commit                            (由 init 安装)
    └── pre-push                              (由 init 安装)

~/.claude/plugins/
└── mobfish-ai/mob-seed/                      (Claude Code 插件安装位置)
    └── skills/mob-seed/
        ├── lib/hooks/                        (验证逻辑)
        ├── scripts/                          (用户工具)
        └── hooks/                            (Hook 模板源)
```

**特点**:
- `.seed/` 目录不包含 scripts/hooks
- Hook 脚本使用 **Layer 3** 路径找到 `~/.claude/plugins/.../lib/hooks/`
- 或使用 **Layer 0** 环境变量 `SEED_PLUGIN_PATH`
- 输出: `🔍 SEED 快速检查... [用户项目] Claude Code 插件`

## 四层回退策略

Hook 脚本查找验证逻辑时，按以下顺序尝试：

| Layer | 路径 | 场景代号 | 适用场景 |
|-------|------|----------|----------|
| 0 | `$SEED_PLUGIN_PATH/lib/hooks/` | `user-env` | 用户项目（init 设置环境变量） |
| 1 | `skills/mob-seed/lib/hooks/` | `dogfooding` | mob-seed 项目 dogfooding |
| 2 | `.seed/scripts/` | `compat` | 向后兼容旧版本 |
| 3 | `~/.claude/plugins/.../lib/hooks/` | `user-plugin` | 用户项目（默认插件路径） |

## 场景检测模块

`lib/hooks/scenario.js` 提供统一的场景检测逻辑：

```javascript
const { detectScenario, formatLabel, isDevelopment, isUserProject } = require('./scenario');

const { scenario, pluginPath } = detectScenario();

console.log(formatLabel(scenario));  // [开发模式] mob-seed dogfooding

if (isDevelopment(scenario)) {
  // 开发模式特定逻辑
}

if (isUserProject(scenario)) {
  // 用户项目特定逻辑
}
```

## init 命令行为

| 目标项目 | 行为 |
|----------|------|
| mob-seed | 检测到 `skills/mob-seed/`，跳过 hooks 安装（使用 dogfooding） |
| 用户项目 | 从插件复制 hooks 到 `.git/hooks/`，可选注入 `SEED_PLUGIN_PATH` |

## 验证命令

### 验证 mob-seed 项目（开发模式）

```bash
cd mob-seed

# 验证符号链接
ls -la .seed/scripts  # 应显示 → ../skills/mob-seed/scripts
ls -la .seed/hooks    # 应显示 → ../skills/mob-seed/hooks

# 验证 hooks 可执行
.git/hooks/pre-commit  # 应显示 [开发模式]

# 验证 Layer 1 路径
ls skills/mob-seed/lib/hooks/quick-defender.js  # 应存在
```

### 验证用户项目

```bash
cd user-project

# 验证无 scripts/hooks 目录
ls .seed/  # 只应有 config.json, mission.md 等

# 验证 hooks 已安装
ls .git/hooks/pre-commit  # 应存在

# 验证环境变量（如果使用）
grep SEED_PLUGIN_PATH .git/hooks/pre-commit

# 触发 hook 检查输出
echo "test" > test.js
git add test.js
git commit --dry-run  # 应显示 [用户项目]
```

## 日志输出示例

### 开发模式
```
🔍 SEED 快速检查... [开发模式] mob-seed dogfooding
✅ SEED 快速检查通过
```

### 用户项目
```
🔍 SEED 快速检查... [用户项目] Claude Code 插件
⚠️  1 个警告:
   • src/utils.js: 无对应规格文件（可能是工具/配置文件）
✅ SEED 快速检查通过
```

### 错误模式
```
🔍 SEED 快速检查... [错误] 未找到验证脚本
⚠️  未找到快速检查脚本，跳过验证
   请确认 mob-seed 插件已正确安装
```

## 常见问题

### Q: 用户项目的 hooks 找不到验证脚本怎么办？

**A**: 检查以下几点：
1. Claude Code 插件是否正确安装（`ls ~/.claude/plugins/`）
2. 环境变量 `SEED_PLUGIN_PATH` 是否设置
3. 插件路径结构是否正确

### Q: 如何手动设置 SEED_PLUGIN_PATH？

```bash
# 在 .git/hooks/pre-commit 开头添加
export SEED_PLUGIN_PATH="$HOME/.claude/plugins/mobfish-ai/mob-seed/skills/mob-seed"
```

### Q: 如何跳过 hooks 检查？

```bash
SKIP_SEED_CHECK=1 git commit -m "紧急修复"
```

### Q: 如何区分当前是哪种模式？

查看 hook 输出的场景标识：
- `[开发模式]` + 青色 = dogfooding
- `[用户项目]` + 洋红 = user-env 或 user-plugin
- `[兼容模式]` + 黄色 = compat
- `[错误]` + 红色 = missing

### Q: 为什么开发模式和用户项目要区分？

| 维度 | 开发模式 | 用户项目 |
|------|----------|----------|
| 脚本来源 | 本地 skills/ | 插件安装目录 |
| 符号链接 | 有 (.seed/) | 无 |
| 更新方式 | 直接编辑 | 插件更新 |
| 调试信息 | 详细 (--verbose) | 简洁 |
| 错误处理 | 严格 | 宽容 |
