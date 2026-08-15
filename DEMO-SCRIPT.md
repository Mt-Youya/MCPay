# MCPay — 现场演示脚本

目标：在 3–4 分钟内让观众看懂“为什么这是 Agent Commerce”，而不是只看到一次 LLM 搜索。

## 演示前检查

- 先用 `GET /health` 确认 Research Provider 可用。
- 确认 Agent Wallet 在 Monad Testnet 有足够 MON；演示金额建议为 `0.01 MON`。
- 检查 Turnstile、DeepSeek、Tavily、Provider URL 已配置为当前环境。
- 先在 `demo` 模式跑一遍成功与预算不足分支；直播时再切到 `live`。
- 浏览器不要打开任何含 API Key、私钥、Cloudflare Secret 的标签页或终端历史。

## 开场（20 秒）

> Agent 今天会推理、会调用工具，但大多数工具关系都要人类提前注册、充值并分发 API Key。MCPay 让用户只交代目标和预算，Agent 在预算内自己选择、支付并使用服务。

展示输入：

```text
目标：Research the Monad ecosystem and identify five promising projects.
预算：0.01 MON
```

## 1. 规划与 Offer 选择（35 秒）

点击 **Run Agent**，展示流式状态中的 `planning` 与 `offers`。

> 模型只负责理解这个任务需要 web research。真正的 Provider 选择是确定性规则：声誉、质量、价格和延迟都有固定权重。因此我们能解释并复现每一次经济选择。

指向 Provider comparison 与选中原因。

## 2. 402 不是错误，是付款协议（40 秒）

在日志或网络视图展示第一次 `/execute` 返回的 `HTTP 402 Payment Required`：

```text
amountMon
recipient
network: monad
paymentAmountNative
```

> Provider 不是要求订阅或预置 API Key。它把精确的支付条款交给 Agent；编排层先验证条款和所选 Offer 一致，再检查预算。

## 3. Autonomous Payment（35 秒）

展示 `Submitting Monad payment` → `Monad payment confirmed` 和交易哈希。

> 预算已经是用户的授权边界，因此不需要逐笔弹窗确认。Agent 只为这次任务、这份 Offer 和这笔精确金额付款。

如网络稳定，可打开 Monad Explorer 的交易；不稳定时只展示界面交易哈希，不要把外部网页加载当作关键路径。

## 4. 一次性验证与付费研究（45 秒）

展示 Provider 验证状态、连续出现的研究正文与引用。

> Provider 会查 Monad 回执，核对成功状态、收款地址和精确金额。随后将交易哈希写入 D1；相同哈希第二次请求会被拒绝，因此一次付款只能兑换一次执行。

> 研究结果也不是凭模型记忆生成：Provider 先从 Tavily 取证，再让 DeepSeek 只基于这些证据流式总结，并把标题和 URL 一起返回。

## 5. 收束（20 秒）

> MCPay 不是“帮 Agent 接一个支付按钮”。它把发现、经济决策、402 结算、执行授权和可核验结果连接成一个预算受控的商业闭环。

## 备用演示与失败处理

| 情况           | 做法                                           | 不要做                         |
| -------------- | ---------------------------------------------- | ------------------------------ |
| 外部 API 超时  | 切换 `demo` 模式，继续讲状态机、排序和预算分支 | 现场反复刷新并消耗余额         |
| Testnet 拥堵   | 展示已准备的交易哈希与架构图                   | 承诺“链已经确认”而没有回执     |
| Turnstile 失败 | 先说明安全校验阻止任务创建，使用本地测试环境   | 临时删除安全校验               |
| 余额不足       | 用预算不足的 demo 分支解释不会支付             | 在公开场景粘贴私钥或临时换钱包 |

## 常见问答

### 为什么是 Monad？

Agent 的服务购买可能频繁且金额很小。MCPay 用 Monad Testnet 展示原生 MON 的可验证结算；本项目并不声称多链或生产级结算已经完成。

### 为什么不用 Stripe 或固定 API Key？

它们适合已建立关系的用户—商户模式。MCPay 关注的是 Agent 运行时发现陌生 Provider 后，如何获得一次可验证的服务授权。

### 如何避免超支？

当前 MVP 在编排层先检查预算，再发送交易；当前 Offer 的选择也由确定性规则完成。智能账户级的可执行限额是下一阶段工作。

### 如果 Provider 收款后不服务呢？

本项目已解决“支付证明只能兑换一次执行”，但托管、退款、争议和服务质量担保还不在 MVP 范围内。
