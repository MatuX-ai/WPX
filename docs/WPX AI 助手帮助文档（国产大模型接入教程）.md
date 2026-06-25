# WPX AI 助手帮助文档

**版本**：V1.1（V1.0 基础上业务模式变更为「完全免费」）  
**最后更新**：2026-06-25  
**适用产品**：WPX 桌面端 V1.1 及以上  
**关联文档**：[AI 助手 V1 需求文档](i:/WPX/docs/AI助手-V1-需求文档.md)

---

## 〇、本版本重要变更

> **WPX V1.1 起为「完全免费」模式**。平台不再提供任何内置大模型服务，也不再经营商业字体 / Token 售卖业务。

1. **AI 大模型** —— 由用户自行在「设置 → 我的模型」中配置**第三方大模型 API**（兼容 OpenAI Chat Completions 协议，覆盖 DeepSeek、智谱 GLM、阿里通义千问 Qwen、百度文心一言、字节豆包、月之暗面 Kimi、腾讯混元、SiliconFlow 等全部国产大模型，以及 OpenAI、Anthropic Claude、本地 Ollama / LM Studio）。
2. **商业字体** —— 由用户自行采购授权后，在「我的字体」中导入本地已获合法授权的字体文件。
3. **WPX 平台零抽成** —— 不收任何平台服务费、不收 Token 费、不收授权中转费。
4. **API Key 隐私** —— 仅本机 AES 加密存储，不会上传至 WPX 任何服务器。

如果你之前使用的是 V1.0 的「WPX 公共大模型」/「Token 额度」，请按下文指引迁移到自备 API。

---

## 1. 快速开始（5 分钟接入）

### 1.1 三步走

| 步骤 | 操作 | 预计耗时 |
|:---|:---|:---|
| 1 | 在国产大模型服务商官网注册账号并完成实名（一般几分钟） | 2 分钟 |
| 2 | 创建一个 API Key（建议命名为 `wpx-桌面端`）并复制保存 | 1 分钟 |
| 3 | 打开 WPX → 设置 → 我的模型 → 选服务商预设 → 粘贴 Key → 测试连接 → 保存 | 2 分钟 |

### 1.2 最低成本方案

| 服务商 | 推荐模型 | 入口价格 | 备注 |
|:---|:---|:---|:---|
| **DeepSeek** | `deepseek-chat` | 1 元 / 百万 Token 级别，新用户有赠送 | **首选**，综合体验最佳 |
| 智谱 AI | `glm-4-flash` | 0 元 / 百万 Token（限时免费） | 适合试用 |
| 阿里云百炼 | `qwen-turbo` | 极低价，分级计费 | 阿里云账号 |
| SiliconFlow | `Qwen/Qwen2.5-7B-Instruct` | 提供免费额度 | 多模型聚合 |

> **小贴士**：上述国产大模型均提供**新用户免费额度**，完成实名认证后通常可获得 100 万 ~ 1000 万 Token 的免费试用，足够 WPX 正常使用数周到数月。

---

## 2. 国产大模型接入教程

### 2.1 DeepSeek（深度求索）— ⭐ 推荐首选

| 项目 | 内容 |
|:---|:---|
| 官网 | <https://platform.deepseek.com> |
| 文档 | <https://api-docs.deepseek.com> |
| 默认 Endpoint | `https://api.deepseek.com/v1/chat/completions` |
| 推荐模型 | `deepseek-chat`（V3 0324）、`deepseek-reasoner`（R1 推理） |
| 价格 | 1 元 / 百万 Token 级别（输入缓存命中可再降 90%） |
| 注册 | 邮箱或手机号，注册后实名送额度 |
| 适合场景 | 通用写作、翻译、代码、推理，**综合最强** |

**接入步骤**：

1. 打开 <https://platform.deepseek.com>，点击右上角「注册」。
2. 完成手机号 / 邮箱验证。
3. 进入控制台 → 「API Keys」 → 「创建新 Key」，命名 `wpx-桌面端`，权限选「全部」。
4. **复制 Key 并妥善保管**（离开页面后将无法再次查看完整 Key）。
5. 打开 WPX → 设置 → 我的模型 → 选「DeepSeek」预设 → 粘贴 Key → 模型名称填 `deepseek-chat` → 测试连接 → 保存。

### 2.2 智谱 AI（GLM / 智谱清言）

