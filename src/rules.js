// rules.js — センシティブ情報の検知＆マスクロジック
// content.js / popup.js の両方から使う共通モジュール。
//
// 処理は3層 + 重複排除:
//   層1 パターン検知   … 特定フォーマット (AWS/JWT/GitHub 等)
//   層2 kv構造解析     … 怖いキー名の value
//   層3 エントロピー   … 未知の乱数トークン
//   → 全層のマッチ範囲を集め、重なりは先勝ちで除去し、後ろから一括置換

(function () {
  "use strict";

  const RULES = [
    {
      id: "aws_key",
      label: "AWS アクセスキー",
      re: /\b(AKIA|ABIA|ACCA|AGPA|AIDA|AIPA|ANPA|ANVA|APKA|AROA|ASCA|ASIA)[A-Z0-9]{16}\b/g,
      mask: (v) => "[AWS_KEY:****" + v.slice(-4) + "]"
    },
    {
      id: "jwt",
      label: "JWT トークン",
      re: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      mask: () => "[JWT:****]"
    },
    {
      id: "bearer",
      label: "Bearer トークン",
      re: /\bBearer\s+([A-Za-z0-9\-._~+/]{20,}={0,2})/gi,
      mask: () => "Bearer [TOKEN:****]"
    },
    {
      id: "api_key",
      label: "API キー",
      re: /(?:api[_-]?key|apikey|api[_-]?token|access[_-]?token|auth[_-]?token|secret[_-]?key|client[_-]?secret|app[_-]?secret)[^\S\r\n]*[=:][^\S\r\n]*["'']?([A-Za-z0-9\-._~+/!@#$%^&*]{16,})["'']?/gi,
      mask: (m) => m.replace(/([=:][^\S\r\n]*["'']?)[A-Za-z0-9\-._~+/!@#$%^&*]{16,}(["'']?)/i, "$1[****]$2")
    },
    {
      id: "openai_key",
      label: "OpenAI APIキー",
      re: /\bsk-[A-Za-z0-9]{20,}\b/g,
      mask: () => "[OPENAI_KEY:****]"
    },
    {
      id: "password",
      label: "パスワード",
      re: /(?:password|passwd|pwd)[^\S\r\n]*[=:][^\S\r\n]*["'']?([^\s"'']{6,})["'']?/gi,
      mask: (m) => m.replace(/([=:][^\S\r\n]*["'']?)[^\s"'']{6,}(["'']?)/i, "$1[****]$2")
    },
    {
      id: "db_url",
      label: "DB 接続文字列",
      re: /(?:mysql|postgresql|postgres|mongodb|redis|mssql):\/\/[^:@\s]+:[^@\s]+@[^\s"'']+/gi,
      mask: (v) => v.replace(/:\/\/([^:@]+):([^@]+)@/, "://$1:[****]@")
    },
    {
      id: "ssh_key",
      label: "秘密鍵 (PEM)",
      re: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/g,
      mask: () => "[PRIVATE_KEY:****]"
    },
    {
      id: "github",
      label: "GitHub トークン",
      re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g,
      mask: (v) => "[GH_TOKEN:****" + v.slice(-4) + "]"
    },
    {
      id: "slack",
      label: "Slack トークン",
      re: /\bxox[bpasor]-[A-Za-z0-9-]{10,}\b/g,
      mask: () => "[SLACK_TOKEN:****]"
    }
  ];

  const SENSITIVE_KEY_WORDS = [
    "token", "secret", "key", "password", "passwd", "pwd",
    "auth", "credential", "cred", "session", "cookie",
    "bearer", "private", "apikey", "access", "refresh", "sign"
  ];
  const KEY_WORD_RE = new RegExp(SENSITIVE_KEY_WORDS.join("|"), "i");
  const KV_RE = /["']?([A-Za-z_][A-Za-z0-9_-]*)["']?\s*[:=]\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s,;{}]+)/g;

  const DEFAULTS = {
    enabled: true,
    disabledRules: [],
    disabledSites: [],       // サイト別ON/OFF
    kvEnabled: true,
    entropyEnabled: true,
    entropyThreshold: 4.8
  };

  const ENTROPY_MIN_LEN = 20;

  function shannonEntropy(s) {
    const freq = {};
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      freq[c] = (freq[c] || 0) + 1;
    }
    let h = 0;
    const len = s.length;
    for (const k in freq) {
      const p = freq[k] / len;
      h -= p * Math.log2(p);
    }
    return h;
  }

  function collectPatterns(text, disabledRules) {
    const disabled = disabledRules || [];
    const active = RULES.filter((r) => disabled.indexOf(r.id) === -1);
    const matches = [];
    active.forEach((rule) => {
      const re = new RegExp(rule.re.source, rule.re.flags);
      let m;
      while ((m = re.exec(text)) !== null) {
        const full = m[0];
        matches.push({
          start: m.index,
          end: m.index + full.length,
          label: rule.label,
          replacement: rule.mask(full)
        });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    });
    return matches;
  }

  function collectKv(text) {
    const matches = [];
    const re = new RegExp(KV_RE.source, KV_RE.flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      const keyName = m[1];
      if (!KEY_WORD_RE.test(keyName)) continue;
      const valueRaw = m[2];
      let quoted = "";
      let inner = valueRaw;
      if ((valueRaw[0] === '"' || valueRaw[0] === "'") &&
          valueRaw[valueRaw.length - 1] === valueRaw[0]) {
        quoted = valueRaw[0];
        inner = valueRaw.slice(1, -1);
      }
      if (inner.length === 0) continue;
      const valueStart = m.index + m[0].lastIndexOf(valueRaw);
      const valueEnd = valueStart + valueRaw.length;
      matches.push({
        start: valueStart,
        end: valueEnd,
        label: "機密キー値 (" + keyName + ")",
        replacement: quoted + "[****]" + quoted
      });
    }
    return matches;
  }

  function collectEntropy(text, threshold) {
    const matches = [];
    const tokenRe = /[A-Za-z0-9+/=_-]{20,}/g;
    let m;
    while ((m = tokenRe.exec(text)) !== null) {
      const tok = m[0];
      if (tok.length < ENTROPY_MIN_LEN) continue;
      const e = shannonEntropy(tok);
      if (e >= threshold) {
        matches.push({
          start: m.index,
          end: m.index + tok.length,
          label: "高エントロピー (" + e.toFixed(1) + "bit)",
          replacement: "[HIGH_ENTROPY:****]"
        });
      }
    }
    return matches;
  }

  function dedupe(matches) {
    // 各マッチに収集順 _i を付与 (パターン=小, kv=中, entropy=大)。
    // _i が小さいほど優先度が高い (具体パターン > 統計推測)。
    const indexed = matches.map((m, i) => Object.assign({ _i: i }, m));

    // 優先度順 (_i 昇順) に「場所取り」する。
    // すでに確定した範囲と少しでも重なる後続は捨てる。
    const accepted = [];
    indexed
      .slice()
      .sort((a, b) => a._i - b._i)
      .forEach((m) => {
        const overlaps = accepted.some(
          (k) => m.start < k.end && m.end > k.start
        );
        if (!overlaps) accepted.push(m);
      });

    // 置換しやすいよう start 昇順で返す。
    return accepted.sort((a, b) => a.start - b.start);
  }

  function maskText(text, settings) {
    settings = settings || DEFAULTS;
    let matches = collectPatterns(text, settings.disabledRules);
    if (settings.kvEnabled) {
      matches = matches.concat(collectKv(text));
    }
    if (settings.entropyEnabled) {
      const th = settings.entropyThreshold || DEFAULTS.entropyThreshold;
      matches = matches.concat(collectEntropy(text, th));
    }
    const kept = dedupe(matches);
    let masked = text;
    const ordered = kept.slice().sort((a, b) => b.start - a.start);
    ordered.forEach((m) => {
      masked = masked.slice(0, m.start) + m.replacement + masked.slice(m.end);
    });
    const findings = kept
      .slice()
      .sort((a, b) => a.start - b.start)
      .map((m) => ({ label: m.label }));
    return { masked: masked, findings: findings, total: findings.length };
  }

  var api = {
    RULES: RULES,
    DEFAULTS: DEFAULTS,
    maskText: maskText,
    shannonEntropy: shannonEntropy
  };

  // ブラウザ: window.PasteGuard に公開
  if (typeof window !== "undefined") {
    window.PasteGuard = api;
  }
  // Node.js (テスト用): module.exports に公開
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
