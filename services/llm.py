import json
import re
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()

SYSTEM_PROMPT = """你是一个专业的股票分析助手。根据提供的行情数据，用中文分析该股票并给出评估。

**你必须严格返回以下JSON格式，不要包含任何其他文字、解释或markdown标记：**

{"summary":"用中文写一段80-120字的分析总结","sentiment":"Bullish/Neutral/Bearish","risk_level":"低/中/高"}

**规则：**
- 只返回JSON对象本身，不要有任何前缀、后缀或代码块标记
- summary使用中文，80-120字
- sentiment必须是 Bullish、Neutral 或 Bearish 之一
- risk_level必须是 低、中 或 高 之一"""


def _parse_llm_response(text: str) -> dict:
    """Parse LLM response to extract JSON. Falls back to regex extraction."""
    text = text.strip()

    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    m = re.search(r'\{[^{}]*"summary"[^{}]*"sentiment"[^{}]*"risk_level"[^{}]*\}', text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass

    raise ValueError(f"无法从LLM返回中解析JSON: {text[:200]}")


def analyze_stock(stock_data: dict) -> dict:
    """Call DeepSeek LLM to analyze stock data. Returns parsed JSON dict."""
    client = OpenAI(
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
    )

    stock_summary = f"""股票代码: {stock_data['ticker']}
公司名称: {stock_data['company_name']}
当前价格: {stock_data['current_price']}
涨跌幅: {stock_data['change_percent']}%
6个月最高: {stock_data['period_high']}
6个月最低: {stock_data['period_low']}
成交量: {stock_data['volume']}"""

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"请分析以下股票数据并返回JSON：\n\n{stock_summary}"},
        ],
        max_tokens=500,
        temperature=0.3,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    parsed = _parse_llm_response(raw)

    return {
        "summary": parsed["summary"],
        "sentiment": parsed["sentiment"],
        "risk_level": parsed["risk_level"],
        "raw_llm_response": parsed,
    }
