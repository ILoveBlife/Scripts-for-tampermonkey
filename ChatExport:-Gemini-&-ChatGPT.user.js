// ==UserScript==
// @name         ייצוא שרשורים מג'מיני וצ'אט GPT - פרסמתי במתמחים טופ
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  ייצוא שרשורי שיחות מ-ChatGPT ו-Gemini לקובץ טקסט מסודר וקריא
// @author       I believe (https://mitmachim.top/user/i-believe)
// @match        *://chatgpt.com/*
// @match        *://gemini.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @updateURL    https://raw.githubusercontent.com/ILoveBlife/Scripts-for-tampermonkey/main/ChatExport:-Gemini-&-ChatGPT.user.js
// @downloadURL  https://raw.githubusercontent.com/ILoveBlife/Scripts-for-tampermonkey/main/ChatExport:-Gemini-&-ChatGPT.user.js
// @grant        GM_addStyle
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        btnId: 'ai-universal-export-btn',
        statusId: 'ai-export-status-window',
        overlayId: 'ai-export-overlay',
        forbiddenPhrases: [
            "Gemini אמר", "אמרת", "העתקה", "share", "Share", "Like", "Dislike",
            "הצגת תשובות נוספות", "דווח על בעיה משפטית", "Report", "Copy code",
            "Regenerate", "volume_up", "thumb_up", "thumb_down", "more_vert",
            "עריכה", "הקשבה", "טוב לדעת שזה עזר!", "שמירה ב-Drive", "You", "ChatGPT"
        ]
    };

    function injectCSS() {
        const styleId = 'ai-capturer-style-v15-0';
        if (document.getElementById(styleId)) return;
        const css = `
            #${CONFIG.btnId} {
                position: fixed !important; bottom: 25px !important; left: 25px !important;
                z-index: 999999 !important;
                width: 50px !important; height: 50px !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                background-color: #7dd3fc !important;
                color: #1d4ed8 !important;
                border: 1px solid #bae6fd !important;
                border-radius: 12px !important;
                cursor: pointer !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
                font-size: 28px !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            }
            #${CONFIG.btnId}:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5) !important;
            }
            #${CONFIG.overlayId} {
                position: fixed !important; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.7) !important; z-index: 1000000 !important;
                display: none; align-items: center; justify-content: center; backdrop-filter: blur(2px);
            }
            #${CONFIG.statusId} {
                background: #ffffff !important; color: #1f2937 !important;
                padding: 30px !important; border-radius: 15px !important;
                width: 350px !important; text-align: center !important;
                direction: rtl !important; font-family: system-ui, -apple-system, sans-serif !important;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5) !important;
            }
            .ai-spinner {
                border: 4px solid #f3f3f3; border-top: 4px solid #3b82f6;
                border-radius: 50%; width: 40px; height: 40px;
                animation: ai-spin 1s linear infinite; margin: 0 auto 20px;
            }
            @keyframes ai-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
    }

    function updateStatus(msg, isFinal = false) {
        let overlay = document.getElementById(CONFIG.overlayId);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = CONFIG.overlayId;
            const win = document.createElement('div');
            win.id = CONFIG.statusId;
            overlay.appendChild(win);
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
        const win = document.getElementById(CONFIG.statusId);
        while (win.firstChild) win.removeChild(win.firstChild);

        if (!isFinal) {
            const spinner = document.createElement('div');
            spinner.className = 'ai-spinner';
            win.appendChild(spinner);
        } else {
            const check = document.createElement('div');
            check.textContent = '✅'; check.style.fontSize = '40px'; check.style.marginBottom = '15px';
            win.appendChild(check);
        }

        const title = document.createElement('div');
        title.style.fontWeight = 'bold'; title.style.fontSize = '18px'; title.style.marginBottom = '10px';
        title.textContent = isFinal ? 'ייצוא קובץ' : 'ריענון היסטוריה';
        win.appendChild(title);

        const content = document.createElement('div');
        content.style.fontSize = '15px'; content.style.color = '#4b5553';
        content.textContent = msg;
        win.appendChild(content);
    }

    function cleanAndFormatContent(el) {
        let text = el.innerText;
        if (!text) return "";
        const listItems = el.querySelectorAll('li');
        listItems.forEach(li => {
            const liText = li.innerText.trim();
            if (liText && !liText.startsWith('*')) {
                text = text.replace(liText, `* ${liText}`);
            }
        });
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => {
                if (!line) return false;
                return !CONFIG.forbiddenPhrases.some(phrase => line === phrase || line.includes(phrase));
            })
            .join('\n');
    }

    function getSmartTitle() {
        let title = "";
        const isGemini = location.hostname.includes('gemini');
        if (isGemini) {
            const topBarTitle = document.querySelector('h1, [data-test-id="conversation-title"], .conversation-title');
            if (topBarTitle) title = topBarTitle.innerText;
        } else {
            const activeChat = document.querySelector('ol li div.bg-token-sidebar-surface-active');
            if (activeChat) title = activeChat.innerText;
        }
        if (!title || title.length < 2) title = document.title;
        title = title.replace(/Gemini|ChatGPT|Google|New chat|אמרת/gi, '').trim();
        return (title || "שיחת AI").replace(/[\\/:*?"<>|]/g, '').trim();
    }

    const sleep = ms => new Promise(res => setTimeout(res, ms));

    async function runExport() {
        const chatTitle = getSmartTitle();
        const threadUrl = window.location.href;
        updateStatus("סורק את כל ההודעות בשרשור...");

        const isGemini = location.hostname.includes('gemini');
        const scrollContainer = isGemini ? document.querySelector('main-content-scrollable-container') || window : document.querySelector('main') || window;
        let lastCount = 0, retries = 0;

        while (retries < 5) {
            const selector = isGemini ? 'user-query, model-response' : 'article, [data-testid*="conversation-turn"]';
            const elements = document.querySelectorAll(selector);
            updateStatus(`סורק הודעות... זוהו: ${elements.length}`);
            if (elements.length > 0) elements[0].scrollIntoView({ behavior: 'auto', block: 'start' });
            if (scrollContainer.scrollTo) scrollContainer.scrollTo(0, 0); else window.scrollTo(0, 0);
            await sleep(1200);
            const newElements = document.querySelectorAll(selector);
            if (newElements.length > lastCount) { lastCount = newElements.length; retries = 0; }
            else { retries++; }
            if (retries > 2 && ((scrollContainer === window ? window.scrollY : scrollContainer.scrollTop) === 0)) break;
        }

        updateStatus("מכין את קובץ התיעוד הסופי...");
        const msgSelector = isGemini ? 'user-query, model-response' : 'article, [data-testid*="conversation-turn"]';
        const finalElements = document.querySelectorAll(msgSelector);

        const d = new Date();
        const dateDots = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
        const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        let contentBuffer = `נושא: ${chatTitle}\n`;
        contentBuffer += `תאריך ייצוא: ${dateDots} | שעה: ${timeStr}\n`;
        contentBuffer += `קישור: ${threadUrl}\n`;
        contentBuffer += `${'='.repeat(60)}\n\n`;

        finalElements.forEach(el => {
            let role = (isGemini && (el.tagName.toLowerCase().includes('user') || el.closest('user-query'))) ||
                        (!isGemini && (el.querySelector('[data-message-author-role="user"]') || el.innerText.includes("אמרת")))
                        ? "אני" : (isGemini ? "Gemini" : "ChatGPT");

            const cleanText = cleanAndFormatContent(el);

            let fileInfo = "";
            let fileCount = 0;
            if (isGemini) {
                fileCount = el.querySelectorAll('inline-chip, img, .image-container').length;
            } else {
                fileCount = el.querySelectorAll('.file-attachment, [data-testid="attachment-wrapper"], img').length;
            }

            if (fileCount > 0) {
                fileInfo = `\n[להודעה זו מצורפים ${fileCount} קבצים]`;
            }

            if (cleanText || fileCount > 0) {
                contentBuffer += `[${role}]:\n${cleanText}${fileInfo}\n${'-'.repeat(40)}\n\n`;
            }
        });

        const fileName = `${dateDots} - ${chatTitle}.txt`;
        const blob = new Blob([contentBuffer.trim()], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();

        updateStatus("הקובץ נשמר בהצלחה!", true);
        await sleep(2200);
        document.getElementById(CONFIG.overlayId).style.display = 'none';
        if (finalElements.length > 0) finalElements[finalElements.length - 1].scrollIntoView({ behavior: 'smooth' });
    }

    function ensureButtonExists() {
        injectCSS();
        if (document.getElementById(CONFIG.btnId)) return;
        const btn = document.createElement('button');
        btn.id = CONFIG.btnId;
        btn.textContent = '💾';
        btn.title = "ריענון וייצוא היסטוריה";
        btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); runExport(); };
        document.body.appendChild(btn);
    }

    setInterval(ensureButtonExists, 1000);
})();
