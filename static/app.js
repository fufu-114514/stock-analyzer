async function analyze() {
    const input = document.getElementById('tickerInput');
    const btn = document.getElementById('analyzeBtn');
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const result = document.getElementById('result');
    const ticker = input.value.trim();

    if (!ticker) {
        showError('请输入股票代码');
        return;
    }

    btn.disabled = true;
    loading.style.display = 'block';
    error.style.display = 'none';
    result.style.display = 'none';

    try {
        const resp = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker }),
        });
        const data = await resp.json();

        if (!resp.ok) {
            showError(data.error || '分析失败');
            return;
        }

        renderResult(data);
        if (data.supabase_error) {
            console.warn('Supabase save failed:', data.supabase_error);
        }
        loadHistory();
    } catch (e) {
        showError('网络错误: ' + e.message);
    } finally {
        btn.disabled = false;
        loading.style.display = 'none';
    }
}

function renderResult(data) {
    document.getElementById('resultTicker').textContent = data.ticker;
    document.getElementById('resultCompany').textContent = data.company_name;
    document.getElementById('resultPrice').textContent = '¥' + data.current_price.toFixed(2);
    document.getElementById('resultHigh').textContent = '¥' + data.period_high.toFixed(2);
    document.getElementById('resultLow').textContent = '¥' + data.period_low.toFixed(2);
    document.getElementById('resultVolume').textContent = formatVolume(data.volume);
    document.getElementById('resultSummary').textContent = data.summary;

    const changeEl = document.getElementById('resultChange');
    const change = data.change_percent;
    changeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
    changeEl.className = 'price-change ' + (change >= 0 ? 'positive' : 'negative');

    const sentimentEl = document.getElementById('resultSentiment');
    sentimentEl.textContent = sentimentLabel(data.sentiment);
    sentimentEl.className = 'badge ' + sentimentClass(data.sentiment);

    const riskEl = document.getElementById('resultRisk');
    riskEl.textContent = '风险: ' + data.risk_level;
    riskEl.className = 'badge ' + riskClass(data.risk_level);

    document.getElementById('result').style.display = 'block';
}

function sentimentLabel(s) {
    const map = { 'Bullish': '看涨', 'Neutral': '中性', 'Bearish': '看跌' };
    return map[s] || s;
}

function sentimentClass(s) {
    const map = { 'Bullish': 'bullish', 'Neutral': 'neutral', 'Bearish': 'bearish' };
    return map[s] || 'neutral';
}

function riskClass(r) {
    const map = { '低': 'risk-low', '中': 'risk-mid', '高': 'risk-high' };
    return map[r] || 'risk-mid';
}

function formatVolume(v) {
    if (v >= 1e8) return (v / 1e8).toFixed(1) + '亿';
    if (v >= 1e4) return (v / 1e4).toFixed(1) + '万';
    return v.toString();
}

function showError(msg) {
    const el = document.getElementById('error');
    el.textContent = msg;
    el.style.display = 'block';
}

async function loadHistory() {
    try {
        const resp = await fetch('/api/history');
        const data = await resp.json();

        const list = document.getElementById('historyList');
        if (!data || data.length === 0) {
            list.innerHTML = '<p class="empty-hint">暂无分析记录</p>';
            return;
        }

        list.innerHTML = data.map(item => {
            const date = new Date(item.created_at).toLocaleString('zh-CN');
            const change = item.change_percent;
            const sign = change >= 0 ? '+' : '';
            return `<div class="history-item" onclick="loadFromHistory('${item.ticker}')">
                <div>
                    <span class="history-ticker">${item.ticker}</span>
                    <span class="badge ${sentimentClass(item.sentiment)}">${sentimentLabel(item.sentiment)}</span>
                </div>
                <div style="text-align:right;">
                    <span class="history-price">¥${Number(item.current_price).toFixed(2)} ${sign}${Number(change).toFixed(2)}%</span>
                    <br><span class="history-date">${date}</span>
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        console.error('Load history failed:', e);
    }
}

function loadFromHistory(ticker) {
    document.getElementById('tickerInput').value = ticker;
    analyze();
}

document.getElementById('tickerInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') analyze();
});

loadHistory();
