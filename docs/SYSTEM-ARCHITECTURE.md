# MCPay 系统架构与数据流

## 组件图

```mermaid
flowchart LR
  U[用户] --> W[React Web + MetaMask]
  W -->|签名挑战与会话| A[主 Cloudflare Worker<br/>Hono API]
  W -->|Turnstile token + POST /api/tasks/stream| A
  A -->|钱包会话、日任务数、日 MON 额度| AD[(API Cloudflare D1)]
  A -->|规划| L1[DeepSeek]
  A -->|GET /offers| P[研究 Provider Worker]
  A -->|402 请求 / 支付证明重试| P
  A -->|Monad Testnet 转账| M[Monad RPC]
  P -->|验证交易| M
  P -->|交易哈希一次性消费| D[(Cloudflare D1)]
  P -->|检索证据| T[Tavily]
  P -->|流式综合| L2[DeepSeek]
  A -->|SSE 进度与结果| W
```

## 主执行序列

```mermaid
sequenceDiagram
  participant User as 用户
  participant Web as React Web
  participant API as MCPay API
  participant Access as API D1
  participant Provider as Research Provider
  participant Monad as Monad Testnet
  participant D1 as Cloudflare D1
  participant AI as Tavily + DeepSeek

  User->>Web: MetaMask 签名登录
  Web->>API: nonce → personal_sign → session Cookie
  User->>Web: 输入目标与 MON 预算
  Web->>API: POST /api/tasks/stream
  API->>Access: 原子领取当日任务额度
  API-->>Web: planning / offers 进度（SSE）
  API->>Provider: GET /offers
  API->>Provider: POST /execute（无支付证明）
  Provider-->>API: 402 + 支付条款
  API->>Access: 原子预留该报价的日 MON 额度
  API->>Monad: 按条款发起原生 MON 转账
  Monad-->>API: 成功回执 + 交易哈希
  API->>Provider: POST /execute（携带支付证明）
  Provider->>Monad: 核验交易、收款地址、金额
  Provider->>D1: 原子消费交易哈希
  Provider->>AI: 检索证据并流式综合
  Provider-->>API: chunk / result（SSE）
  API-->>Web: execution 正文片段 + 最终结果
```

## API 契约

### MCPay API

| 方法与路由               | 作用                                            | 响应                               |
| ------------------------ | ----------------------------------------------- | ---------------------------------- |
| `POST /api/tasks`        | 非流式创建任务                                  | 完整任务 JSON                      |
| `POST /api/tasks/stream` | 创建任务并观察执行过程                          | SSE：`progress`、`result`、`error` |
| `POST /api/auth/nonce`   | 为钱包地址创建 5 分钟签名挑战                   | 地址、nonce、待签名消息            |
| `POST /api/auth/session` | 验证 `personal_sign` 签名并写入 HttpOnly Cookie | 钱包地址与日额度                   |
| `GET /api/auth/session`  | 读取当前钱包会话和额度                          | 钱包地址与剩余任务/MON             |
| `POST /api/auth/logout`  | 删除钱包会话                                    | `204`                              |

请求体：

```json
{
  "goal": "Research the Monad ecosystem",
  "budgetMon": "0.01",
  "sourceCount": 5,
  "outputTargetChars": 1000
}
```

进度事件：

```text
event: progress
data: {"stage":"planning","message":"Planning Task and discovering Offers"}
```

`sourceCount` 与 `outputTargetChars` 会同时传给 `/offers` 和两次 `/execute` 调用，保证 Offer、402 条款、链上付款和实际研究深度一致。

部署模式的任务必须具有由 MetaMask `personal_sign` 建立的同源 HttpOnly 会话。API D1 先限制每个地址每日 10 个任务；Provider 返回精确 `402` 价格后，API 再原子预留该地址当天最多 `0.100 MON` 的支出。任一额度耗尽时，不会发起 Monad 转账。

### Provider API

| 方法与路由      | 作用                                             |
| --------------- | ------------------------------------------------ |
| `GET /health`   | 健康检查                                         |
| `GET /offers`   | 返回当前的 `web-research` Offer                  |
| `POST /execute` | 无支付证明时返回 `402`；验证并消费证明后执行研究 |

Provider 的支付证明请求头：

```text
x-payment-tx: 0x<64 hex>
x-payment-recipient: 0x<40 hex>
x-payment-amount: <MON atomic units>
```

若客户端请求头 `Accept` 包含 `text/event-stream`，Provider 返回 SSE 的 `chunk`、`result`、`error` 事件，而不是一次性 JSON。浏览器使用 `fetch` 读取 SSE 响应，因为任务创建需要 `POST` 与 Turnstile 请求头；`EventSource` 仅支持 GET，不能满足这个请求契约。

## 部署边界

| Worker                    | 责任                                                                  | 持久状态                      |
| ------------------------- | --------------------------------------------------------------------- | ----------------------------- |
| `mcpay`                   | 静态 Web、钱包会话、额度、任务编排、Agent Wallet 支付、Turnstile 验证 | D1 的钱包挑战、会话、每日额度 |
| `mcpay-research-provider` | Offer、402、链上验证、研究执行                                        | D1 的 `payment_consumptions`  |

主 Worker 的自定义域名配置为 `mcpay.yonjay.me`；Provider 使用其 `workers.dev` URL 供主 Worker 调用。部署参数与密钥名称见根目录 README。
