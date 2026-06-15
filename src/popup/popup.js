// popup.js — 設定画面のロジック

(function () {
  "use strict";

  const master     = document.getElementById("master");
  const siteToggle = document.getElementById("siteToggle");
  const siteName   = document.getElementById("siteName");
  const kv         = document.getElementById("kv");
  const entropy    = document.getElementById("entropy");
  const thresh     = document.getElementById("thresh");
  const threshVal  = document.getElementById("threshVal");
  const threshWrap = document.getElementById("threshWrap");
  const rulesContainer = document.getElementById("rules");
  const allOn      = document.getElementById("allOn");
  const allOff     = document.getElementById("allOff");
  const body       = document.body;

  let settings = Object.assign({}, window.PasteGuard.DEFAULTS);
  let currentHostname = null;

  // 現在のタブのホスト名を取得
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      try {
        currentHostname = new URL(tabs[0].url).hostname;
        siteName.textContent = currentHostname;
        siteName.classList.remove("unknown");
      } catch (_) {
        siteName.textContent = "取得できません";
        siteName.classList.add("unknown");
      }
    } else {
      siteName.textContent = "対応外のページ";
      siteName.classList.add("unknown");
    }
    // 設定読み込み後にサイトトグルを更新
    updateSiteToggle();
  });

  // 設定を読み込んでUIに反映
  chrome.storage.sync.get(window.PasteGuard.DEFAULTS, (s) => {
    settings = s;
    render();
  });

  function render() {
    master.checked = settings.enabled;
    kv.checked     = settings.kvEnabled;
    entropy.checked = settings.entropyEnabled;
    thresh.value   = settings.entropyThreshold;
    threshVal.textContent = parseFloat(settings.entropyThreshold).toFixed(1);
    threshWrap.style.display = settings.entropyEnabled ? "block" : "none";
    body.classList.toggle("disabled", !settings.enabled);
    updateSiteToggle();
    buildRules();
  }

  function updateSiteToggle() {
    if (!currentHostname) return;
    const disabled = settings.disabledSites || [];
    siteToggle.checked = disabled.indexOf(currentHostname) === -1;
  }

  function buildRules() {
    rulesContainer.innerHTML = "";
    const disabled = settings.disabledRules || [];
    window.PasteGuard.RULES.forEach((rule) => {
      const row = document.createElement("div");
      row.className = "row";

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = rule.label;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.id = rule.id;
      cb.checked = disabled.indexOf(rule.id) === -1;
      cb.addEventListener("change", () => toggleRule(rule.id, cb.checked));

      row.appendChild(label);
      row.appendChild(cb);
      rulesContainer.appendChild(row);
    });
  }

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

  // サイト別ON/OFF
  siteToggle.addEventListener("change", () => {
    if (!currentHostname) return;
    let disabled = (settings.disabledSites || []).slice();
    if (siteToggle.checked) {
      disabled = disabled.filter((x) => x !== currentHostname);
    } else if (disabled.indexOf(currentHostname) === -1) {
      disabled.push(currentHostname);
    }
    settings.disabledSites = disabled;
    chrome.storage.sync.set({ disabledSites: disabled });
  });

  allOn.addEventListener("click", () => {
    settings.disabledRules = [];
    chrome.storage.sync.set({ disabledRules: [] });
    rulesContainer.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.checked = true;
    });
  });

  allOff.addEventListener("click", () => {
    const allIds = window.PasteGuard.RULES.map((r) => r.id);
    settings.disabledRules = allIds;
    chrome.storage.sync.set({ disabledRules: allIds });
    rulesContainer.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.checked = false;
    });
  });

  master.addEventListener("change", () => {
    settings.enabled = master.checked;
    body.classList.toggle("disabled", !settings.enabled);
    chrome.storage.sync.set({ enabled: settings.enabled });
  });

  kv.addEventListener("change", () => {
    settings.kvEnabled = kv.checked;
    chrome.storage.sync.set({ kvEnabled: settings.kvEnabled });
  });

  entropy.addEventListener("change", () => {
    settings.entropyEnabled = entropy.checked;
    threshWrap.style.display = entropy.checked ? "block" : "none";
    chrome.storage.sync.set({ entropyEnabled: settings.entropyEnabled });
  });

  thresh.addEventListener("input", () => {
    const v = parseFloat(thresh.value);
    threshVal.textContent = v.toFixed(1);
    settings.entropyThreshold = v;
    chrome.storage.sync.set({ entropyThreshold: v });
  });
})();