| 项目 | 内容 |
|:---|:---|
| 官网 | <https://bigmodel.cn> |
| 文档 | <https://open.bigmodel.cn/dev/howuse/glm-4> |
| 默认 Endpoint | `https://open.bigmodel.cn/api/paas/v4/chat/completions` |
| 推荐模型 | `glm-4-flash`（免费）、`glm-4-plus`、`glm-4-air` |
| 价格 | `glm-4-flash` 限时免费；其他模型按 Token 计费 |
| 注册 | 实名认证 + 实名手机号 |
| 适合场景 | 中文写作、对话、抽取、摘要 |

**接入步骤**：

1. 打开 <https://bigmodel.cn> 注册并完成实名。
2. 进入「API Keys」 → 「添加新的 API Key」。
3. 复制 Key。
4. WPX → 设置 → 我的模型 → 选「智谱 GLM」 → 粘贴 Key → 模型名称填 `glm-4-flash`（免费试用）→ 测试连接 → 保存。

### 2.3 阿里云百炼（通义千问 Qwen）

| 项目 | 内容 |
|:---|:---|
| 官网 | <https://bailian.console.aliyun.com> |
| 文档 | <https://help.aliyun.com/zh/model-studio/developer-reference/use-qwen-by-calling-api> |
| 默认 Endpoint | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` |
| 推荐模型 | `qwen-turbo`（便宜）、`qwen-plus`（均衡）、`qwen-max`（最强） |
| 价格 | `qwen-turbo` 低至 0.003 元 / 千 Token；新用户有免费额度 |
| 注册 | 阿里云账号 + 实名 + 开通「模型服务百炼」 |
| 适合场景 | 通用对话、文档理解、长文本 |

**接入步骤**：

1. 打开 <https://bailian.console.aliyun.com>，使用阿里云账号登录。
2. 首次进入需开通「模型服务」并同意协议。
3. 进入「API-KEY 管理」→ 「创建我的 API-KEY」。
4. 复制 Key（形如 `sk-xxx`）。
5. WPX → 设置 → 我的模型 → 选「通义千问 Qwen」 → 粘贴 Key → 模型名称填 `qwen-turbo` → 测试连接 → 保存。

> **小贴士**：阿里云百炼的 API Key 是「华东 2（上海）」区域，如需其他区域请手动修改 Endpoint。

### 2.4 百度智能云千帆（文心一言 ERNIE）

| 项目 | 内容 |
|:---|:---|
| 官网 | <https://console.bce.baidu.com/qianfan> |
| 文档 | <https://cloud.baidu.com/doc/WENXINWORKSHOP/s/hlrk4akp7> |
| 默认 Endpoint | `https://qianfan.baidubce.com/v2/chat/completions` |
| 推荐模型 | `ernie-speed`（免费）、`ernie-lite`、`ernie-4.0` |
| 价格 | `ernie-speed` 免费；其他模型按 Token 计费 |
| 注册 | 百度智能云账号 + 实名 + 开通千帆 |
| 适合场景 | 中文写作、知识问答、企业应用 |

**接入步骤**：

1. 打开 <https://console.bce.baidu.com/qianfan>，注册并实名。
2. 进入「应用接入」→ 「创建应用」获取 **API Key** 与 **Secret Key**。
3. 在「在线服务」开通要使用的模型（如 `ernie-speed`）。
4. WPX → 设置 → 我的模型 → 选「文心一言 ERNIE」 → 填入 API Key + Secret Key（千帆 v2 协议支持合并鉴权，请参考千帆文档）→ 测试连接 → 保存。

### 2.5 字节火山方舟（豆包 Doubao）

| 项目 | 内容 |
|:---|:---|
| 官网 | <https://www.volcengine.com/product/doubao> |
| 文档 | <https://www.volcengine.com/docs/82379> |
| 默认 Endpoint | `https://ark.cn-beijing.volces.com/api/v3/chat/completions` |
| 推荐模型 | `doubao-lite-32k`、`doubao-pro-32k` |
| 价格 | 极低价，新用户有代金券 |
| 注册 | 字节跳动账号 + 实名 + 开通方舟 |
| 适合场景 | 通用对话、长文本、视觉 |

**接入步骤**：

1. 打开 <https://www.volcengine.com/product/doubao> 注册并实名。
2. 开通「火山方舟」→ 开通模型推理点（创建「在线推理」接入点）。
3. 在「API Key 管理」创建 Key。
4. WPX → 设置 → 我的模型 → 选「豆包」 → 粘贴 Key + 填写接入点 ID（`ep-xxxxxx`） → 测试连接 → 保存。

### 2.6 月之暗面（Kimi / Moonshot）

