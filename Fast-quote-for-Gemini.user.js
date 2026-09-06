// ==UserScript==
// @name         ציטוט מהיר לג'מיני
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  ציטוט טקסט מסומן ישירות לתיבת הצ'אט של ג'מיני והצבת הסמן בסוף
// @author       I believe (https://mitmachim.top/user/i-believe)
// @match        https://gemini.google.com/*
// @updateURL    https://raw.githubusercontent.com/ILoveBlife/Scripts-for-tampermonkey/main/Fast-quote-for-Gemini.user.js
// @downloadURL  https://raw.githubusercontent.com/ILoveBlife/Scripts-for-tampermonkey/main/Fast-quote-for-Gemini.user.js
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 1. הזרקת עיצוב הציטוט והפופ-אפ
    GM_addStyle(`
        #gh-quote-popup {
            position: fixed !important;
            z-index: 2147483647 !important;
            background: #ffffff; color: #000;
            padding: 8px 12px; border-radius: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            display: none; cursor: pointer;
            font-family: sans-serif; font-weight: bold;
            border: 1px solid #1a73e8;
            user-select: none;
        }
        #gh-quote-popup.visible { display: block !important; }
        @media (prefers-color-scheme: dark) {
            #gh-quote-popup { background: #303134; color: #e8eaed; }
        }
    `);

    // 2. איתור עורך הטקסט המעודכן של ג'מיני
    function getEditor() {
        return document.querySelector('rich-textarea [contenteditable="true"]') ||
               document.querySelector('.ql-editor') ||
               document.querySelector('[contenteditable="true"]') ||
               document.querySelector('textarea[id*="prompt"]');
    }

    // 3. יצירת אלמנט הפופ-אפ ב-DOM
    const quotePopup = document.createElement('div');
    quotePopup.id = 'gh-quote-popup';
    quotePopup.innerText = '💬 צטט לצ\'אט';
    document.body.appendChild(quotePopup);

    // 4. זיהוי סימון הטקסט והצגת הפופ-אפ
    document.addEventListener('mouseup', (e) => {
        const sel = window.getSelection();
        const text = sel ? sel.toString().trim() : '';

        if (text.length > 2) {
            const topPos = Math.max(10, e.clientY - 40);
            quotePopup.style.left = e.clientX + 'px';
            quotePopup.style.top = topPos + 'px';
            quotePopup.classList.add('visible');
        } else {
            setTimeout(() => {
                const currentSel = window.getSelection();
                if (!currentSel || currentSel.toString().trim().length <= 2) {
                    quotePopup.classList.remove('visible');
                }
            }, 150);
        }
    });

    // 5. לוגיקת הציטוט וניהול הסמן בעת לחיצה
    quotePopup.onmousedown = (e) => {
        e.preventDefault();
        const sel = window.getSelection();
        const text = sel ? sel.toString().trim() : '';
        const editor = getEditor();

        if (editor && text) {
            const formattedText = `> ${text}\n\n`;

            editor.focus();

            // מעבר לסוף התוכן הקיים בעורך
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(editor);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);

            // הזרקת הטקסט מול ה-State הפנימי של העורך
            const success = document.execCommand('insertText', false, formattedText);

            // חלופה למקרה של חסימה
            if (!success) {
                editor.innerText += formattedText;
                editor.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // הצבת הסמן בסוף לאחר סיום הרנדור של ג'מיני
            setTimeout(() => {
                editor.focus();
                const finalRange = document.createRange();
                const finalSel = window.getSelection();
                finalRange.selectNodeContents(editor);
                finalRange.collapse(false);
                finalSel.removeAllRanges();
                finalSel.addRange(finalRange);
            }, 20);

            if (sel) sel.removeAllRanges();
            quotePopup.classList.remove('visible');
        }
    };

})();
