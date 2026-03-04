let dictionaryData = [];
let questionsData = [];
let targetQuestions = [];
let currentQuestionIndex = 0;
const STORAGE_KEY = 'hoi-gaku_marks';

// UI要素の取得
const resultsContainer = document.getElementById('results');
const searchInput = document.getElementById('search-input');
const flashcard = document.getElementById('flashcard');

// カテゴリー一覧 (Tag Cloud用)
const CATEGORIES = ['すべて', '保育理論', '発達心理学', '保健・安全', '児童福祉', '実習記録用表現'];

function setupFilterUI() {
    const parent = document.getElementById('dictionary-view');
    const oldFilter = parent.querySelector('.filter-container');
    if (oldFilter) oldFilter.remove();

    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';

    CATEGORIES.forEach(cat => {
        const btn = document.createElement('button');
        btn.textContent = cat;
        btn.className = 'filter-btn';
        if (cat === 'すべて') btn.classList.add('active');
        btn.onclick = () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterByCategory(cat);
        };
        filterContainer.appendChild(btn);
    });

    const searchCont = document.querySelector('.search-container');
    searchCont.parentNode.insertBefore(filterContainer, searchCont.nextSibling);
}

async function init() {
    await Promise.all([loadDictionary(), loadQuestions()]);
    setupFilterUI();
    setupTabs();
    setupFlashcard();
    setupSearch();
    filterByCategory('すべて'); // 初期表示
}

async function loadDictionary() {
    const res = await fetch('dictionary.json');
    dictionaryData = await res.json();
    // データの正規化（過去のsceneプロパティ等への安全対策）
    dictionaryData.forEach(d => {
        if (!d.category) d.category = d.scene || 'その他';
        if (!d.points) d.points = [];
    });
}

// 2段階ソート：一次=カテゴリー順, 二次=五十音順
function sortData(data) {
    return [...data].sort((a, b) => {
        const catA = CATEGORIES.indexOf(a.category);
        const catB = CATEGORIES.indexOf(b.category);
        if (catA !== catB) return catA - catB; // カテゴリーでソート
        return a.reading.localeCompare(b.reading, 'ja'); // カテゴリーが同じなら五十音順
    });
}

// 仮想スクロール（Intersection Observerを用いた遅延読み込み）
let renderQueue = [];
let observer = null;

function renderDictionary(data) {
    resultsContainer.innerHTML = '';

    if (observer) observer.disconnect();

    if (data.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results" style="text-align:center; padding:40px; color:#999;">該当する用語はありません。</div>';
        return;
    }

    renderQueue = [...data];
    let currentCategory = null;

    function renderChunk(count) {
        const chunk = renderQueue.splice(0, count);
        chunk.forEach(item => {
            // カテゴリーヘッダーの描画（カテゴリーが変わった時のみ）
            if (currentCategory !== item.category) {
                currentCategory = item.category;
                const header = document.createElement('h3');
                header.className = 'category-header';
                header.textContent = `■ ${currentCategory}`;
                resultsContainer.appendChild(header);
            }

            const card = document.createElement('div');
            card.className = 'term-card';
            card.innerHTML = `
                <div class="term-header">
                    <span class="term-reading">${item.reading}</span>
                    <h2 class="term-title">${item.term}<span class="scene-tag">${item.category}</span></h2>
                </div>
                <div class="term-section"><h4>意味</h4><p>${item.meaning}</p></div>
                <div class="hint-block">
                    <h4>日誌のヒント</h4>
                    <p>${item.hint}</p>
                    <button class="copy-btn">📋 コピー</button>
                </div>
                ${item.points && item.points.length > 0 ? `
                <div class="term-section">
                    <h4>着眼点</h4>
                    <div class="observation-list">
                        ${item.points.map(p => `<span class="obs-item">${p}</span>`).join('')}
                    </div>
                </div>` : ''}
            `;
            const copyBtn = card.querySelector('.copy-btn');
            copyBtn.onclick = () => copyToClipboard(item.hint);
            resultsContainer.appendChild(card);
        });

        // 大量データが残っている場合、遅延読み込み用の番兵（Sentinel）を設置
        if (renderQueue.length > 0) {
            const sentinel = document.createElement('div');
            sentinel.className = 'sentinel';
            sentinel.style.height = '1px';
            resultsContainer.appendChild(sentinel);

            if (!observer) {
                observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            observer.unobserve(entry.target);
                            entry.target.remove();
                            // 次のチャンク（15件）を描画
                            renderChunk(15);
                        }
                    });
                }, { rootMargin: '200px' });
            }
            observer.observe(sentinel);
        }
    }

    // 初回は15件だけ描画（以降はスクロールにあわせて自動追加）
    renderChunk(15);
}

