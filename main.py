import os
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv

from services.stock import fetch_stock_data
from services.llm import analyze_stock
from services.supabase import save_analysis, get_history

load_dotenv()

app = FastAPI(title="Stock Analyzer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/api/analyze")
async def api_analyze(request: Request):
    try:
        body = await request.json()
        ticker = body.get("ticker", "").strip()
        if not ticker:
            return JSONResponse({"error": "请输入股票代码"}, status_code=400)

        stock_data = fetch_stock_data(ticker)
        llm_result = analyze_stock(stock_data)

        result = {**stock_data, **llm_result}

        supabase_error = None
        try:
            save_analysis(result)
        except Exception as e:
            supabase_error = str(e)

        response = {
            "ticker": result["ticker"],
            "company_name": result["company_name"],
            "current_price": result["current_price"],
            "change_percent": result["change_percent"],
            "period_high": result["period_high"],
            "period_low": result["period_low"],
            "volume": result["volume"],
            "summary": result["summary"],
            "sentiment": result["sentiment"],
            "risk_level": result["risk_level"],
        }
        if supabase_error:
            response["supabase_error"] = supabase_error

        return JSONResponse(response)

    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": f"服务器错误: {str(e)}"}, status_code=500)


@app.get("/api/history")
async def api_history():
    try:
        data = get_history(limit=20)
        return JSONResponse(data)
    except ValueError as e:
        return JSONResponse({"error": str(e), "data": []}, status_code=500)
    except Exception as e:
        return JSONResponse({"error": f"查询失败: {str(e)}", "data": []}, status_code=500)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
