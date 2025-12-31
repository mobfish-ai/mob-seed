---
description: 编辑规格文件并触发重新派生
allowed-tools: Read, Write, Edit, Bash, Task
argument-hint: <spec-file> [--add-fr|--add-ac|--update]
---

# SEED 规格编辑助手

编辑目标: $ARGUMENTS

## 执行步骤

### 步骤1: 读取当前规格

```bash
# 解析参数
SPEC_FILE="${ARGUMENTS%% *}"

if [ ! -f "$SPEC_FILE" ]; then
  echo "❌ 规格文件不存在: $SPEC_FILE"
  exit 1
fi
```

读取规格文件内容，分析当前状态。

### 步骤2: 确定编辑类型

| 编辑类型 | 说明 | 触发条件 |
|----------|------|----------|
| `--add-fr` | 添加功能需求 | 新增功能 |
| `--add-ac` | 添加验收标准 | 新增测试场景 |
| `--update` | 更新现有内容 | 需求变更 |
| 无参数 | 交互式编辑 | 默认 |

### 步骤3: 编辑规格

#### 添加功能需求 (FR)
```markdown
- [ ] FR-XXX: {需求描述}
```

#### 添加验收标准 (AC)
```markdown
### AC-XXX: {标准名称}
- **Given**: {前置条件}
- **When**: {操作}
- **Then**:
  - {期望结果}
```

### 步骤4: 更新版本和变更记录

```markdown
> 最后更新: YYYY-MM-DD

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.1 | YYYY-MM-DD | {变更描述} | {作者} |
```

### 步骤5: 触发重新派生

编辑完成后提示：
```
✅ 规格已更新: {spec-file}
   变更: +{n} FR, +{m} AC

下一步操作:
  /mob-seed-emit {spec-file}   # 重新派生代码
  /mob-seed-exec {spec-file}   # 运行测试验证
  /mob-seed-sync {spec-file}   # 一键同步
```

## 编辑规范

### 需求编号规则
- FR-001 ~ FR-999: 功能需求
- NFR-001 ~ NFR-999: 非功能需求
- AC-001 ~ AC-999: 验收标准

### 状态标记
- `[ ]` 待实现
- `[x]` 已实现
- `[-]` 已废弃

### 变更类型
- `新增`: 添加新的需求或标准
- `修改`: 更新现有内容
- `废弃`: 标记不再需要的条目
- `重构`: 重新组织但不改变含义

## 示例

### 添加新功能需求
```bash
/mob-seed-edit specs/user-auth.fspec.md --add-fr "用户可以使用手机号登录"
```

### 添加验收标准
```bash
/mob-seed-edit specs/user-auth.fspec.md --add-ac "手机号登录成功" \
  --given "用户输入有效手机号和验证码" \
  --when "点击登录按钮" \
  --then "跳转到首页，显示用户信息"
```

### 交互式编辑
```bash
/mob-seed-edit specs/user-auth.fspec.md
# 进入交互模式，AI 辅助编辑
```
