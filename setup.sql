-- Supabase 建表 SQL — 在 Supabase SQL Editor 中执行
CREATE TABLE IF NOT EXISTS stock_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker TEXT NOT NULL,
    company_name TEXT,
    current_price NUMERIC,
    change_percent NUMERIC,
    period_high NUMERIC,
    period_low NUMERIC,
    volume BIGINT,
    summary TEXT,
    sentiment TEXT,
    risk_level TEXT,
    raw_data JSONB,
    raw_llm_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 启用 RLS (Row Level Security)
ALTER TABLE stock_analyses ENABLE ROW LEVEL SECURITY;

-- 允许 anon 角色读写 (公开访问)
CREATE POLICY "Allow public read" ON stock_analyses
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON stock_analyses
    FOR INSERT WITH CHECK (true);
