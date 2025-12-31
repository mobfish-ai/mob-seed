# {组件名称} 组件规格

> 版本: 1.0.0
> 创建时间: {YYYY-MM-DD}
> 最后更新: {YYYY-MM-DD}
> 模板: component

---

## 概述 (Overview)

### 组件描述
{简要描述这个组件做什么}

### 组件类型
- [ ] 展示型组件 (Presentational)
- [ ] 容器型组件 (Container)
- [ ] 布局组件 (Layout)
- [ ] 表单组件 (Form)

### 使用场景
- 场景1: {描述}
- 场景2: {描述}

---

## 需求 (Requirements)

### 功能需求 (Functional Requirements)

- [ ] FR-001: {需求描述}
- [ ] FR-002: {需求描述}

### 非功能需求 (Non-Functional Requirements)

- [ ] NFR-001: 可访问性 - 支持键盘导航
- [ ] NFR-002: 响应式 - 适配移动端
- [ ] NFR-003: 性能 - 渲染时间 < {X}ms

---

## 约束 (Constraints)

### 技术约束
- 框架: {React/Vue/Angular}
- 样式: {CSS/SCSS/Tailwind/CSS-in-JS}
- 状态管理: {内部状态/全局状态}

### 设计约束
- 设计系统: {遵循的设计规范}
- 主题支持: {是否支持主题切换}

---

## 接口规格 (Interface Specification)

### Props

| 属性名 | 类型 | 必需 | 默认值 | 说明 |
|--------|------|------|--------|------|
| {prop1} | string | 是 | - | {说明} |
| {prop2} | number | 否 | 0 | {说明} |
| {prop3} | boolean | 否 | false | {说明} |
| {prop4} | function | 否 | - | 回调函数 |

### Props 类型定义

```typescript
interface {ComponentName}Props {
  /** 必需属性说明 */
  prop1: string;

  /** 可选属性说明 */
  prop2?: number;

  /** 布尔属性说明 */
  prop3?: boolean;

  /** 事件回调 */
  onEvent?: (value: any) => void;
}
```

### Events / 回调

| 事件名 | 参数 | 说明 |
|--------|------|------|
| onChange | (value: T) => void | 值变化时触发 |
| onClick | (event: Event) => void | 点击时触发 |
| onFocus | () => void | 获得焦点时触发 |

### Slots / Children

| 插槽名 | 说明 |
|--------|------|
| default | 默认内容 |
| header | 头部内容 |
| footer | 底部内容 |

---

## 状态规格 (State Specification)

### 内部状态

| 状态名 | 类型 | 初始值 | 说明 |
|--------|------|--------|------|
| isLoading | boolean | false | 加载状态 |
| error | string | null | 错误信息 |

### 状态转换

```
┌─────────┐    加载    ┌──────────┐    完成    ┌─────────┐
│  idle   │ ────────► │ loading  │ ────────► │ success │
└─────────┘           └──────────┘           └─────────┘
                           │                      ▲
                           │ 失败                  │ 重试
                           ▼                      │
                      ┌─────────┐ ────────────────┘
                      │  error  │
                      └─────────┘
```

---

## 样式规格 (Style Specification)

### 变体 (Variants)

| 变体 | 说明 | 使用场景 |
|------|------|----------|
| primary | 主要样式 | 主操作按钮 |
| secondary | 次要样式 | 辅助操作 |
| outline | 轮廓样式 | 次级操作 |

### 尺寸 (Sizes)

| 尺寸 | 说明 |
|------|------|
| sm | 小尺寸 |
| md | 中尺寸（默认） |
| lg | 大尺寸 |

### CSS 变量

```css
:root {
  --{component}-bg: #fff;
  --{component}-color: #333;
  --{component}-border: #ddd;
  --{component}-radius: 4px;
}
```

---

## 验收标准 (Acceptance Criteria)

### AC-001: 基本渲染
- **Given**: 提供必需的 props
- **When**: 组件渲染
- **Then**:
  - 正确显示内容
  - 应用正确的样式

### AC-002: 交互响应
- **Given**: 组件已渲染
- **When**: 用户与组件交互
- **Then**:
  - 触发对应的事件回调
  - 状态正确更新
  - UI 正确反馈

### AC-003: 错误处理
- **Given**: 提供无效的 props
- **When**: 组件渲染
- **Then**:
  - 显示合适的错误状态
  - 不影响页面其他部分

### AC-004: 可访问性
- **Given**: 使用键盘导航
- **When**: 焦点移动到组件
- **Then**:
  - 可见的焦点指示器
  - 可通过键盘操作

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 组件 | src/components/{Component}.jsx | 组件实现 |
| 样式 | src/components/{Component}.css | 组件样式 |
| 类型 | src/components/{Component}.d.ts | 类型定义 |
| 测试 | test/components/{Component}.test.jsx | 单元测试 |
| 故事 | stories/{Component}.stories.jsx | Storybook |
| 文档 | docs/components/{Component}.md | 使用文档 |

---

## 使用示例 (Usage Examples)

### 基本用法

```jsx
import { {ComponentName} } from '@/components/{ComponentName}';

function Example() {
  return (
    <{ComponentName}
      prop1="value"
      prop2={42}
      onEvent={(value) => console.log(value)}
    />
  );
}
```

### 带 Slot 用法

```jsx
<{ComponentName} prop1="value">
  <{ComponentName}.Header>标题</{ComponentName}.Header>
  <{ComponentName}.Body>内容</{ComponentName}.Body>
</{ComponentName}>
```

---

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.0 | {YYYY-MM-DD} | 初始版本 | {作者} |
