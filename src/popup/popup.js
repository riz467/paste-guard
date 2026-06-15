// popup.js — 設定画面のロジック

(function () {
  "use strict";

  const master = document.getElementById("master");
  const rulesContainer = document.getElementById("rules");
  const body = document.body;

  let settings = Object.assign({}, window.PasteGuard.DEFAULTS);

  // 設定を読み込んでUIに反映
  chrome.storage.sync.get(window.PasteGuard.DEFAULTS, (s) => {
    settings = s;
    render();
  });

  function render() {
    master.checked = settings.enabled;
    body.classList.toggle("disabled", !settings.enabled);
    buildRules();
  }

  // ルール一覧を生成
  function buildRules() {
    rulesContainer.innerHTML = "";
    const disabled = settings.disabledRules || [];

    window.PasteGuard.RULES.forEach((rule) => {
      const row = document.createElement("div");
      row.className = "rule";

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = rule.label;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = disabled.indexOf(rule.id) === -1;
      cb.addEventListener("change", () => toggleRule(rule.id, cb.checked));

      row.appendChild(label);
      row.appendChild(cb);
      rulesContainer.appendChild(row);
    });
  }

  // 個別ルールの ON/OFF
  function toggleRule(id, enabled) {
    let disabled = (settings.disabledRules || []).slice();
    if (enabled) {
      disabled = disabled.filter((x) => x !== id);
    } else if (disabled.indexOf(id) === -1) {
      disabled.push(id);
    }
    settings.disabledRules = disabled;
    chrome.storage.sync.set({ disabledRules: disabled });
  }

  // マスター ON/OFF
  master.addEventListener("change", () => {
    settings.enabled = master.checked;
    body.classList.toggle("disabled", !settings.enabled);
    chrome.storage.sync.set({ enabled: settings.enabled });
  });
})();
