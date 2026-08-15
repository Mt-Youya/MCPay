<!-- Slide number: 1 -->

PROJECT INTRODUCTION · 3 MIN

让 Agent 可以购买服务

MCPay — Agent Commerce on Monad

用户给出目标与预算；Agent 在约束内发现、支付并执行陌生 Provider 的服务。

01
02
03
04

目标
预算
支付
结果

Research
0.01 MON
402 / Monad
Evidence

不是“支付按钮”，而是 Agent 的可验证商业闭环。

01
MCPay · Agent Commerce on Monad

### Notes:

<!-- Slide number: 2 -->

01 / PROBLEM
工具调用，不等于商业能力

Agent 缺少的是一套能在运行时处理陌生服务关系的协议与约束。

01
02
需要什么服务？
多个 Provider，选谁？

把目标映射为受支持的 web-research。
以声誉、质量、价格、延迟做可复现排序。

03
04
没有预置 API Key，怎么付？
付款后如何只执行一次？

以 402 提供机器可读的付款条款。
链上验证 + D1 原子消费支付证明。

MCPay 解决完整商业闭环

02
MCPay · Agent Commerce on Monad

### Notes:

<!-- Slide number: 3 -->

02 / EXPERIENCE
用户只交代目标与预算

预算不是提示信息，而是 Agent 可执行的授权边界。

LLM 语义规划
确定性选择

TASK INPUT

只解释：为什么需要 web-research

声誉 50% · 质量 30%
价格 15% · 延迟 5%
Research the Monad ecosystem
and identify five promising projects.

Budget

0.01 MON
预算校验
执行授权

超出预算：不发起支付

仅为选定 Offer 与精确金额付款

Run Agent

把语义判断交给模型，把经济决策留给可测试规则。

03
MCPay · Agent Commerce on Monad

### Notes:

<!-- Slide number: 4 -->

03 / EXECUTION FLOW
402 不是错误，而是付款协议

Provider 给出精确条款；Agent 先校验、再付款、最后带着证明重试。

01
02
03
04

请求执行
返回 402
Monad 转账
携带证明重试

POST /execute
无支付证明
amount · recipient
network: monad
精确金额
得到交易哈希
x-payment-tx
执行已付款服务

守住两道门：支付条款必须与选中 Offer 一致；金额必须不超过用户预算。

04
MCPay · Agent Commerce on Monad

### Notes:

<!-- Slide number: 5 -->

04 / ARCHITECTURE
双 Worker 分工，让支付与执行可验证

主 Worker 专注编排；Research Provider 独立验证支付、消费证明并完成研究。

React Web
MCPay API
Research Provider
Tavily + DeepSeek

目标、预算、流式进度
Hono 编排
Turnstile 验证
Offer · 402 · 验证
一次性执行授权
最多 5 条证据检索
证据约束下流式综合

支付结算
防重放

Monad Testnet
Cloudflare D1

原生 MON 转账
交易回执校验
payment_consumptions
交易哈希原子消费

NDJSON：planning → offers → payment → execution

05
MCPay · Agent Commerce on Monad

### Notes:

<!-- Slide number: 6 -->

05 / TRUST
一笔支付，只能兑换一次执行

Provider 不信任客户端声明；它独立核验链上回执，并由 D1 原子记录消费状态。

01
02
03

交易哈希
原子消费
一次执行

Monad 回执校验
Cloudflare D1
Research Provider

成功状态
收款地址
精确金额
INSERT OR IGNORE
唯一主键
第一次：执行研究
重复：409 拒绝

同一交易哈希第二次兑换执行 → 409 Conflict

06
MCPay · Agent Commerce on Monad

### Notes:

<!-- Slide number: 7 -->

06 / RESEARCH
真实服务，而非模型幻觉

检索与生成分离：先取证，再由模型仅基于证据进行流式综合。

任务目标
Tavily
DeepSeek
可核验输出

研究 Monad 生态
识别潜力项目
实时检索
最多 5 条网页证据
仅基于目标 + 证据
流式综合
研究正文 +
标题 / URL 引用

输出不仅给结论，也返回每条证据的标题与 URL；演示中不展示 API Key、私钥或 Token。
证据边界

07
MCPay · Agent Commerce on Monad

### Notes:

<!-- Slide number: 8 -->

07 / SCOPE
已落地的闭环，与明确保留的边界

MVP 已在 Monad Testnet 完成核心链路；生产级商业治理仍是下一步。

已完成
下一步

完整的 Agent Commerce MVP
不夸大的项目边界

402 + Monad Testnet 结算
多 Provider 与开放式服务市场

D1 一次性支付证明消费
智能账户限额与链上声誉

Tavily + DeepSeek 证据化流式研究
托管、退款、争议处理与生产级运营

MCPay 让 Agent 不止会调用工具，而是能在预算约束下参与可验证的服务经济。

08
MCPay · Agent Commerce on Monad

### Notes:
