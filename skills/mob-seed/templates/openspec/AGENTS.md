# AI Agent 工作流指令

> 本文件定义 AI 工具在本项目中的工作流程和规范。
> 文件位置: `openspec/AGENTS.md`

---

## SEED 方法论

本项目使用 **SEED (Spec → Emit → Execute → Defend)** 方法论进行开发，与 OpenSpec 规范完全兼容。

### 核心原则

| 原则 | 说明 |
|------|------|
| **Spec-First** | 先写规格，再写代码 |
| **Single-Source** | 规格是唯一真相源 |
| **Auto-Derive** | 代码/测试从规格自动派生 |
| **Guard-Sync** | 守护规格与代码的同步 |

---

## OpenSpec 生命周期

```
Draft → Implementing → Archived
  ↓          ↓            ↓
changes/   开发中       specs/
```

### 状态说明

| 状态 | 目录 | 说明 |
|------|------|------|
| `draft` | changes/ | 规格编写中 |
| `implementing` | changes/ | 代码实现中 |
| `archived` | specs/ | 已完成并归档 |

---

## 工作流程

### 1. 创建规格提案

```bash
/mob-seed:spec "feature-name"
```

创建 `openspec/changes/feature-name/` 目录，包含：
- `proposal.md` - 变更提案
- `specs/` - Delta 规格文件

### 2. 编辑规格

使用 **OpenSpec Delta 语法** 编写规格文件。

规格文件命名: `{module}.fspec.md`

状态: `draft` → `implementing`

### 3. 派生代码

```bash
/mob-seed:emit
```

根据规格自动生成：
- 代码骨架（基于 `.seed/config.json` 中的 `paths.src`）
- 测试用例（基于 `paths.test`）
- 文档（基于 `paths.docs`）

### 4. 执行测试

```bash
/mob-seed:exec
```

运行测试，验证实现是否符合规格。

### 5. 守护同步

```bash
/mob-seed:defend
```

检查规格与代码的同步状态，确保一致性。

### 6. 归档规格

```bash
/mob-seed:archive "feature-name"
```

将 Delta 规格合并到 `specs/`，变更提案移动到 `archive/`。

状态变更: `implementing` → `archived`

---

## 规格格式 (fspec)

fspec = OpenSpec Delta + SEED 元数据

### Delta 语法

| 标记 | 说明 |
|------|------|
| `## ADDED` | 新增的需求 |
| `## CHANGED` | 修改的需求 |
| `## REMOVED` | 删除的需求 |

### 示例

```markdown
---
状态: implementing
模块: authentication
类型: feature
---

# 用户认证模块

## ADDED

### FR-001: 用户登录
用户可以使用邮箱和密码登录系统。

#### AC-001: 验证邮箱格式
- [ ] 输入无效邮箱时，显示格式错误提示
- [ ] 输入有效邮箱时，验证通过
```

---

## 命令参考

| 命令 | 说明 |
|------|------|
| `/mob-seed:init` | 初始化 OpenSpec 结构 |
| `/mob-seed:seed` | 查看项目状态和建议 |
| `/mob-seed:spec` | 创建/管理规格 |
| `/mob-seed:emit` | 派生代码/测试/文档 |
| `/mob-seed:exec` | 执行测试 |
| `/mob-seed:defend` | 守护规格与代码同步 |
| `/mob-seed:archive` | 归档完成的变更 |

---

## 配置文件

### .seed/config.json

项目配置文件，定义路径和行为：

```json
{
  "paths": {
    "specs": "openspec/specs",
    "src": "检测到的源码目录",
    "test": "检测到的测试目录",
    "docs": "检测到的文档目录"
  }
}
```

### .seed/mission.md

项目使命声明，定义：
- 项目目标和愿景
- 核心原则和反目标
- AI 与人类协作的契约

---

## 最佳实践

### 规格编写

1. **一次一个功能**: 每个提案专注于单一功能
2. **可测试的 AC**: 每个 AC 必须可以通过测试验证
3. **清晰的依赖**: 明确标注对其他模块的依赖

### 代码实现

1. **先测试后代码**: emit 会生成测试骨架，先让测试通过
2. **增量开发**: 一次实现一个 AC
3. **及时守护**: 定期运行 `/mob-seed:defend` 检查同步

### 归档时机

满足以下条件时归档：
- ✅ 所有 AC 的测试通过
- ✅ 代码与规格同步（defend 无警告）
- ✅ 文档已更新

---

## 故障排除

### 问题: emit 生成的路径不对

**原因**: `.seed/config.json` 路径配置与项目不符

**解决**: 检查 `config.json` 中的 `paths` 配置是否正确

### 问题: defend 报告规格与代码不同步

**原因**: 代码修改后未更新规格

**解决**:
1. 确认代码变更是否必要
2. 如必要，更新对应的规格文件
3. 重新运行 `/mob-seed:defend`

### 问题: 归档失败

**原因**: 可能有测试未通过或同步检查失败

**解决**:
1. 运行 `/mob-seed:exec` 确保测试通过
2. 运行 `/mob-seed:defend` 确保同步
3. 修复问题后重新归档

---

## 更多信息

- SEED 方法论详细文档: 查看 `.seed/mission.md`
- OpenSpec 规范: https://openspec.dev
- 项目约定: 查看 `openspec/project.md`
