// content.js — ページに注入されるペーストインターセプター
// rules.js が先に読み込まれている前提（manifest の js 配列順で保証）

(function () {
  "use strict";

  // 設定をキャッシュ（chrome.storage は非同期なので起動時に読む）
  let settings = Object.assign({}, window.PasteGuard.DEFAULTS);

  chrome.storage.sync.get(window.PasteGuard.DEFAULTS, (s) => {
    settings = s;
  });

  // ポップアップで設定が変わったら追従
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const key in changes) {
      settings[key] = changes[key].newValue;
    }
  });

  // paste をキャプチャフェーズで横取り
  document.addEventListener(
    "paste",
    (e) => {
      if (!settings.enabled) return;

      const target = e.target;
      if (!target) return;

      // 入力先が編集可能要素かチェック
      const tag = target.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";
      const isEditable = target.isContentEditable;
      if (!isInput && !isEditable) return;

      // パスワード欄は対象外
      if (tag === "INPUT" && target.type === "password") return;

      const text = e.clipboardData && e.clipboardData.getData("text/plain");
      if (!text) return;

      const result = window.PasteGuard.maskText(text, settings);

      // 何も検知しなければ通常のペーストに任せる
      if (result.total === 0) return;

      // ここから先は自前で挿入する
      e.preventDefault();
      e.stopPropagation();

      insertText(target, isInput, result.masked);
      showToast(result.findings.length);
    },
    true
  );

  // マスク済みテキストを挿入する。
  // contenteditable / textarea ともに execCommand を使うことで
  // React・ProseMirror 等のフレームワークに変更を正しく伝える。
  function insertText(target, isInput, masked) {
    target.focus();

    // execCommand は仕様上 deprecated だが、各フレームワークが
    // 依然これを入力イベントの発生源として認識するため最も確実。
    const ok = document.execCommand("insertText", false, masked);
    if (ok) return;

    // フォールバック（execCommand が無効な環境向け）
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

  // 画面右下に簡易トースト通知を出す（Shadow DOM で隔離）
  function showToast(count) {
    const old = document.getElementById("__pasteguard_toast__");
    if (old) old.remove();

    const host = document.createElement("div");
    host.id = "__pasteguard_toast__";
    const shadow = host.attachShadow({ mode: "closed" });

    const box = document.createElement("div");
    box.textContent = "🛡️ " + count + "件のセンシティブ情報をマスクしました";
    box.style.cssText = [
      "position:fixed",
      "bottom:20px",
      "right:20px",
      "z-index:2147483647",
      "background:#18181b",
      "color:#fff",
      "padding:10px 16px",
      "border-radius:10px",
      "font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "box-shadow:0 4px 20px rgba(0,0,0,.35)",
      "opacity:0",
      "transition:opacity .2s",
      "pointer-events:none"
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
