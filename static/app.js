const tickerInput = document.getElementById('tickerInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingCard = document.getElementById('loading');
const resultCard = document.getElementById('result');
const toastEl = document.getElementById('toast');

// Chip quick-select
document.getElementById('chipList').addEventListener('click', function(e) {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    tickerInput.value = chip.dataset.ticker;
    analyze();
});

// Enter key
tickerInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') analyze();
});

async function analyze() {
    const ticker = tickerInput.value.trim();
    if (!ticker) {
        showToast('请输入股票代码');
        tickerInput.focus();
        return;
    }

    analyzeBtn.disabled = true;
    loadingCard.style.display = 'block';
    resultCard.style.display = 'none';
    toastEl.style.display = 'none';

    try {
        const resp = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker }),
        });
        const data = await resp.json();

        if (!resp.ok) {
            showToast(data.error || '分析失败');
            return;
        }

        renderResult(data);
        if (data.supabase_error) console.warn('Supabase:', data.supabase_error);
        loadHistory();
    } catch (e) {
        showToast('网络错误: ' + e.message);
    } finally {
        analyzeBtn.disabled = false;
        loadingCard.style.display = 'none';
    }
}

function renderResult(data) {
    const isCn = /^\d/.test(data.ticker);
    const prefix = isCn ? '¥' : '$';
    const pos = data.change_percent >= 0;

    document.getElementById('resultTicker').textContent = data.ticker;
    document.getElementById('resultCompany').textContent = data.company_name;

    // Price with counting animation
    animateNumber('resultPrice', data.current_price, prefix);
    document.getElementById('resultHigh').textContent = prefix + data.period_high.toFixed(2);
    document.getElementById('resultLow').textContent = prefix + data.period_low.toFixed(2);
    document.getElementById('resultVolume').textContent = formatVolume(data.volume);

    // Change badge
    const badge = document.getElementById('resultChangeBadge');
    const sign = pos ? '+' : '';
    badge.textContent = sign + data.change_percent.toFixed(2) + '%';
    badge.className = 'price-change-badge ' + (data.change_percent > 0 ? 'up' : data.change_percent < 0 ? 'down' : 'flat');

    // AI
    document.getElementById('resultSummary').textContent = data.summary;

    const sentEl = document.getElementById('resultSentiment');
    sentEl.textContent = sentimentLabel(data.sentiment);
    sentEl.className = 'insight-badge ' + sentimentClass(data.sentiment);

    const riskEl = document.getElementById('resultRisk');
    riskEl.textContent = '风险: ' + data.risk_level;
    riskEl.className = 'insight-badge ' + riskClass(data.risk_level);

    // Raw data
    document.getElementById('rawData').textContent = JSON.stringify({
        ticker: data.ticker,
        company_name: data.company_name,
        current_price: data.current_price,
        change_percent: data.change_percent,
        period_high: data.period_high,
        period_low: data.period_low,
        volume: data.volume,
        summary: data.summary,
        sentiment: data.sentiment,
        risk_level: data.risk_level,
    }, null, 2);

    // Reset raw toggle
    document.querySelector('.raw-toggle').open = false;

    resultCard.style.display = 'block';
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function animateNumber(elId, target, prefix) {
    const el = document.getElementById(elId);
    const start = parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || target * 0.9;
    const duration = 600;
    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = start + (target - start) * eased;
        el.textContent = prefix + current.toFixed(2);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function sentimentLabel(s) {
    return { Bullish: '看涨', Neutral: '中性', Bearish: '看跌' }[s] || s;
}
function sentimentClass(s) {
    return { Bullish: 'bullish', Neutral: 'neutral', Bearish: 'bearish' }[s] || 'neutral';
}
function riskClass(r) {
    return { '低': 'risk-low', '中': 'risk-mid', '高': 'risk-high' }[r] || 'risk-mid';
}

function formatVolume(v) {
    if (v >= 1e8) return (v / 1e8).toFixed(1) + '亿';
    if (v >= 1e4) return (v / 1e4).toFixed(1) + '万';
    return v.toLocaleString();
}

function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    toastEl.style.animation = 'none';
    void toastEl.offsetWidth;
    toastEl.style.animation = 'slideIn 0.3s ease';
    clearTimeout(toastEl._timeout);
    toastEl._timeout = setTimeout(() => { toastEl.style.display = 'none'; }, 4000);
}

async function loadHistory() {
    try {
        const resp = await fetch('/api/history');
        const data = await resp.json();
        const list = document.getElementById('historyList');

        if (!data || data.length === 0) {
            list.innerHTML = '<p class="empty-hint">暂无分析记录，搜索股票开始分析吧</p>';
            return;
        }

        list.innerHTML = data.map(item => {
            const date = new Date(item.created_at);
            const now = new Date();
            const diff = now - date;
            const mins = Math.floor(diff / 60000);
            const timeStr = mins < 1 ? '刚刚' : mins < 60 ? mins + '分钟前' :
                date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

            const isCn = /^\d/.test(item.ticker);
            const prefix = isCn ? '¥' : '$';
            const change = Number(item.change_percent);
            const pos = change >= 0;
            const sClass = sentimentClass(item.sentiment);

            return `<div class="history-item" onclick="replay('${item.ticker}')">
                <span class="dot ${sClass}"></span>
                <div class="info">
                    <span class="ticker-name">${item.ticker}</span>
                    <span class="ticker-date">${timeStr}</span>
                </div>
                <div class="right">
                    <div class="price">${prefix}${Number(item.current_price).toFixed(2)}</div>
                    <div class="change ${pos ? 'up' : 'down'}">${pos ? '+' : ''}${change.toFixed(2)}%</div>
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        console.error('History:', e);
    }
}

function replay(ticker) {
    tickerInput.value = ticker;
    analyze();
}

loadHistory();
