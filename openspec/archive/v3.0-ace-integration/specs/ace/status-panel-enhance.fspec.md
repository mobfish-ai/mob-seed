---
status: archived
archived: 2026-01-02
version: 1.0.0
tech_stack: JavaScript
derived_path: skills/mob-seed/lib/ux/
---
# Feature: 状态面板增强 - 观察统计显示
## 概述 (Overview)

增强现有的状态面板，显示观察统计信息。让用户在运行 `/mob-seed` 或 `/mob-seed:status` 时能看到待处理的观察数量和状态分布。

### 目标用户

- 使用 mob-seed 的开发者
- 团队负责人（跟踪观察处理进度）

### 业务约束

- 增强现有 progress-panel.js，不创建新模块
- 观察统计作为面板的一个新区块
- 不改变现有面板的核心逻辑

---

## MODIFIED Requirements

### REQ-001: 状态面板观察区块

The system SHALL display observation statistics in the status panel.

**Scenario: 显示观察统计**
- GIVEN 存在多个观察
- WHEN 运行 `/mob-seed` 或 `/mob-seed:status`
- THEN 面板显示观察统计区块

**显示格式**:

```
━━━ 📊 SEED 状态 ━━━

📋 规格状态
  活跃提案: v3.0-ace-integration (implementing)
  稳定规格: 23 个

🔬 观察状态                    ← 新增区块
  待处理: 5 条 (raw)
  已归类: 3 条 (triaged)
    P1: 1 条
    P2: 2 条
  已提升: 2 条 → 提案
  已忽略: 1 条

💡 运行 `/mob-seed:spec observe --list` 查看详情
   运行 `/mob-seed:spec triage --batch raw` 批量归类
```

**Acceptance Criteria:**
- [ ] AC-001: 在状态面板添加"观察状态"区块
- [ ] AC-002: 显示各状态数量统计
- [ ] AC-003: triaged 状态按优先级细分
- [ ] AC-004: 显示操作提示

---

### REQ-002: 观察统计数据获取

The system SHALL efficiently fetch observation statistics for display.

**Scenario: 读取观察索引**
- GIVEN 存在 `.seed/observations/index.json`
- WHEN 渲染状态面板
- THEN 从索引读取统计数据

**统计逻辑**:

```javascript
/**
 * 获取观察统计
 * @returns {ObservationStats} 统计数据
 */
function getObservationStats() {
  const indexPath = '.seed/observations/index.json';

  if (!fs.existsSync(indexPath)) {
    return { total: 0, raw: 0, triaged: 0, promoted: 0, ignored: 0 };
  }

  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  return index.stats;
}
```

**Acceptance Criteria:**
- [ ] AC-005: 实现 getObservationStats() 函数
- [ ] AC-006: 从 index.json 读取统计
- [ ] AC-007: 索引不存在时返回空统计

---

### REQ-003: 优先级分布统计

The system SHALL display priority distribution for triaged observations.

**Scenario: 显示优先级分布**
- GIVEN triaged 观察有不同优先级
- WHEN 显示观察统计
- THEN 按优先级显示分布

**统计扩展**:

```javascript
/**
 * 获取优先级分布
 * @returns {PriorityDistribution} 分布数据
 */
function getPriorityDistribution() {
  const observations = loadObservations({ status: 'triaged' });

  return {
    P0: observations.filter(o => o.priority === 'P0').length,
    P1: observations.filter(o => o.priority === 'P1').length,
    P2: observations.filter(o => o.priority === 'P2').length,
    P3: observations.filter(o => o.priority === 'P3').length,
    P4: observations.filter(o => o.priority === 'P4').length
  };
}
```

**Acceptance Criteria:**
- [ ] AC-008: 实现 getPriorityDistribution() 函数
- [ ] AC-009: 只显示有数量的优先级
- [ ] AC-010: P0/P1 使用醒目颜色

---

### REQ-004: 观察健康度指示

The system SHALL indicate observation health status.

**Scenario: 积压警告**
- GIVEN raw 观察超过阈值（如 10 条）
- WHEN 显示状态面板
- THEN 显示积压警告

**健康度规则**:

| 条件 | 状态 | 显示 |
|------|------|------|
| raw ≤ 5 | 健康 | 绿色 ✓ |
| 5 < raw ≤ 10 | 注意 | 黄色 ⚠️ |
| raw > 10 | 积压 | 红色 ❗ |
| P0/P1 > 0 且未处理 > 3天 | 紧急 | 红色闪烁 🚨 |

**显示格式**:

```
🔬 观察状态 ⚠️ 积压警告
  待处理: 12 条 (raw) ← 建议尽快归类
  ...
```

**Acceptance Criteria:**
- [ ] AC-011: 实现健康度计算逻辑
- [ ] AC-012: 根据健康度显示不同颜色
- [ ] AC-013: 积压时显示警告提示

---

### REQ-005: 快捷操作入口

The system SHALL provide quick action suggestions based on observation state.

**Scenario: 建议下一步操作**
- GIVEN 存在 raw 观察
- WHEN 显示状态面板
- THEN 建议运行归类命令

**建议逻辑**:

| 状态 | 建议操作 |
|------|----------|
| raw > 0 | `/mob-seed:spec triage --batch raw` |
| triaged 有 P1 | `/mob-seed:spec triage --show P1` |
| promoted > 0 | `/mob-seed:spec --list draft` |

**Acceptance Criteria:**
- [ ] AC-014: 根据状态生成操作建议
- [ ] AC-015: 建议可直接复制执行
- [ ] AC-016: 优先显示高优先级操作

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 代码 | skills/mob-seed/lib/ux/progress-panel.js | 修改现有模块 |
| 代码 | skills/mob-seed/lib/ace/observation-stats.js | 统计逻辑 |
| 测试 | skills/mob-seed/test/ace/observation-stats.test.js | 单元测试 |
| 测试 | skills/mob-seed/test/ux/progress-panel.test.js | 更新现有测试 |

---

## 相关规格

- proposal: openspec/changes/v3.0-ace-integration/proposal.md
- 依赖: observation.fspec.md
- 被依赖: 无
