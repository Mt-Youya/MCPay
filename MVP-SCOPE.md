# MCPay MVP 范围与完成状态

## 成功条件

观众可以从浏览器提交一个目标与 MON 预算，并观察到完整的、可解释的路径：

```text
Goal + Budget
 → planning
 → Offer discovery and deterministic selection
 → 402 Payment Required
 → Monad Testnet payment
 → Provider verification and one-time consumption
 → evidence-backed streamed research
 → result, citations, and economics
```

## 已完成

- [x] React 任务入口与 Turnstile 验证接入
- [x] `POST /api/tasks` 的非流式路径
- [x] `POST /api/tasks/stream` 的 SSE 流式路径
- [x] `planning`、`offers`、`payment`、`execution` 四阶段事件
- [x] 受限于 `web-research` 的 LLM 规划
- [x] 共享且可测试的 MON 预算比较
- [x] 基于声誉、质量、价格、延迟的确定性 Offer 排序
- [x] Provider `/offers`、`/execute`、`/health`
- [x] 402 请求—支付—带证明重试协议
- [x] Monad Testnet 原生 MON 转账与成功回执检查
- [x] Provider 校验交易成功、收款地址、精确金额
- [x] D1 一次性消费支付证明，防止重放
- [x] Tavily 实时证据检索与 DeepSeek 基于证据的综合
- [x] Provider 到浏览器的正文流式转发与引用返回
- [x] Cloudflare 速率限制：任务 10/IP/分钟，执行 30/IP/分钟

## 演示前必须实际验证

这些能力有代码与配置入口，但每次正式展示前都需在目标环境重新验证：

- [ ] Agent Wallet 当前余额足以支付
- [ ] Monad RPC 可用且交易能在可接受时间内确认
- [ ] 主 Worker 的 DeepSeek Key、Agent 私钥、Turnstile Secret 正确
- [ ] Provider 的收款地址、Tavily Key、DeepSeek Key 正确
- [ ] D1 migration 已部署，`payment_consumptions` 可写
- [ ] 主 Worker 指向当前 Provider 的 `/offers` 和 `/execute`
- [ ] 自定义域名与 Turnstile hostname 一致

## 明确不在 MVP 内

- 用户账户、钱包连接与充值 UI
- 智能账户或链上预算强制执行
- 多个真实 Provider 与开放式 Provider 注册
- 链上声誉、服务质量担保、托管、退款与争议
- 多链、主网与法币报价/汇率
- Provider 管理后台、订阅、协议费与结算分账
- 任意 Agent 工具执行或多 Agent 协作

## 变更优先级

1. 保证一次真实的 `web-research` 交易能安全完成。
2. 使 UI 清楚展示预算、选择、402、付款、验证、结果和来源。
3. 增加第二个真实 Provider。
4. 引入智能账户预算策略与更完整的商业保障机制。
