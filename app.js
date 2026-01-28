// Configuration
// 請將此處的 URL 替換為您的 Google Apps Script 部署網址
const CONFIG = {
    GAS_API_URL: 'https://script.google.com/macros/s/AKfycbxszLyeVpp_3UMwOVY4dszotVi0_vjzJ-jOYAp6ZgxyUA9sTuQg0hrQvs8K8GklPmyr/exec',
};

// State
const state = {
    isLoading: false
};

// DOM Elements
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const submitForm = document.getElementById('submit-form');
const queryForm = document.getElementById('query-form');
const submitBtn = submitForm.querySelector('button');
const queryBtn = queryForm.querySelector('button');
const resultCard = document.getElementById('result-card');
const playAudioBtn = document.getElementById('play-audio-btn');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initForms();
    initAudio();
});

// 1. Tab Switching
function initTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => {
                c.classList.remove('active');
                c.classList.add('hidden'); // Ensure hidden is applied
                setTimeout(() => c.classList.remove('hidden'), 0); // Hack for display:none transition
            });

            // Add active class
            tab.classList.add('active');
            const target = tab.dataset.tab;
            const targetSection = document.getElementById(`${target}-section`);
            targetSection.classList.add('active');
        });
    });
}

// 2. Forms Handling
function initForms() {
    // Submit Work
    submitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (state.isLoading) return;

        const name = document.getElementById('submit-name').value.trim();
        const content = document.getElementById('submit-content').value.trim();

        if (!name || !content) return;

        setLoading(submitBtn, true);

        try {
            const response = await callGAS('submit', { name, content });
            showMessage('submit', '作品提交成功！', 'success');
            submitForm.reset();
        } catch (error) {
            console.error(error);
            showMessage('submit', '提交失敗，請檢查網路或稍後再試。', 'error');
        } finally {
            setLoading(submitBtn, false);
        }
    });

    // Query Feedback
    queryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (state.isLoading) return;

        const name = document.getElementById('query-name').value.trim();
        if (!name) return;

        setLoading(queryBtn, true);
        resultCard.classList.add('hidden');

        try {
            const data = await callGAS('query', { name });

            if (data && data.found) {
                displayResult(data);
            } else {
                showMessage('query', '找不到該姓名的評語，請確認姓名是否正確。', 'error');
            }
        } catch (error) {
            console.error(error);
            showMessage('query', '查詢失敗，請檢查網路或稍後再試。', 'error');
        } finally {
            setLoading(queryBtn, false);
        }
    });
}

// 3. API Communication
async function callGAS(action, payload) {
    if (CONFIG.GAS_API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
        // Mock response for testing if URL is not set
        return mockResponse(action, payload);
    }

    const url = `${CONFIG.GAS_API_URL}?action=${action}`;

    // Using simple POST for everything to avoid caching and simplify sending data
    // Or use GET for query if preferred. GAS handles POST well.
    // However, for 'query', GET is semantically correct. 
    // Let's use POST for submit and GET for query as typical practice.

    let options = {};
    let fetchUrl = url;

    if (action === 'submit') {
        options = {
            method: 'POST',
            body: JSON.stringify(payload)
            // Note: standard fetch to GAS requires specific setup (text/plain) to avoid CORS preflight issues sometimes,
            // but standard JSON usually works if GAS handles OPTIONS. 
            // Safest for GAS is actually sending as standard form data or 'text/plain' body and parsing in GAS.
            // Let's use 'text/plain' to be safe against CORS complicated setup.
        };
        // Changing to text/plain to prevent detailed CORS preflight checks which often fail on simple GAS scripts
        options.body = JSON.stringify(payload);
        options.headers = { 'Content-Type': 'text/plain' };
    } else {
        // GET
        const params = new URLSearchParams(payload);
        fetchUrl = `${url}&${params.toString()}`;
    }

    const res = await fetch(fetchUrl, options);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
}

// Mock for local testing without backend
function mockResponse(action, payload) {
    return new Promise((resolve) => {
        setTimeout(() => {
            if (action === 'submit') {
                resolve({ success: true });
            } else {
                // Mock Query
                if (payload.name === '測試') {
                    resolve({
                        found: true,
                        name: payload.name,
                        time: new Date().toLocaleString(),
                        four_char: '別出心裁',
                        feedback: '這是一段測試用的文字回饋。你的作品結構完整，創意十足，特別是在色彩運用上非常大膽。建議可以再加強細節的描寫。'
                    });
                } else {
                    resolve({ found: false });
                }
            }
        }, 1500);
    });
}

// 4. UI Helpers
function displayResult(data) {
    document.getElementById('result-time').textContent = data.time || new Date().toLocaleDateString();
    document.getElementById('result-four-char').textContent = data.four_char || '暫無評語';
    document.getElementById('result-feedback').textContent = data.feedback || '尚無文字回饋';

    resultCard.classList.remove('hidden');
    // Store text for audio
    resultCard.dataset.speechText = data.feedback || '';
}

function showMessage(section, text, type) {
    const el = document.getElementById(`${section}-message`);
    el.textContent = text;
    el.className = `message ${type}`;
    el.style.color = type === 'error' ? '#ff6b6b' : '#51cf66';
    el.style.marginTop = '10px';
    el.style.fontSize = '0.9rem';

    setTimeout(() => {
        el.textContent = '';
    }, 5000);
}

function setLoading(btn, isLoading) {
    state.isLoading = isLoading;
    const textSpan = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.loader');

    if (isLoading) {
        textSpan.classList.add('hidden');
        loader.classList.remove('hidden');
    } else {
        textSpan.classList.remove('hidden');
        loader.classList.add('hidden');
    }
}

// 5. Audio Feature (TTS)
function initAudio() {
    playAudioBtn.addEventListener('click', () => {
        const text = resultCard.dataset.speechText;
        if (!text) return;

        // Cancel current speaking
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW'; // Mandarin TW
        utterance.rate = 1;
        utterance.pitch = 1;

        window.speechSynthesis.speak(utterance);

        // Simple visual feedback
        playAudioBtn.textContent = '🔊 播放中...';
        utterance.onend = () => {
            playAudioBtn.textContent = '▶ 播放語音';
        };
    });
}
