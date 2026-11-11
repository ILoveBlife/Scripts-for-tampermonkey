// ==UserScript==
// @name         Email quote
// @name:he      ציטוט למייל
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  מסמן טקסט בג'ימייל, מזהה את שם השולח, ומצטט בעיצוב מקצועי.
// @author       I believe (https://mitmachim.top/user/i-believe)
// @match        https://mail.google.com/*
// @updateURL    https://raw.githubusercontent.com/ILoveBlife/Scripts-for-tampermonkey/main/Email-quote.user.js
// @downloadURL  https://raw.githubusercontent.com/ILoveBlife/Scripts-for-tampermonkey/main/Email-quote.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  /* ---------------------------------------------------------------------- */
  /* הזרקת עיצוב ה-CSS לעמוד                                               */
  /* ---------------------------------------------------------------------- */
  const style = document.createElement("style");
  style.textContent = `
    .qr-float-btn {
      position: fixed;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: rgba(26, 115, 232, 0.95);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Google Sans", sans-serif;
      font-size: 13.5px;
      font-weight: 600;
      letter-spacing: 0.2px;
      border-radius: 24px;
      box-shadow: 0 4px 16px rgba(26, 115, 232, 0.25), 0 2px 6px rgba(0, 0, 0, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
      cursor: pointer;
      user-select: none;
      direction: rtl;
      opacity: 0;
      transform: translateY(6px) scale(0.94);
      transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1),
                  transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
                  background-color 0.15s ease,
                  box-shadow 0.15s ease;
      pointer-events: none;
    }

    .qr-float-btn svg {
      width: 15px;
      height: 15px;
      fill: currentColor;
      flex-shrink: 0;
    }

    .qr-float-btn.qr-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    .qr-float-btn:hover {
      background: rgba(21, 88, 176, 1);
      box-shadow: 0 6px 20px rgba(26, 115, 232, 0.35), 0 3px 8px rgba(0, 0, 0, 0.15);
      transform: translateY(-1px) scale(1.02);
    }

    .qr-float-btn:active {
      background: rgba(14, 63, 133, 1);
      transform: translateY(1px) scale(0.98);
      box-shadow: 0 2px 8px rgba(26, 115, 232, 0.2);
    }
  `;
  document.head.appendChild(style);

  /* ---------------------------------------------------------------------- */
  /* לוגיקת התוסף                                                           */
  /* ---------------------------------------------------------------------- */
  const MESSAGE_BODY_SELECTOR = ".a3s.aiL, .a3s";
  const OPEN_MESSAGE_CONTAINER_SELECTOR = ".adn.ads, .gs";
  const NON_USER_CONTENT_SELECTOR = ".gmail_signature, div.gmail_quote, .gmail_extra";

  let floatBtn = null;
  let currentSelectionText = "";
  let currentMessageContainer = null;
  let lastComposeRange = null;
  let lastComposeBody = null;

  function ensureButton() {
    if (floatBtn) return floatBtn;
    floatBtn = document.createElement("div");
    floatBtn.className = "qr-float-btn";

    const quoteIcon = `
      <svg viewBox="0 0 24 24">
        <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
      </svg>
    `;

    floatBtn.innerHTML = `${quoteIcon} <span>ציטוט ותגובה</span>`;

    floatBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    floatBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleQuoteAndReplyClick();
    });
    document.documentElement.appendChild(floatBtn);
    return floatBtn;
  }

  function showButtonAt(rect) {
    const btn = ensureButton();
    const btnTop = rect.top - 44 < 8 ? rect.bottom + 8 : rect.top - 44;
    const btnLeft = Math.min(
      Math.max(rect.left + rect.width / 2 - 65, 8),
      window.innerWidth - 140
    );
    btn.style.top = `${btnTop}px`;
    btn.style.left = `${btnLeft}px`;
    btn.classList.add("qr-visible");
  }

  function hideButton() {
    if (floatBtn) floatBtn.classList.remove("qr-visible");
  }

  function rememberComposeCaret(selection) {
    if (!selection || selection.rangeCount === 0) return;
    try {
      const range = selection.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      if (!el) return;
      const body = getEditableBodies().find((b) => b.contains(el));
      if (body) {
        lastComposeBody = body;
        lastComposeRange = range.cloneRange();
      }
    } catch (err) {}
  }

  function onSelectionChange() {
    const selection = window.getSelection();
    rememberComposeCaret(selection);

    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      currentSelectionText = "";
      currentMessageContainer = null;
      hideButton();
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      hideButton();
      return;
    }

    let range;
    try {
      range = selection.getRangeAt(0);
    } catch (e) {
      hideButton();
      return;
    }

    const anchorNode = range.commonAncestorContainer;
    const anchorEl = anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : anchorNode;

    const bodyEl = anchorEl ? anchorEl.closest(MESSAGE_BODY_SELECTOR) : null;
    if (!bodyEl) {
      hideButton();
      return;
    }

    currentSelectionText = text;
    currentMessageContainer = bodyEl.closest(OPEN_MESSAGE_CONTAINER_SELECTOR) || bodyEl;

    const rect = range.getBoundingClientRect();
    if (rect && (rect.width || rect.height)) {
      showButtonAt(rect);
    } else {
      hideButton();
    }
  }

  document.addEventListener("selectionchange", debounce(onSelectionChange, 100));

  document.addEventListener("mousedown", (e) => {
    if (floatBtn && (e.target === floatBtn || floatBtn.contains(e.target))) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        hideButton();
      }
    }, 0);
  });

  function debounce(fn, wait) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function getSenderName(messageContainer) {
    if (!messageContainer) return "השולח/ת";
    
    const senderEl = messageContainer.closest('.adn')?.querySelector('.gD') ||
                     messageContainer.querySelector('.gD') ||
                     messageContainer.closest('[role="region"]')?.querySelector('span[name]');

    if (senderEl) {
      return senderEl.getAttribute('name') || senderEl.textContent.trim();
    }

    const fallbackEl = messageContainer.closest('.adn')?.querySelector('.Hn') ||
                       messageContainer.closest('.iiwrap')?.previousElementSibling?.querySelector('.gD');
    if (fallbackEl) {
      return fallbackEl.textContent.trim();
    }

    return "השולח/ת";
  }

  function handleQuoteAndReplyClick() {
    if (!currentSelectionText || !currentMessageContainer) return;

    const quotedText = currentSelectionText;
    const senderName = getSenderName(currentMessageContainer);

    hideButton();
    try {
      window.getSelection().removeAllRanges();
    } catch (e) {}

    const openCompose = findOpenComposeBody();
    if (openCompose) {
      insertQuoteIntoComposeBody(openCompose, quotedText, senderName);
      return;
    }

    const replyBtn = findReplyButton();
    if (!replyBtn) {
      console.warn('[ציטוט ותגובה] לא נמצא כפתור "תשובה".');
      return;
    }

    const existingEditables = new Set(getEditableBodies());
    simulateClick(replyBtn);

    waitForNewComposeBody(existingEditables, (composeBody) => {
      insertQuoteIntoComposeBody(composeBody, quotedText, senderName);
    });
  }

  function findOpenComposeBody() {
    const editables = getEditableBodies().filter(
      (el) => isElementVisible(el) && !el.closest(MESSAGE_BODY_SELECTOR)
    );
    if (!editables.length) return null;

    if (lastComposeBody && editables.includes(lastComposeBody)) return lastComposeBody;

    const thread = currentMessageContainer ? currentMessageContainer.closest('[role="main"]') : null;
    if (thread) {
      const inThread = editables.filter((el) => thread.contains(el));
      if (inThread.length) return inThread[inThread.length - 1];
    }
    return editables[editables.length - 1];
  }

  function simulateClick(el) {
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new MouseEvent("mouseover", opts));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.dispatchEvent(new MouseEvent("click", opts));
  }

  function isElementVisible(el) {
    if (!el) return false;
    if (el.offsetParent === null && el.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function findTextButtonsByExactText(targets) {
    const lowerTargets = targets.map((t) => t.toLowerCase());
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const matches = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.nodeValue || "").trim();
      if (!text) continue;
      if (!lowerTargets.includes(text.toLowerCase())) continue;
      const parent = node.parentElement;
      if (!parent || !isElementVisible(parent)) continue;
      matches.push(parent);
    }
    return matches;
  }

  function excludeUnwanted(el) {
    const name = (el.getAttribute("aria-label") || el.textContent || "").trim().toLowerCase();
    return (
      name.includes("all") ||
      name.includes("forward") ||
      name.includes("לכולם") ||
      name.includes("העבר")
    );
  }

  function findReplyButton() {
    let matches = findTextButtonsByExactText(["Reply", "תשובה"]).filter(
      (el) => !excludeUnwanted(el)
    );

    if (!matches.length) {
      const candidates = Array.from(
        document.querySelectorAll('[role="button"], [role="link"], [aria-label], [data-tooltip]')
      ).filter(isElementVisible);
      matches = candidates.filter((el) => {
        const name = (el.getAttribute("aria-label") || el.getAttribute("data-tooltip") || "")
          .trim()
          .toLowerCase();
        return (name === "reply" || name === "תשובה") && !excludeUnwanted(el);
      });
    }

    if (!matches.length) return null;
    return matches[matches.length - 1];
  }

  function getEditableBodies() {
    return Array.from(
      document.querySelectorAll('div[contenteditable="true"][role="textbox"], div[g_editable="true"][contenteditable="true"]')
    );
  }

  function waitForNewComposeBody(existingSet, callback, timeoutMs = 8000) {
    const start = Date.now();
    const observer = new MutationObserver(() => {
      const current = getEditableBodies();
      const fresh = current.find((el) => !existingSet.has(el));
      if (fresh) {
        observer.disconnect();
        setTimeout(() => callback(fresh), 150);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function containsRtl(str) {
    return /[\u0590-\u05FF\u0600-\u06FF]/.test(str);
  }

  function buildQuoteHtml(quotedText, senderName) {
    const escapedText = escapeHtml(quotedText).replace(/\n/g, "<br>");
    const escapedSender = escapeHtml(senderName);
    const rtl = containsRtl(quotedText);

    const borderStyle = rtl
      ? "border-right: 3px solid #1a73e8; margin: 8px 4px 8px 0px; padding: 8px 14px 8px 0px;"
      : "border-left: 3px solid #1a73e8; margin: 8px 0px 8px 4px; padding: 8px 0px 8px 14px;";

    const bgStyle = "background-color: #f1f3f4; border-radius: 6px;";
    const fontStyle = "font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13.5px; color: #202124; line-height: 1.6;";

    // הוסרו לחלוטין כל תגיות ה-BR והרווחים המיותרים בסוף הציטוט
    return (
      `<blockquote class="gmail_quote" dir="${rtl ? "rtl" : "ltr"}" style="margin: 0; ${borderStyle} ${bgStyle} ${fontStyle}">` +
      `<div style="margin-bottom: 4px; font-weight: bold; color: #1a73e8;">${escapedSender} כתב/ה:</div>` +
      `<div>${escapedText}</div>` +
      "</blockquote>"
    );
  }

  function placeCaretForInsertion(composeBody) {
    const selection = window.getSelection();
    let range = null;

    if (
      lastComposeBody === composeBody &&
      lastComposeRange &&
      composeBody.contains(lastComposeRange.commonAncestorContainer)
    ) {
      try {
        range = lastComposeRange.cloneRange();
        range.collapse(false);
        const node = range.commonAncestorContainer;
        const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        const bq = el ? el.closest("blockquote") : null;
        if (bq && composeBody.contains(bq)) {
          range.setStartAfter(bq);
          range.collapse(true);
        }
      } catch (e) {
        range = null;
      }
    }

    if (!range) {
      range = document.createRange();
      const children = Array.from(composeBody.children);
      const stopIdx = children.findIndex(
        (c) => c.matches(NON_USER_CONTENT_SELECTOR) || !!c.querySelector(NON_USER_CONTENT_SELECTOR)
      );
      const userChildren = stopIdx === -1 ? children : children.slice(0, stopIdx);
      const last = userChildren[userChildren.length - 1];
      if (!last) {
        range.selectNodeContents(composeBody);
        range.collapse(true);
      } else if (!last.textContent.trim() && !last.querySelector("img, blockquote")) {
        range.selectNodeContents(last);
        range.collapse(true);
      } else {
        range.setStartAfter(last);
        range.collapse(true);
      }
    }

    try {
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (e) {}
    
    return range;
  }

  function insertQuoteIntoComposeBody(composeBody, quotedText, senderName) {
    composeBody.focus();
    const range = placeCaretForInsertion(composeBody);
    const quoteHtml = buildQuoteHtml(quotedText, senderName);

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = quoteHtml;

    const frag = document.createDocumentFragment();
    let node;
    let lastNode = null;
    while ((node = tempDiv.firstChild)) {
      lastNode = frag.appendChild(node);
    }

    try {
      range.insertNode(frag);
      if (lastNode) {
        const newRange = document.createRange();
        // במקום לדחוף את הסמן מעבר לבלוק עם שורה ריקה, נמקם אותו ממש בסוף או מחוץ לבלוק בצורה נקייה
        newRange.setStartAfter(lastNode);
        newRange.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } catch (err) {
      console.error("[ציטוט ותגובה] שגיאה בהכנסת הציטוט:", err);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
