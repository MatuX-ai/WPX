# WPX 集成 AnySearch 需求文档

**版本**：V1.1（开发中）  
**状态**：规划中 · 集成方案已确定，等待后端对接  
**关联文档**：PRD、AI 调度中心、jcode 集成、skillhub 需求、[技术架构总览 V2.0](./WPX%20技术架构总览%20V2.0.md)  
**最后更新**：2026-06-28

---

## 1. 概述

将 AnySearch 搜索引擎集成到 WPX 后端，作为 AI 对话的知识增强层。AnySearch 为 AI Agent 提供结构化的 Markdown 搜索结果，使大模型无需二次解析网页，直接基于高质量数据进行推理。WPX 用户无需感知 AnySearch，搜索体验自动提升。

**核心原则**：
- 对用户完全透明，搜索增强由后端自动调度
- 合理利用 AnySearch 免费额度（1000次/天）覆盖大部分用户需求
- 支持用户自带 AnySearch Key，不消耗平台额度
- 不可用时自动降级为纯 AI 回答，保证功能不中断

---

## 2. AnySearch 简介与核心优势

AnySearch 是一个面向 AI Agent 的搜索引擎 API，不同于传统搜索引擎返回链接列表，它直接返回结构化的 Markdown 格式内容。

| 特性 | 对 WPX 的价值 |
|:---|:---|
| **结构化 Markdown 输出** | 大模型可直接读取和引用，无需二次解析网页 |
| **16-23 个垂直领域穿透** | 金融、法律、学术、代码等专业数据源，远超通用搜索 |
| **高信息密度** | 一次搜索返回充分上下文，将原本七八轮的搜索压缩到一两次 |
| **每日 1000 次免费调用** | 零成本起步，MVP 阶段完全免费 |

---

## 3. 集成架构

### 3.1 整体数据流

```
用户说"查一下最新的个税政策"
    ↓
CopilotKit Runtime / AI 对话
    ↓
AI 调度中心 — 判断是否需要搜索增强
    ↓
┌─────────────────────┐
│   search-router.js   │
│   - 关键词检测       │
│   - 领域路由         │
└────────┬────────────┘
         ↓
┌─────────────────────┐
│  anysearch-client.js │
│   - API 调用         │
│   - 额度管理         │
│   - 结果格式化       │
└────────┬────────────┘
         ↓
    AnySearch API → 返回结构化 Markdown
         ↓
    注入大模型 System Prompt → 大模型生成回答
         ↓
    返回给用户
```

### 3.2 模块职责

| 模块 | 职责 | 文件 |
|:---|:---|:---|
| **AI 调度中心** | 判断是否需要搜索增强，路由决策 | `server/ai-router.js` |
| **搜索路由** | 判断查询类型，选择搜索领域 | `server/search-router.js` |
| **AnySearch 客户端** | 封装 API 调用，管理额度和错误处理 | `server/anysearch-client.js` |
| **用户 Key 管理** | 存储和读取用户自有的 AnySearch Key | 复用 `electron-store` |

---

## 4. 功能需求

### 4.1 搜索增强触发规则

| 触发条件 | 示例查询 | 领域参数 |
|:---|:---|:---|
| 包含"最新"、"政策"、"法规"、"规定" | "最新的个税起征点" | `legal` |
| 包含"论文"、"文献"、"研究"、"学术" | "近三年关于量子计算的论文" | `academic` |
| 包含"代码"、"API"、"函数"、"报错" | "Python 如何读取 CSV 文件" | `code` |
| 包含"股票"、"财报"、"经济数据" | "特斯拉最新季度营收" | `finance` |
| 包含"真题"、"考试"、"大纲"、"教材" | "2025年高考数学大纲" | `education` |
| 用户明确说"搜索"、"查一下"、"帮我搜" | "帮我搜一下气候变化最新报告" | `general` |
| 大模型自身不确定、需要实时数据 | 由大模型判断并返回搜索请求 | 自动 |

### 4.2 额度管理策略

| 额度来源 | 每日限额 | 适用场景 | 优先级 |
|:---|:---|:---|:---|
| **WPX 平台 Key** | 1000 次/天 | 所有未配置自有 Key 的用户共享 | 最低 |
| **用户自有 Key** | 按用户自身 Key 的限额 | 用户在设置中填写了自己的 AnySearch Key | 最高 |

**规则**：
- 每次搜索请求优先检查用户是否配置了自有 Key，有则使用，不计入平台额度。
- 平台 Key 每日 1000 次，按 UTC+8 零点重置。
- 额度用尽后，自动降级为纯 AI 回答，不报错。
- 在管理后台仪表盘显示今日 AnySearch 调用次数和剩余额度。

### 4.3 降级策略

| 场景 | 处理方式 |
|:---|:---|
| AnySearch API 超时（>5s） | 放弃搜索结果，使用纯 AI 回答 |
| 额度耗尽 | 使用纯 AI 回答，对话窗不提示 |
| 网络不可达 | 使用纯 AI 回答 |
| 返回结果为空 | 使用纯 AI 回答 |

**用户无感知降级**：所有降级场景不打断用户操作，不显示错误信息，只是搜索增强暂时失效。