| 项目 | 内容 |
|:---|:---|
| 官网 | <https://platform.moonshot.cn> |
| 文档 | <https://platform.moonshot.cn/docs/api-reference> |
| 默认 Endpoint | `https://api.moonshot.cn/v1/chat/completions` |
| 推荐模型 | `moonshot-v1-8k`（便宜）、`moonshot-v1-32k`、`moonshot-v1-128k`（长文本） |
| 价格 | 按 Token 计费，新用户送 ¥15 体验金 |
| 注册 | 手机号注册 + 实名 |
| 适合场景 | **超长上下文（128K）**、整本书分析、长篇报告 |

**接入步骤**：

1. 打开 <https://platform.moonshot.cn> 注册。
2. 完成实名后进入「API Key 管理」 → 「新建 Key」。
3. 复制 Key。
4. WPX → 设置 → 我的模型 → 选「Kimi」 → 粘贴 Key → 模型名称填 `moonshot-v1-8k` → 测试连接 → 保存。

### 2.7 腾讯混元（Hunyuan）

| 项目 | 内容 |
|:---|:---|
| 官网 | <https://cloud.tencent.com/product/hunyuan> |
| 文档 | <https://cloud.tencent.com/document/product/1729> |
| 默认 Endpoint | `https://api.hunyuan.cloud.tencent.com/v1/chat/completions` |
| 推荐模型 | `hunyuan-turbo`、`hunyuan-standard` |
| 价格 | 新用户有免费额度包 |
| 注册 | 腾讯云账号 + 实名 + 开通混元 |
| 适合场景 | 通用对话、文本生成 |

**接入步骤**：

1. 打开 <https://cloud.tencent.com/product/hunyuan> 注册腾讯云。
2. 开通「混元大模型」服务。
3. 在「访问管理」→ 「API 密钥管理」创建 `SecretId` + `SecretKey`。
4. WPX → 设置 → 我的模型 → 选「腾讯混元」 → 填入密钥对（参考腾讯云混元 API 鉴权方式） → 测试连接 → 保存。

### 2.8 SiliconFlow（云栖 SiliconFlow）

| 项目 | 内容 |
|:---|:---|
| 官网 | <https://cloud.siliconflow.cn> |
| 文档 | <https://docs.siliconflow.cn> |
| 默认 Endpoint | `https://api.siliconflow.cn/v1/chat/completions` |
| 推荐模型 | `Qwen/Qwen2.5-7B-Instruct`、`deepseek-ai/DeepSeek-V2.5-Chat` 等 |
| 价格 | 提供**免费额度**（注册即送），适合长期低成本使用 |
| 注册 | 邮箱 / 手机号 |
| 适合场景 | 聚合多种开源模型，免费试用 |

**接入步骤**：

1. 打开 <https://cloud.siliconflow.cn> 注册。
2. 进入「API 密钥」→ 「新建密钥」。
3. 复制 Key。
4. WPX → 设置 → 我的模型 → 选「SiliconFlow」 → 粘贴 Key → 选择模型 → 测试连接 → 保存。

---

## 3. 国外大模型接入教程（可选）

### 3.1 OpenAI

| 项目 | 内容 |
|:---|:---|
| 官网 | <https://platform.openai.com> |
| 默认 Endpoint | `https://api.openai.com/v1/chat/completions` |
| 推荐模型 | `gpt-4o-mini`（便宜）、`gpt-4o`、`o1-mini` |
| 注意 | 国内直连可能受限，建议配置 HTTP/HTTPS 代理或使用中转 |

### 3.2 Anthropic Claude

| 项目 | 内容 |
|:---|:---|
| 官网 | <https://console.anthropic.com> |
| 默认 Endpoint | `https://api.anthropic.com/v1/messages`（**注意：Claude 协议略有不同**） |
| 推荐模型 | `claude-3-5-sonnet-latest`、`claude-3-haiku-20240307` |
| 注意 | Claude 协议不是标准 OpenAI 协议；如 WPX 当前版本未内置 Claude 适配器，请先用 OpenAI 兼容中转 |

### 3.3 本地推理（Ollama / LM Studio）

Ollama（<https://ollama.com>）和 LM Studio 让你在**本机完全离线**运行开源大模型，数据零外发。

**Ollama 接入步骤**：

1. 前往 <https://ollama.com/download> 下载并安装 Ollama。
2. 在终端执行 `ollama pull qwen2.5:7b` 下载模型。
3. Ollama 默认 Endpoint 为 `http://localhost:11434/v1/chat/completions`，API Key 留空。
4. WPX → 设置 → 我的模型 → 选「Ollama (本地)」 → 模型名称填 `qwen2.5:7b` → 测试连接 → 保存。

**LM Studio 接入步骤**：

