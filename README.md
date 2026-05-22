# AI 股票分析面板

全栈应用：输入股票代码 → 获取行情数据 → LLM 智能分析 → 存入 Supabase。

**在线访问**: [special-octo-guide.onrender.com](https://special-octo-guide.onrender.com)  
**GitHub**: [fufu-114514/stock-analyzer](https://github.com/fufu-114514/stock-analyzer)

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | FastAPI (Python) + Jinja2 |
| 前端 | 原生 HTML/CSS/JS |
| 股票数据 | Yahoo Finance v8 API (免费) |
| AI 分析 | DeepSeek API |
| 数据库 | Supabase |
| 部署 | Render.com |

## 功能

- 支持美股 (AAPL, TSLA) 和 A 股 (600519, 000001)
- A 股代码自动识别：6 位数字 → `.SS`(沪) / `.SZ`(深)
- LLM 分析返回严格 JSON：summary / sentiment / risk_level
- 历史记录存储在 Supabase
- Supabase 不可用时优雅降级（仍返回分析结果）

## 本地运行

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入:
#   DEEPSEEK_API_KEY=sk-xxx
#   SUPABASE_URL=https://xxx.supabase.co
#   SUPABASE_ANON_KEY=eyJhbGciOi...

# 3. 在 Supabase SQL Editor 执行 setup.sql 建表

# 4. 启动
python main.py
# 访问 http://localhost:8000
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址 (默认 https://api.deepseek.com) |
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_ANON_KEY` | Supabase Anon Key |

---

## 交付 1: LLM Prompt 代码

以下是强制 LLM 只返回 JSON 的 Prompt 实现 (`services/llm.py`):

```python
SYSTEM_PROMPT = """你是一个专业的股票分析助手。根据提供的行情数据，用中文分析该股票并给出评估。

**你必须严格返回以下JSON格式，不要包含任何其他文字、解释或markdown标记：**

{"summary":"用中文写一段80-120字的分析总结","sentiment":"Bullish/Neutral/Bearish","risk_level":"低/中/高"}

**规则：**
- 只返回JSON对象本身，不要有任何前缀、后缀或代码块标记
- summary使用中文，80-120字
- sentiment必须是 Bullish、Neutral 或 Bearish 之一
- risk_level必须是 低、中 或 高 之一"""

# 调用时同时设置 response_format 双重保障
response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"请分析以下股票数据并返回JSON：\n\n{stock_summary}"},
    ],
    temperature=0.3,
    response_format={"type": "json_object"},  # DeepSeek 原生 JSON 模式
)
```

**JSON 解析兜底**（防止 LLM 仍然包了 markdown 代码块）:

```python
def _parse_llm_response(text: str) -> dict:
    text = text.strip()
    # 1. 去 markdown 包裹
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
    # 2. 尝试直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 3. 正则兜底提取
    m = re.search(r'\{[^{}]*"summary"[^{}]*"sentiment"[^{}]*"risk_level"[^{}]*\}', text, re.DOTALL)
    if m:
        return json.loads(m.group())
    raise ValueError(f"无法从LLM返回中解析JSON: {text[:200]}")
```

### Prompt 设计思路

| 策略 | 作用 |
|------|------|
| System Prompt 强制声明格式 | LLM 的首要指令就是 JSON-only |
| `response_format={"type":"json_object"}` | API 级别的 JSON 约束 |
| `temperature=0.3` | 低温度减少随机性，提高格式遵守率 |
| 正则兜底解析 | 即使 LLM 多说了话，也能提取 JSON 核心 |
| 三层解析（去 markdown → json.loads → 正则） | 最大化容错 |

---

## 交付 2: Debug 记录

### Bug: yfinance 持续限流导致无法获取数据

**现象**：部署后调用 `/api/analyze` 持续报错 `Too Many Requests. Rate limited.`

```
YFRateLimitError: Too Many Requests. Rate limited. Try after a while.
```

**排查过程**：
1. 初始怀疑：yfinance 对 API 调用频率有限制 → 添加 `time.sleep()` 重试 → 无效
2. 换用 `yf.download()` 替代 `Ticker.history()` → 依然限流
3. 添加 `requests.Session()` + 自定义 User-Agent → 依然限流
4. 直接测试 `yf.download()` 命令行脚本 → 发现报错信息中包含 SSL EOF 错误
5. 意识到是 **IP 级别被 Yahoo 限流**（国内网络环境常见）

**解决**：绕过 yfinance 库，直接调用 Yahoo Finance v8 REST API：

```python
# 替换前 (使用 yfinance)
import yfinance as yf
stock = yf.Ticker("AAPL")
history = stock.history(period="6mo")  # → Rate limit error

# 替换后 (直接 HTTP 调用)
import requests
url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
resp = requests.get(url, params={"range": "6mo", "interval": "1d"})
data = resp.json()
```

**教训**：第三方库的封装层可能触发额外的请求（yfinance 内部会先请求 cookie/crumb），反而增加限流风险。直接使用底层 API 更可控。

---

## 项目结构

```
├── main.py                 # FastAPI 入口
├── requirements.txt        # Python 依赖
├── .env.example            # 环境变量模板
├── .gitignore
├── setup.sql               # Supabase 建表 SQL
├── services/
│   ├── stock.py            # Yahoo Finance API 封装
│   ├── llm.py              # DeepSeek LLM 调用
│   └── supabase.py         # Supabase CRUD
├── templates/
│   └── index.html          # 前端页面
├── static/
│   ├── style.css           # 样式
│   └── app.js              # 前端逻辑
└── README.md
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/` | 前端页面 |
| `POST` | `/api/analyze` | 分析股票 `{"ticker": "AAPL"}` |
| `GET` | `/api/history` | 历史分析记录 |

## Render.com 部署

```bash
# 1. 推送到 GitHub
git init && git add . && git commit -m "init: stock analyzer"
git remote add origin <your-repo-url>
git push -u origin main

# 2. 在 Render.com 创建 Web Service
#    - Build Command: pip install -r requirements.txt
#    - Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
#    - 添加环境变量 (DEEPSEEK_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY)
```
