# Stock Analyzer — Design Spec

## Overview

A full-stack app that takes a stock ticker, fetches market data via yfinance, analyzes it with DeepSeek LLM, stores results in Supabase, and deploys to Render.com.

## Tech Stack

- **Backend**: FastAPI (Python) + Jinja2 templates
- **Frontend**: Simple HTML/CSS/JS served by FastAPI
- **Stock Data**: yfinance (free, no API key)
- **LLM**: DeepSeek API (OpenAI-compatible SDK)
- **Database**: Supabase
- **Deploy**: Render.com

## Architecture

```
D:\gushi\
├── main.py              # FastAPI entry point
├── requirements.txt     # Dependencies
├── .env                 # Secrets (API keys, Supabase URL)
├── .env.example         # Template for .env
├── services/
│   ├── stock.py         # yfinance data fetching
│   ├── llm.py           # DeepSeek API (JSON mode)
│   └── supabase.py      # Supabase CRUD operations
├── templates/
│   └── index.html       # Frontend page (Jinja2)
├── static/
│   ├── style.css
│   └── app.js           # AJAX calls to backend
└── README.md
```

## Data Flow

1. User enters stock ticker (e.g., AAPL or 600519.SS)
2. Browser POSTs ticker to `/api/analyze`
3. Backend calls yfinance to get: current price, change %, period high/low, volume, company name
4. Backend sends stock data to DeepSeek with strict JSON system prompt
5. Backend parses LLM JSON response (retry on parse failure)
6. Backend saves to Supabase `stock_analyses` table
7. Returns full analysis result to frontend for display

## Supabase Schema

Table: `stock_analyses`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, gen_random_uuid() |
| ticker | text | Stock symbol |
| company_name | text | From yfinance |
| current_price | numeric | |
| change_percent | numeric | |
| period_high | numeric | 52-week or period high |
| period_low | numeric | |
| volume | bigint | |
| summary | text | LLM Chinese summary (80-120 chars) |
| sentiment | text | Bullish / Neutral / Bearish |
| risk_level | text | 低 / 中 / 高 |
| raw_data | jsonb | Full yfinance response |
| raw_llm_response | jsonb | Full LLM response |
| created_at | timestamptz | now() |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Serve frontend page |
| POST | `/api/analyze` | Body: `{"ticker": "AAPL"}` → analyze + store → return JSON |
| GET | `/api/history` | Return recent analyses (last 20) |

## LLM Prompt Design

System prompt forces strict JSON output. `response_format={"type": "json_object"}` used as backup.

Key rules in prompt:
- Return ONLY the JSON object, no prefix/suffix/markdown
- summary: 80-120 Chinese characters
- sentiment: exactly Bullish / Neutral / Bearish
- risk_level: exactly 低 / 中 / 高

## Frontend UI

- Single page with search input + analyze button
- Result card showing: price, change, sentiment badge (color-coded), risk level, summary
- History list below
- No framework — vanilla HTML/CSS/JS

## Ticker Format Handling

- US stocks: bare symbol (AAPL, TSLA)
- A-shares (SH): append `.SS` (600519.SS)
- A-shares (SZ): append `.SZ` (000001.SZ)
- Auto-detect: 6-digit numeric = Shanghai, 0/3-prefix 6-digit = Shenzhen

## Error Handling

- Invalid ticker → show user-friendly error
- yfinance timeout → timeout after 10s
- LLM returns invalid JSON → retry once, then return raw text
- Supabase unavailable → still return analysis (degraded mode)
- CORS → configured via FastAPI CORSMiddleware

## Deliverables (per README requirements)

1. Online access URL (Render.com)
2. LLM prompt code/screenshot — showing how JSON-only output is enforced
3. Debug record — documented bug-fix example during development

## Verification

1. Enter `AAPL` → see analysis result with sentiment badge and price
2. Enter `600519.SS` → A-share analysis works
3. Check Supabase dashboard → record appears in `stock_analyses`
4. Check GET `/api/history` → returns stored records
5. Deploy to Render.com → live URL works
6. Enter garbage ticker → graceful error message
