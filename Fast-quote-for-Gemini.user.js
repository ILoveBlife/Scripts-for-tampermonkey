// ==UserScript==
// @name         Fast quote for Gemini
// @name:he      ציטוט מהיר לג'מיני
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  ציטוט טקסט מסומן ישירות לתיבת הצ'אט של ג'מיני
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
            transition: opacity 0.1s ease;
        }
        #gh-quote-popup.visible { display: block !important; }
        @media (prefers-color-scheme: dark) {
            #gh-quote-popup { background: #303134; color: #e8eaed; border-color: #8ab4f8; }
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

    // פונקציית עזר להצבת הפופ-אפ בתוך גבולות המסך
    function positionPopup(x, y) {
        const popupWidth = 120;
        const popupHeight = 40;
        
        let finalX = Math.min(Math.max(10, x), window.innerWidth - popupWidth);
        let finalY = y - popupHeight;
        if (finalY < 10) finalY = y + 20;

        quotePopup.style.left = finalX + 'px';
        quotePopup.style.top = finalY + 'px';
        quotePopup.classList.add('visible');
    }

    // 4. זיהוי סימון הטקסט והצגת הפופ-אפ (עכבר ומקלדת)
    function handleSelectionCheck(e) {
        const sel = window.getSelection();
        const text = sel ? sel.toString().trim() : '';

        if (text.length > 2 && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            const posX = e.clientX || (rect.left + rect.width / 2);
            const posY = e.clientY || rect.top;
            
            positionPopup(posX, posY);
        } else {
            setTimeout(() => {
                const currentSel = window.getSelection();
                if (!currentSel || currentSel.toString().trim().length <= 2) {
                    quotePopup.classList.remove('visible');
                }
            }, 150);
        }
    }

    document.addEventListener('mouseup', handleSelectionCheck);
    document.addEventListener('keyup', (e) => {
        if (e.shiftKey) handleSelectionCheck(e);
    });

    // 5. לוגיקת הציטוט, ניהול הסמן וגלילה לסוף
    quotePopup.onmousedown = (e) => {
        e.preventDefault();
        const sel = window.getSelection();
        const rawText = sel ? sel.toString().trim() : '';
        const editor = getEditor();

        if (editor && rawText) {
            // הוספת > בתחילת כל שורה
            const quotedLines = rawText
                .split('\n')
                .map(line => `> ${line.trim()}`)
                .join('\n');
            
            const formattedText = `${quotedLines}\n\n`;

            editor.focus();

            // מעבר לסוף התוכן הקיים בעורך
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(editor);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);

            // הזרקת הטקסט
            const success = document.execCommand('insertText', false, formattedText);

            // מנגנון גיבוי במקרה של חסימה
            if (!success) {
                editor.innerText += formattedText;
                editor.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // הצבת הסמן בסוף וגלילה למטה
            setTimeout(() => {
                editor.focus();
                
                // קביעת מיקום הסמן בסוף
                const finalRange = document.createRange();
                const finalSel = window.getSelection();
                finalRange.selectNodeContents(editor);
                finalRange.collapse(false);
                finalSel.removeAllRanges();
                finalSel.addRange(finalRange);

                // גלילת תיבת הטקסט הפנימית לסוף
                editor.scrollTop = editor.scrollHeight;
                if (editor.parentElement) {
                    editor.parentElement.scrollTop = editor.parentElement.scrollHeight;
                }

                // גלילת הדף כדי לוודא שתיבת הקלט נראית על המסך
                editor.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 30);

            if (sel) sel.removeAllRanges();
            quotePopup.classList.remove('visible');
        }
    };

})();