### 4.4 用户自有 Key 配置

在 WPX 设置 → AI 模型配置页面，增加“搜索增强”区域：

```
┌──────────────────────────────────────┐
│  搜索增强                             │
│                                      │
│  AnySearch API Key（可选）            │
│  [____________________]  [测试连接]   │
│                                      │
│  配置后可享受无限制搜索增强。          │
│  不配置则使用 WPX 公共额度。           │
│  申请地址：https://anysearch.ai       │
└──────────────────────────────────────┘
```

---

## 5. Skill 增强清单

AnySearch 集成后，以下 Skills 将自动获得搜索增强能力：

| Skill | 增强效果 |
|:---|:---|
| **教案生成器** | 自动检索最新课标、教材版本、考试大纲，生成更准确的教案 |
| **论文大纲生成器** | 检索真实学术文献，提供可引用的参考文献 |
| **跨学科关联** | 检索真实应用案例和数据，关联更扎实 |
| **概念解释器** | 检索百科和权威定义，给出更准确的解释 |
| **智能出题** | 检索历年真题和考试大纲，生成更贴近考试的题目 |
| **考前冲刺计划** | 检索最新考试政策和时间安排 |
| **错题复盘** | 检索同类题型和标准解法 |
| **知识库构建** | 检索专业领域资料，构建更完整的知识框架 |

---

## 6. 技术实现

### 6.1 anysearch-client.js

```javascript
// server/anysearch-client.js
class AnySearchClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.anysearch.ai/v1';
    this.dailyLimit = 1000;
    this.usedToday = 0;
    this.resetTime = this.getNextResetTime();
  }

  async search(query, domain = 'general') {
    // 检查额度
    if (this.usedToday >= this.dailyLimit) {
      return { hitLimit: true };
    }
    
    try {
      const response = await fetch(`${this.baseURL}/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, domain, format: 'markdown' }),
        signal: AbortSignal.timeout(5000)
      });
      
      this.usedToday++;
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  }
}
```

### 6.2 search-router.js

```javascript
// server/search-router.js
function shouldUseSearch(userMessage) {
  const searchPatterns = [
    { pattern: /最新|最近|当前|现在|今年|本月/, domain: 'general' },
    { pattern: /政策|法规|法律|条例|规定|文件/, domain: 'legal' },
    { pattern: /论文|文献|研究|学术|期刊|doi/i, domain: 'academic' },
    { pattern: /代码|编程|函数|API|bug|报错|sdk/i, domain: 'code' },
    { pattern: /股票|财报|营收|市值|股价|经济/, domain: 'finance' },
    { pattern: /真题|考试|高考|考研|大纲|教材|课标/, domain: 'education' },
  ];
  
  // 用户明确说搜索
  if (/搜索|查一下|帮我搜|帮我查|search/i.test(userMessage)) {
    return { shouldSearch: true, domain: 'general' };
  }
  
  for (const { pattern, domain } of searchPatterns) {
    if (pattern.test(userMessage)) {
      return { shouldSearch: true, domain };
    }
  }
  
  return { shouldSearch: false };
}
```

### 6.3 集成到 AI 调度中心

在 `server/ai-router.js` 的消息处理流程中：

```javascript
async function processMessage(userMessage, context) {
  // 判断是否需要搜索增强
  const { shouldSearch, domain } = shouldUseSearch(userMessage);
  
  if (shouldSearch) {
    const apiKey = context.userKey || PLATFORM_ANYSEARCH_KEY;
    const searchResult = await anysearchClient.search(userMessage, domain);
    
    if (!searchResult.hitLimit && !searchResult.error) {
      // 将搜索结果注入 System Prompt
      context.systemPrompt += `\n\n[搜索增强] 以下是从网络检索到的相关信息，请基于此回答：\n${searchResult.markdown}`;
    }
  }
  
  // 调用大模型
  return await callLLM(userMessage, context);
}
```

---

## 7. 管理后台监控

在 admin.proclaw.cc 的仪表盘中增加 AnySearch 统计卡片：

| 监控项 | 说明 |
|:---|:---|
| 今日调用次数 | 平台 Key 已使用次数 / 1000 |
| 剩余额度 | 1000 - 已使用 |
| 调用趋势图 | 近 7 天每日调用量 |
| 用户自有 Key 使用比例 | 自有 Key 调用次数 / 总调用次数 |
| 搜索领域分布 | 各 domain 的调用占比（饼图） |

---

## 8. 验收标准

1. 用户查询“最新的个税政策”时，AI 回复引用真实政策内容。 ✅
2. 用户查询不需要搜索的简单问题时，不调用 AnySearch。 ✅
3. 平台 Key 额度耗尽后，AI 正常回复，不报错。 ✅
4. 用户配置自有 AnySearch Key 后，调用不计入平台额度。 ✅
5. 搜索超时 5 秒自动降级，用户无感知。 ✅
6. 管理后台正确显示今日调用次数和剩余额度。 ✅
7. Skills（教案生成、论文大纲等）生成内容中包含检索到的真实信息。 ✅
8. 用户自有 Key 测试连接功能正常。 ✅

---
