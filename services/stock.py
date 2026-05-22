import re
import requests

BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"


def _normalize_ticker(ticker: str) -> str:
    ticker = ticker.strip().upper()
    if re.match(r'^\d{6}$', ticker):
        if ticker.startswith(('0', '3')):
            return f"{ticker}.SZ"
        return f"{ticker}.SS"
    return ticker


def _yahoo_get(symbol: str, params: dict) -> dict:
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    })
    url = BASE_URL.format(symbol=symbol)
    resp = session.get(url, params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def fetch_stock_data(ticker: str) -> dict:
    symbol = _normalize_ticker(ticker)

    # 1-day data for current price
    day_data = _yahoo_get(symbol, {"range": "1d", "interval": "1d"})
    result = day_data["chart"]["result"][0]
    meta = result["meta"]
    current_price = meta["regularMarketPrice"]
    prev_close = meta.get("previousClose", current_price)
    change_percent = ((current_price - prev_close) / prev_close) * 100
    company_name = meta.get("longName") or meta.get("shortName") or symbol

    # 6-month data for period high/low
    hist_data = _yahoo_get(symbol, {"range": "6mo", "interval": "1d"})
    timestamps = hist_data["chart"]["result"][0]["timestamp"]
    quotes = hist_data["chart"]["result"][0]["indicators"]["quote"][0]
    highs = [h for h in quotes["high"] if h is not None]
    lows = [l for l in quotes["low"] if l is not None]
    volumes = [v for v in quotes["volume"] if v is not None]
    closes = [c for c in quotes["close"] if c is not None]

    period_high = max(highs) if highs else current_price
    period_low = min(lows) if lows else current_price
    volume = int(volumes[-1]) if volumes else 0

    return {
        "ticker": ticker,
        "symbol": symbol,
        "company_name": company_name,
        "current_price": round(float(current_price), 2),
        "change_percent": round(float(change_percent), 2),
        "period_high": round(float(period_high), 2),
        "period_low": round(float(period_low), 2),
        "volume": volume,
        "raw_data": {
            "period_high": round(float(period_high), 2),
            "period_low": round(float(period_low), 2),
            "recent_close": [round(float(c), 2) for c in closes[-5:]] if closes else [],
            "recent_volume": [int(v) for v in volumes[-5:]] if volumes else [],
        }
    }