function filterByCategory(category) {
    const query = searchInput.value.toLowerCase();
    let filtered = dictionaryData;

    if (category !== 'すべて') {
        filtered = filtered.filter(i => i.category === category);
    }

    if (query) {
        filtered = filtered.filter(i =>
            i.term.includes(query) || i.reading.includes(query) || (i.meaning && i.meaning.includes(query))
        );
    }

    renderDictionary(sortData(filtered));
}

// Debounce（入力遅延）関数の実装
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function setupSearch() {
    const handleSearch = () => {
        const activeBtn = document.querySelector('.filter-btn.active');
        const cat = activeBtn ? activeBtn.textContent : 'すべて';
        filterByCategory(cat);
    };

    // ユーザーの入力・タイピングが止まってから300ms後に検索処理を実行（カクつき防止）
    searchInput.oninput = debounce(handleSearch, 300);
}

// ----------------------------------------------------
// 既存のフラッシュカード、クリップボード、タブ切り替えロジック等
// ----------------------------------------------------
async function loadQuestions() { const res = await fetch('questions.json'); questionsData = await res.json(); }
function copyToClipboard(text) {
    if (navigator.clipboard) { navigator.clipboard.writeText(text).then(() => alert('コピーしました！')); }
    else { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); alert('コピーしました！'); }
}
function setupTabs() {
    const tabs = ['tab-dictionary', 'tab-test', 'tab-about'];
    const views = ['dictionary-view', 'test-view', 'about-view'];
    tabs.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.onclick = () => {
            tabs.forEach(t => { if (document.getElementById(t)) document.getElementById(t).classList.remove('active'); });
            views.forEach(v => { if (document.getElementById(v)) document.getElementById(v).classList.remove('active-view'); });
            document.getElementById(id).classList.add('active');
            document.getElementById(views[idx]).classList.add('active-view');
            if (id === 'tab-test') startTest();
        };
    });
}
function setupFlashcard() {
    if (!flashcard) return;
    flashcard.onclick = (e) => { if (!e.target.closest('.action-btn')) flashcard.classList.toggle('is-flipped'); };
    document.getElementById('btn-next').onclick = (e) => { e.stopPropagation(); currentQuestionIndex++; if (currentQuestionIndex >= targetQuestions.length) startTest(); else showQuestion(); };
    document.getElementById('btn-mark').onclick = (e) => { e.stopPropagation(); toggleMark(targetQuestions[currentQuestionIndex].id); updateMarkUI(); };
    const toggleFocus = document.getElementById('review-focus-toggle');
    if (toggleFocus) toggleFocus.onchange = startTest;
}
function startTest() {
    const marks = getMarks();
    const toggleFocus = document.getElementById('review-focus-toggle');
    targetQuestions = (toggleFocus && toggleFocus.checked) ? questionsData.filter(q => marks.includes(q.id)) : [...questionsData];
    if (targetQuestions.length === 0) { if (toggleFocus) toggleFocus.checked = false; targetQuestions = [...questionsData]; }
    targetQuestions = targetQuestions.sort(() => Math.random() - 0.5);
    currentQuestionIndex = 0;
    if (targetQuestions.length > 0) showQuestion();
}
function showQuestion() {
    const q = targetQuestions[currentQuestionIndex];
    document.getElementById('fc-category').textContent = q.category;
    document.getElementById('fc-question').textContent = q.question;
    document.getElementById('fc-hint').textContent = q.hint || q.answer;
    document.getElementById('fc-answer').textContent = q.answer;
    flashcard.classList.remove('is-flipped');
    updateProgress();
    updateMarkUI();
}
function updateProgress() {
    const p = ((currentQuestionIndex + 1) / targetQuestions.length) * 100;
    const bar = document.getElementById('progress-bar');
    if (bar) bar.style.setProperty('--progress', `${p}%`);
    const txt = document.getElementById('progress-text');
    if (txt) txt.textContent = `${currentQuestionIndex + 1} / ${targetQuestions.length}`;
}
function getMarks() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function toggleMark(id) { let m = getMarks(); m = m.includes(id) ? m.filter(i => i !== id) : [...m, id]; localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); }
function updateMarkUI() {
    const btn = document.getElementById('btn-mark');
    if (!btn) return;
    const isMarked = getMarks().includes(targetQuestions[currentQuestionIndex].id);
    btn.classList.toggle('marked', isMarked);
    btn.textContent = isMarked ? '❌ 苦手解除' : '⚠️ 苦手';
}

init();