1. 前往 <https://lmstudio.ai> 下载并安装。
2. 加载模型后启动「Local Server」（OpenAI 兼容模式）。
3. 默认端口 `1234`，Endpoint 为 `http://localhost:1234/v1/chat/completions`。
4. WPX → 设置 → 我的模型 → 选「自定义」 → 填入本地 Endpoint → 测试连接 → 保存。

---

## 4. 常见问题（FAQ）

### Q1：为什么 WPX 不直接送 Token 给我？
**A**：V1.1 起 WPX 已撤掉所有平台内置大模型服务与商业字体售卖业务。**完全免费**指 WPX 平台不向你收取任何服务费；大模型本身的调用费用仍由你与服务商结算，但服务商通常提供**新用户免费额度**，实际成本可低至 0。

### Q2：我之前充值的 Token 怎么办？
**A**：V1.1 起平台 Token 充值已下线。如你已充值并有余额，可在「设置 → 账户与发票」中查看退款政策；如有疑问请联系 [hi@wpx.app](mailto:hi@wpx.app)。

### Q3：API Key 会被 WPX 偷偷上传吗？
**A**：**不会**。API Key 以 AES-256 加密存储在本地 `electron-store` 中，**从不离开你的电脑**。你可以使用抓包工具验证。

### Q4：我的网络无法访问某些国外服务？
**A**：建议优先使用 DeepSeek、智谱 GLM、通义千问、文心一言、豆包、Kimi、腾讯混元、SiliconFlow 等**国内可直连**的服务商。国外服务（OpenAI、Claude）可能需要配置代理。

### Q5：免费额度用完了怎么办？
**A**：直接登录服务商控制台**充值即可**，费用由你与服务商结算；WPX 不会加价或抽成。也可以同时配置多个服务商轮换使用。

### Q6：哪个模型最适合中文写作？
**A**：综合推荐 **DeepSeek-V3 (`deepseek-chat`)**，中文写作能力一流且价格极低。其次推荐 **通义千问 Qwen-Plus**、**智谱 GLM-4-Air**、**Kimi (128K 长文本)**。

### Q7：哪个模型最适合写代码？
**A**：推荐 **DeepSeek-V3**（代码 SOTA 级）或 **Qwen2.5-Coder-32B**（通过 SiliconFlow 可用）。

### Q8：如何实现自动切换服务商？
**A**：在「我的模型」中依次添加多个服务商预设，并在高级设置中将「故障转移优先级」依次设置即可。

---

## 5. 故障排查

| 现象 | 可能原因 | 解决办法 |
|:---|:---|:---|
| 测试连接失败：401 | API Key 错误或失效 | 重新生成 API Key 并复制 |
| 测试连接失败：402 | 账户余额不足 | 登录服务商充值 |
| 测试连接失败：429 | 调用频率超限 | 等待或联系服务商提高 QPS |
| 测试连接失败：timeout | 网络不通 | 检查代理 / 切换国内服务商 |
| 模型乱码 / 答非所问 | 模型名称拼错 | 在服务商文档中确认准确的模型 ID |
| 上传图片后报错 | 当前模型不支持视觉 | 切换到支持视觉的模型（如 `gpt-4o`、`qwen-vl-max`） |
| 对话很慢 | 服务端推理慢 | 切换到更快 / 更小的模型（如 `glm-4-flash`、`qwen-turbo`） |

---

## 6. 隐私与安全承诺

- **API Key**：仅本机 AES-256 加密存储，**从不联网同步**。
- **对话内容**：仅发送给用户配置的目标服务商；WPX 服务器不存储、不分析、不训练。
- **遥测**：WPX 默认关闭所有遥测；用户可在「设置 → 数据与隐私」中显式开启（仍不包含 API Key 与对话内容）。

---

## 7. 反馈与帮助

- **问题反馈**：<https://github.com/wpx-team/wpx/issues>
- **讨论社区**：<https://github.com/wpx-team/wpx/discussions>
- **邮箱**：<hi@wpx.app>
- **官方文档**：<https://wpx.app/docs>

---

**附录：V1.0 → V1.1 迁移对照**

| V1.0 旧功能 | V1.1 替代方案 |
|:---|:---|
| WPX 公共大模型 | 用户在「我的模型」中配置第三方大模型 API |
| 每日 100M Token 免费额度 | 由服务商提供新用户免费额度（一般 100 万 ~ 1000 万 Token） |
| Token 充值 | 已下线；服务费用由用户与服务商结算 |
| 商业字体 Token | 已下线；商业字体由用户自行采购后导入本地 |
| 字体商店（付费区） | 已下线；内置 / 在线免费字体仍可下载 |
