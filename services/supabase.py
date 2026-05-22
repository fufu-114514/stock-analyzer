import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_supabase: Client = None


def _get_client() -> Client:
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL 或 SUPABASE_ANON_KEY 未设置")
        _supabase = create_client(url, key)
    return _supabase


def save_analysis(data: dict) -> dict:
    """Save analysis result to Supabase. Returns the inserted record."""
    client = _get_client()
    result = client.table("stock_analyses").insert({
        "ticker": data["ticker"],
        "company_name": data["company_name"],
        "current_price": data["current_price"],
        "change_percent": data["change_percent"],
        "period_high": data["period_high"],
        "period_low": data["period_low"],
        "volume": data["volume"],
        "summary": data["summary"],
        "sentiment": data["sentiment"],
        "risk_level": data["risk_level"],
        "raw_data": data["raw_data"],
        "raw_llm_response": data["raw_llm_response"],
    }).execute()
    return result.data[0] if result.data else None


def get_history(limit: int = 20) -> list:
    """Get recent analysis history from Supabase."""
    client = _get_client()
    result = client.table("stock_analyses").select("*").order("created_at", desc=True).limit(limit).execute()
    return result.data
