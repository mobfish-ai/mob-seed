# ACE 自演化机制 - 无缝集成指南

> **核心理念**: ACE 不是独立命令，而是**无缝集成到所有 SEED 命令和 Claude 对话中的自演化层**。
> 用户不需要"运行 ACE"，ACE 应该自动运行。

---

## 设计原则：无感知自动化

```
┌─────────────────────────────────────────────────────────────┐
│  ACE 应该像空气一样存在 - 无处不在但不需要刻意呼吸           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ❌ 错误: 用户需要主动运行 /mob-seed:ace observe             │
│  ✅ 正确: 问题发生时 Claude 自动记录观察                     │
│                                                              │
│  ❌ 错误: 用户需要记得检查 ACE 状态                          │
│  ✅ 正确: /mob-seed 主面板自动显示 ACE 提示                  │
│                                                              │
│  ❌ 错误: 反思需要用户触发特定命令                           │
│  ✅ 正确: 达到阈值时 Claude 主动提议反思                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Claude 行为规范（关键）

### 1. 自动观察触发点

Claude 在以下情况**必须自动创建观察**，无需用户提示：

| 触发场景 | 观察类型 | Claude 行为 |
|----------|----------|-------------|
| 测试失败 | test_failure | 自动记录失败模式、根因分析 |
| 规格漂移 | spec_drift | 自动记录代码与规格不一致 |
| 用户报告问题 | user_feedback | 自动记录问题和上下文 |
| 重复踩坑 | pattern_detected | 自动记录重复问题模式 |
| 工作流问题 | workflow_issue | 自动记录流程障碍 |

### 2. 观察记录模板

当触发观察时，Claude 自动执行：

```javascript
// Claude 内部行为（对用户透明）
const observation = {
  id: `obs-${YYYYMMDD}-${slug}`,
  type: detectType(context),
  status: 'raw',
  source: 'auto',  // 自动触发
  created: new Date().toISOString(),
  description: summarizeProblem(),
  context: {
    scenario: currentTask,
    root_cause: analyzeRootCause(),
    affected_files: getAffectedFiles()
  },
  suggestions: generateSuggestions()
};

writeJson(`.seed/observations/${observation.id}.json`, observation);
updateIndex('.seed/observations/index.json');

// 仅在重要观察时简短通知用户
console.log(`💡 ACE: 已记录观察 ${observation.id}`);
```

### 3. 自动反思触发

当观察累积达到阈值时，Claude **主动提议**（而非自动执行）：

```
检测条件:
- same_type >= 3: 同类型问题出现 3 次
- same_spec >= 2: 同规格问题出现 2 次
- time_window: 24 小时内

Claude 输出:
"💡 ACE 检测到模式：{type} 类型问题已出现 {n} 次
   相关观察: {obs-1}, {obs-2}, {obs-3}
   建议: 是否进行反思分析，提取可复用模式？"

用户确认后 → 执行反思 → 提取模式 → 更新规格/工具
```

---

## 集成到现有命令

### /mob-seed（主入口）

```
🌱 SEED 项目状态
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 规格库: 39 个稳定规格
🔄 同步状态: ✅ 全部同步

🧠 ACE 自演化                          ← 自动显示
   待处理观察: 0
   已提取模式: 1 (pat-release-integrity)
   状态: ✅ 健康

💡 建议行动: ...
```

### /mob-seed:exec（执行测试）

```
🧪 测试结果: 1029/1029 通过

// 如果有失败:
🧪 测试结果: 1027/1029 通过 (2 失败)

   ❌ test/parser/config.test.js
      - parseConfig should handle empty input
      - parseConfig should validate schema

💡 ACE: 已自动记录 2 个测试失败观察      ← 自动触发
   运行 /mob-seed 查看 ACE 状态
```

### /mob-seed:defend（守护检查）

```
📊 规格漂移检查

⚠️ 检测到 1 处漂移:
   - router.fspec.md: 新增 `timeout` 参数未在规格中定义

💡 ACE: 已自动记录规格漂移观察            ← 自动触发
```

---

## 对话中的 ACE 触发

Claude 在**任何对话**中检测到以下模式时，自动触发 ACE：

### 用户反馈模式

```
用户: "这个流程有问题，版本文件没提交完整"
用户: "怎么又出这个错了"
用户: "这个设计不太对"

Claude 内部:
  - 检测到用户反馈
  - 自动创建观察
  - 简短通知: "💡 ACE: 已记录此反馈"
  - 继续解决问题
```

### 重复问题模式

```
用户: "测试又超时了"
用户: "这个模块又报错了"

Claude 内部:
  - 检测到"又"字 = 重复问题
  - 检查是否已有类似观察
  - 如果 same_type >= 3，主动提议反思
```

### 工作流障碍模式

```
用户: "每次发布都要手动检查好多步骤"
用户: "这个操作太繁琐了"

Claude 内部:
  - 检测到工作流改进机会
  - 创建 workflow_issue 观察
  - 在解决问题时同步更新规格/工具
```

---

## 实现要点

### 1. 观察是自动的，反思是提议的

```
观察（Observe）: 自动触发，对用户透明
反思（Reflect）: 达到阈值时提议，用户确认后执行
策展（Curate）:  反思通过后，更新规格/工具/文档
```

### 2. 轻量级通知

```
✅ 好: "💡 ACE: 已记录观察"（一行）
❌ 坏: 详细解释 ACE 机制和流程（打断用户）
```

### 3. 检查 ACE 状态的时机

Claude 在以下时机检查并显示 ACE 状态：
- 运行 `/mob-seed`（主面板）
- 测试失败后
- 规格漂移检测后
- 用户问"项目状态如何"时

---

## 验证 ACE 是否在工作

```bash
# 查看观察目录
ls .seed/observations/

# 查看观察索引
cat .seed/observations/index.json

# 查看已提取的模式
cat .seed/learning/patterns.json
```

如果这些文件在开发过程中自然增长，说明 ACE 正在工作。

---

## 总结

**ACE 不需要用户"运行"，它应该自然发生**

- 问题发生 → 自动记录观察
- 问题重复 → 主动提议反思
- 反思通过 → 自动改进系统
- 用户无感知，系统持续进化
