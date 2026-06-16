// content.js — ページに注入されるペーストインターセプター
// rules.js が先に読み込まれている前提（manifest の js 配列順で保証）

(function () {
  "use strict";

  let settings = Object.assign({}, window.PasteGuard.DEFAULTS);

  chrome.storage.sync.get(window.PasteGuard.DEFAULTS, (s) => {
    settings = s;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const key in changes) {
      settings[key] = changes[key].newValue;
    }
  });

  // 再ディスパッチしたイベントを識別するためのフラグ
  let reinjecting = false;

  document.addEventListener(
    "paste",
    (e) => {
      // 自分が再ディスパッチしたペーストは素通り（無限ループ防止）
      if (reinjecting) return;

      if (!settings.enabled) return;

      const hostname = window.location.hostname;
      if ((settings.disabledSites || []).indexOf(hostname) !== -1) return;

      const target = e.target;
      if (!target) return;

      const tag = target.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";
      const isEditable = target.isContentEditable;
      if (!isInput && !isEditable) return;
      if (tag === "INPUT" && target.type === "password") return;

      let text = e.clipboardData && e.clipboardData.getData("text/plain");
      if (!text) return;

      // 改行コードを LF に正規化
      text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      const result = window.PasteGuard.maskText(text, settings);
      if (result.total === 0) return;

      // 元のペーストを止めて、マスク済みテキストを再ペーストする
      e.preventDefault();
      e.stopPropagation();

      insertMaskedText(target, isInput, result.masked);
      showToast(result.findings.length);
    },
    true
  );

  // マスク済みテキストを挿入する。
  // ClipboardEvent の再ディスパッチを第一手段とする。
  // これはユーザーの通常ペーストと同じ経路なので、
  // Lexical / ProseMirror / Angular など各種エディタで自然に動作する。
  function insertMaskedText(target, isInput, masked) {
    target.focus();

    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", masked);
      const ev = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      });

      reinjecting = true;
      target.dispatchEvent(ev);
      reinjecting = false;

      // dispatchEvent が preventDefault されていれば挿入成功
      if (ev.defaultPrevented) return;
    } catch (err) {
      reinjecting = false;
      // 続けてフォールバックへ
    }

    // フォールバック1: execCommand
    if (document.execCommand("insertText", false, masked)) return;

    // フォールバック2: 直接操作
    if (isInput) {
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      target.value = target.value.slice(0, start) + masked + target.value.slice(end);
      const pos = start + masked.length;
      target.setSelectionRange(pos, pos);
      target.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(masked);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  }

  function showToast(count) {
    const old = document.getElementById("__pasteguard_toast__");
    if (old) old.remove();

    const host = document.createElement("div");
    host.id = "__pasteguard_toast__";
    const shadow = host.attachShadow({ mode: "closed" });

    const box = document.createElement("div");
    box.textContent = "🛡️ " + count + "件のセンシティブ情報をマスクしました";
    box.style.cssText = [
      "position:fixed", "bottom:20px", "right:20px", "z-index:2147483647",
      "background:#18181b", "color:#fff", "padding:10px 16px",
      "border-radius:10px",
      "font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "box-shadow:0 4px 20px rgba(0,0,0,.35)",
      "opacity:0", "transition:opacity .2s", "pointer-events:none"
    ].join(";");

    shadow.appendChild(box);
    document.documentElement.appendChild(host);

    requestAnimationFrame(() => { box.style.opacity = "1"; });
    setTimeout(() => {
      box.style.opacity = "0";
      setTimeout(() => host.remove(), 300);
    }, 2800);
  }
})();
