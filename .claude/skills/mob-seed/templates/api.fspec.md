# {API名称} API 规格

> 版本: 1.0.0
> 创建时间: {YYYY-MM-DD}
> 最后更新: {YYYY-MM-DD}
> 模板: api

---

## 概述 (Overview)

### API 描述
{简要描述这个 API 做什么}

### 端点信息
- **方法**: {GET|POST|PUT|DELETE|PATCH}
- **路径**: `/api/v1/{resource}`
- **认证**: {是否需要认证，认证方式}

### 目标用户
{谁会调用这个 API}

---

## 需求 (Requirements)

### 功能需求 (Functional Requirements)

- [ ] FR-001: {需求描述}
- [ ] FR-002: {需求描述}

### 非功能需求 (Non-Functional Requirements)

- [ ] NFR-001: 响应时间 < {X}ms
- [ ] NFR-002: 支持 {X} 并发请求
- [ ] NFR-003: 数据校验规则

---

## 约束 (Constraints)

### 技术约束
- 协议: HTTP/HTTPS
- 格式: JSON
- 编码: UTF-8

### 安全约束
- 认证: {Bearer Token / API Key / 无}
- 授权: {权限要求}
- 限流: {请求频率限制}

---

## 请求规格 (Request Specification)

### 请求头 (Headers)

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| Content-Type | string | 是 | application/json |
| Authorization | string | {是/否} | Bearer {token} |

### 路径参数 (Path Parameters)

| 名称 | 类型 | 必需 | 说明 |
|------|------|------|------|
| {param} | string | 是 | {说明} |

### 查询参数 (Query Parameters)

| 名称 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| {param} | string | 否 | {默认} | {说明} |

### 请求体 (Request Body)

```json
{
  "field1": "string, 必需, 说明",
  "field2": 0,
  "field3": {
    "nested": "value"
  }
}
```

#### 字段说明

| 字段 | 类型 | 必需 | 校验规则 | 说明 |
|------|------|------|----------|------|
| field1 | string | 是 | 长度 1-100 | {说明} |
| field2 | number | 否 | >= 0 | {说明} |

---

## 响应规格 (Response Specification)

### 成功响应 (2xx)

**状态码**: 200 OK

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "string",
    "field1": "value",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

#### 响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| code | number | 业务状态码，0 表示成功 |
| message | string | 状态描述 |
| data | object | 响应数据 |

### 错误响应 (4xx/5xx)

**状态码**: 400 Bad Request

```json
{
  "code": 40001,
  "message": "参数校验失败",
  "errors": [
    {
      "field": "field1",
      "message": "不能为空"
    }
  ]
}
```

### 错误码定义

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| 40001 | 400 | 参数校验失败 |
| 40101 | 401 | 未认证 |
| 40301 | 403 | 无权限 |
| 40401 | 404 | 资源不存在 |
| 50001 | 500 | 服务器内部错误 |

---

## 验收标准 (Acceptance Criteria)

### AC-001: 正常请求
- **Given**: 用户已认证，请求参数正确
- **When**: 调用 API
- **Then**:
  - 返回 200 状态码
  - 返回正确的数据结构
  - 响应时间 < {X}ms

### AC-002: 参数校验
- **Given**: 请求参数不符合规则
- **When**: 调用 API
- **Then**:
  - 返回 400 状态码
  - 返回详细的错误信息

### AC-003: 未认证请求
- **Given**: 请求未携带认证信息
- **When**: 调用需要认证的 API
- **Then**:
  - 返回 401 状态码

---

## 派生产物 (Derived Outputs)

| 类型 | 路径 | 说明 |
|------|------|------|
| 路由 | src/routes/{resource}.js | 路由定义 |
| 控制器 | src/controllers/{resource}.js | 业务逻辑 |
| 校验 | src/validators/{resource}.js | 参数校验 |
| 测试 | test/api/{resource}.test.js | API 测试 |
| 文档 | docs/api/{resource}.md | API 文档 |

---

## 示例 (Examples)

### 请求示例

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"field1": "value"}' \
  https://api.example.com/api/v1/{resource}
```

### 响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "abc123",
    "field1": "value",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0.0 | {YYYY-MM-DD} | 初始版本 | {作者} |
