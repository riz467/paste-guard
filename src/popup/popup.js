// popup.js — 設定画面のロジック

(function () {
  "use strict";

  const master = document.getElementById("master");
  const kv = document.getElementById("kv");
  const entropy = document.getElementById("entropy");
  const thresh = document.getElementById("thresh");
  const threshVal = document.getElementById("threshVal");
  const threshWrap = document.getElementById("threshWrap");
  const rulesContainer = document.getElementById("rules");
  const body = document.body;

  let settings = Object.assign({}, window.PasteGuard.DEFAULTS);

  chrome.storage.sync.get(window.PasteGuard.DEFAULTS, (s) => {
    settings = s;
    render();
  });

  function render() {
    master.checked = settings.enabled;
    kv.checked = settings.kvEnabled;
    entropy.checked = settings.entropyEnabled;
    thresh.value = settings.entropyThreshold;
    threshVal.textContent = parseFloat(settings.entropyThreshold).toFixed(1);
    threshWrap.style.display = settings.entropyEnabled ? "block" : "none";
    body.classList.toggle("disabled", !settings.enabled);
    buildRules();
  }

  function buildRules() {
    rulesContainer.innerHTML = "";
    const disabled = settings.disabledRules || [];
    window.PasteGuard.RULES.forEach((rule) => {
      const row = document.createElement("div");
      row.className = "row rule";

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
