# MCPay — Agent Commerce on Monad

MCPay 让用户只提供 **任务目标** 与 **MON 预算**，由 Agent 在预算内发现服务、比较 Offer、处理 `402 Payment Required`、在 Monad Testnet 结算，并取得付费执行结果。

它不是钱包、MCP 目录或单纯的 x402 封装；它负责 Agent 的商业决策：**买什么、向谁买、是否值得花这笔钱，以及付款后如何完成执行**。

## 项目现状

当前仓库已实现一条 `web-research` 的端到端路径：

```text
目标 + MON 预算
  → Agent 规划与发现 Offer
  → 确定性排序并选择 Provider
  → Provider 返回 HTTP 402
  → Agent Wallet 在 Monad Testnet 转账
  → Provider 验证交易并在 D1 消费交易哈希
  → Tavily 获取实时证据
  → DeepSeek 基于证据流式生成研究结果与引用
```

| 能力 | 当前实现 |
| --- | --- |
| 任务入口 | React Web + Cloudflare Turnstile |
| 执行反馈 | `POST /api/tasks/stream` 的 SSE 阶段事件与正文片段 |
| Offer 选择 | 价格、声誉、质量、延迟的确定性评分 |
| 支付 | Monad Testnet 原生 MON 转账，`viem` 等待成功回执 |
| Provider | Cloudflare Worker：`/offers`、`/execute`、`/health` |
| 防重放 | D1 对交易哈希原子 `INSERT OR IGNORE`，一笔支付只能执行一次 |
| 研究服务 | Tavily 检索最多 5 条证据；DeepSeek 仅据证据综合并返回引用 |
| 防护 | Web 任务 10 次/IP/分钟；Provider 执行 30 次/IP/分钟 |

## Monorepo 结构

```text
apps/
  web/        浏览器任务界面与流式执行呈现
  api/        任务编排、预算校验、Monad 支付、静态资源 Worker
  provider/   付费研究 Provider、交易验证、D1 防重放、Tavily/DeepSeek
packages/
  commerce/   Offer、预算与排名的共享领域逻辑
docs/         架构、演示与 PPT 素材
```

## 本地运行

要求：Node.js 24、pnpm 11。

```bash
fnm exec --using=24 -- pnpm install
fnm exec --using=24 -- pnpm dev
```

浏览器界面在 `http://127.0.0.1:5173`，默认是确定性的 `demo` 模式：不会调用外部模型、不会发链上交易，也不会花费余额。

```bash
fnm exec --using=24 -- pnpm test
fnm exec --using=24 -- pnpm build
```

Cloudflare Workers Builds 的精简校验命令：

```bash
pnpm --filter @mcpay/api cf:check
pnpm --filter @mcpay/provider cf:check
```

## 运行真实 Provider

真实模式会发生 Monad Testnet 转账。先确认 Agent Wallet 已充值，并只在安全环境配置密钥。

1. 运行 `pnpm --filter @mcpay/provider cf:login` 登录 Cloudflare。
2. Provider 的 D1 数据库已在 [`apps/provider/wrangler.jsonc`](apps/provider/wrangler.jsonc) 绑定；首次新建环境时执行 `pnpm --filter @mcpay/provider cf:migrate`。
3. 将 [`apps/provider/.dev.vars.example`](apps/provider/.dev.vars.example) 复制为 `.dev.vars`，填入收款地址、DeepSeek Key 与 Tavily Key。
4. 通过 `wrangler secret put` 为 Provider 设置 `MCPAY_PROVIDER_RECEIVING_ADDRESS`、`MCPAY_PROVIDER_DEEPSEEK_API_KEY`、`MCPAY_PROVIDER_TAVILY_API_KEY`。
5. 部署 Provider：`pnpm --filter @mcpay/provider cf:deploy`。
6. 将 [`apps/api/.env.example`](apps/api/.env.example) 复制为 `.env`；设置 `MCPAY_RUNTIME_MODE=live`、Agent Wallet 私钥、DeepSeek Key、Provider 的 `/offers` 和 `/execute` URL。
7. 为主 Worker 设置 `MCPAY_LLM_API_KEY`、`MCPAY_AGENT_PRIVATE_KEY`、`MCPAY_TURNSTILE_SECRET`，然后执行 `pnpm --filter @mcpay/api cf:deploy`。

不要把私钥、API Key、Turnstile Token 或 `.dev.vars` 提交到 Git。示例文件只应保留变量名和占位符。

## 文档导航

- [项目全景与真实能力](docs/PROJECT-OVERVIEW.md)
- [系统架构与数据流](docs/SYSTEM-ARCHITECTURE.md)
- [PPT 制作提纲](docs/PPT-BRIEF.md)
- [现场演示脚本](DEMO-SCRIPT.md)
- [MVP 范围与完成状态](MVP-SCOPE.md)
- [领域术语](CONTEXT.md) 与 [上下文地图](CONTEXT-MAP.md)
- [架构决策记录](docs/adr/)

## 一句话定位

> **MCPay 是 Agent 的商业编排层：让 Agent 在明确预算内自主发现、购买并使用数字服务。**
