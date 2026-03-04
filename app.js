let dictionaryData = [];
let questionsData = [];
let targetQuestions = [];
let currentQuestionIndex = 0;
const STORAGE_KEY = 'hoi-gaku_marks';

// DOM
const resultsContainer = document.getElementById('results');
const searchInput = document.getElementById('search-input');
const flashcard = document.getElementById('flashcard');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const toggleFocus = document.getElementById('review-focus-toggle');

// 初期化
async function init() {
    await Promise.all([loadDictionary(), loadQuestions()]);
    setupTabs();
    setupFlashcard();
    setupSearch();
}

async function loadDictionary() {
    const res = await fetch('dictionary.json');
    dictionaryData = await res.json();
    renderDictionary(dictionaryData);
}

async function loadQuestions() {
    const res = await fetch('questions.json');
    questionsData = await res.json();
}

function renderDictionary(data) {
    resultsContainer.innerHTML = '';
    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'term-card';
        card.innerHTML = `
            <div class="term-header">
                <span class="term-reading">${item.reading}</span>
                <h2 class="term-title">${item.term}<span class="scene-tag">${item.scene}</span></h2>
            </div>
            <div class="term-section"><h4>意味</h4><p>${item.meaning}</p></div>
            <div class="hint-block">
                <h4>日誌のヒント</h4>
                <p>${item.hint}</p>
                <button class="copy-btn">📋 コピー</button>
            </div>
            <div class="term-section">
                <h4>着眼点</h4>
                <div class="observation-list">
                    ${item.points.map(p => `<span class="obs-item">${p}</span>`).join('')}
                </div>
            </div>
        `;
        const copyBtn = card.querySelector('.copy-btn');
        copyBtn.onclick = () => copyToClipboard(item.hint);
        resultsContainer.appendChild(card);
    });
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => alert('コピーしました！'));
    } else {
        const t = document.createElement('textarea');
        t.value = text; document.body.appendChild(t); t.select();
        document.execCommand('copy'); document.body.removeChild(t);
        alert('コピーしました！');
    }
}

function setupTabs() {
    const tabs = ['tab-dictionary', 'tab-test', 'tab-about'];
    const views = ['dictionary-view', 'test-view', 'about-view'];
    tabs.forEach((id, idx) => {
        document.getElementById(id).onclick = () => {
            tabs.forEach(t => document.getElementById(t).classList.remove('active'));
            views.forEach(v => document.getElementById(v).classList.remove('active-view'));
            document.getElementById(id).classList.add('active');
            document.getElementById(views[idx]).classList.add('active-view');
            if (id === 'tab-test') startTest();
        };
    });
}

function setupSearch() {
    searchInput.oninput = (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = dictionaryData.filter(i => 
            i.term.includes(q) || i.reading.includes(q) || i.scene.includes(q)
        );
        renderDictionary(filtered);
    };
}

function setupFlashcard() {
    flashcard.onclick = (e) => {
        if (!e.target.closest('.action-btn')) flashcard.classList.toggle('is-flipped');
    };
    document.getElementById('btn-next').onclick = (e) => {
        e.stopPropagation();
        currentQuestionIndex++;
        if (currentQuestionIndex >= targetQuestions.length) startTest();
        else showQuestion();
    };
    document.getElementById('btn-mark').onclick = (e) => {
        e.stopPropagation();
        toggleMark(targetQuestions[currentQuestionIndex].id);
        updateMarkUI();
    };
    toggleFocus.onchange = startTest;
}

function startTest() {
    const marks = getMarks();
    targetQuestions = toggleFocus.checked 
        ? questionsData.filter(q => marks.includes(q.id))
        : [...questionsData];
    
    if (targetQuestions.length === 0) {
        alert('苦手な問題がありません。');
        toggleFocus.checked = false;
        targetQuestions = [...questionsData];
    }
    
    targetQuestions = targetQuestions.sort(() => Math.random() - 0.5);
    currentQuestionIndex = 0;
    showQuestion();
}

function showQuestion() {
    const q = targetQuestions[currentQuestionIndex];
    document.getElementById('fc-category').textContent = q.category;
    document.getElementById('fc-question').textContent = q.question;
    document.getElementById('fc-hint').textContent = q.hint;
    document.getElementById('fc-answer').textContent = q.answer;
    flashcard.classList.remove('is-flipped');
    updateProgress();
    updateMarkUI();
}

function updateProgress() {
    const p = ((currentQuestionIndex + 1) / targetQuestions.length) * 100;
    progressBar.style.setProperty('--progress', `${p}%`);
    progressText.textContent = `${currentQuestionIndex + 1} / ${targetQuestions.length}`;
}

function getMarks() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function toggleMark(id) {
    let m = getMarks();
    m = m.includes(id) ? m.filter(i => i !== id) : [...m, id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
}
function updateMarkUI() {
    const btn = document.getElementById('btn-mark');
    const isMarked = getMarks().includes(targetQuestions[currentQuestionIndex].id);
    btn.classList.toggle('marked', isMarked);
    btn.textContent = isMarked ? '❌ 苦手解除' : '⚠️ 苦手';
}

init();
