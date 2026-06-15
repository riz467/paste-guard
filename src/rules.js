// rules.js — センシティブ情報の検知＆マスクロジック
// content.js / popup.js の両方から使う共通モジュール。

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

  // デフォルト設定
  const DEFAULTS = {
    enabled: true,
    disabledRules: [],
    entropyEnabled: true,      // エントロピー検知のON/OFF
    entropyThreshold: 4.8      // 閾値 (bit/char)
  };

  // エントロピー検知の対象とする最小文字数
  const ENTROPY_MIN_LEN = 20;

  // Shannon エントロピーを計算する (bit/char)
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

  // パターンマッチによる検知＆マスク
  function maskPatterns(text, disabledRules) {
    const disabled = disabledRules || [];
    const active = RULES.filter((r) => disabled.indexOf(r.id) === -1);
    const findings = [];

    active.forEach((rule) => {
      const re = new RegExp(rule.re.source, rule.re.flags);
      let m;
      while ((m = re.exec(text)) !== null) {
        findings.push({ id: rule.id, label: rule.label, value: m[0] });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    });

    let masked = text;
    active.forEach((rule) => {
      const re = new RegExp(rule.re.source, rule.re.flags);
      masked = masked.replace(re, rule.mask);
    });

    return { masked: masked, findings: findings };
  }

  // 高エントロピー文字列の検知＆マスク
  function maskEntropy(text, threshold) {
    const findings = [];
    // トークン候補を抽出（英数記号が連続する20文字以上の塊）
    const tokenRe = /[A-Za-z0-9+/=_-]{20,}/g;
    const hits = [];
    let m;
    while ((m = tokenRe.exec(text)) !== null) {
      const tok = m[0];
      if (tok.length < ENTROPY_MIN_LEN) continue;
      // 既にマスク済みのプレースホルダは除外
      if (tok.indexOf("****") !== -1) continue;
      const e = shannonEntropy(tok);
      if (e >= threshold) {
        hits.push({ value: tok, entropy: e });
      }
    }

    let masked = text;
    const seen = {};
    hits.forEach((h) => {
      if (seen[h.value]) return;
      seen[h.value] = true;
      findings.push({
        id: "entropy",
        label: "高エントロピー (" + h.entropy.toFixed(1) + "bit)",
        value: h.value
      });
      // 同一文字列を全て置換
      masked = masked.split(h.value).join("[HIGH_ENTROPY:****]");
    });

    return { masked: masked, findings: findings };
  }

  // 統合マスク処理
  //   settings: { disabledRules, entropyEnabled, entropyThreshold }
  function maskText(text, settings) {
    settings = settings || DEFAULTS;

    // 1. パターン検知を先に適用
    const p = maskPatterns(text, settings.disabledRules);
    let masked = p.masked;
    let findings = p.findings.slice();

    // 2. エントロピー検知（パターンマスク後のテキストに対して）
    if (settings.entropyEnabled) {
      const threshold = settings.entropyThreshold || DEFAULTS.entropyThreshold;
      const e = maskEntropy(masked, threshold);
      masked = e.masked;
      findings = findings.concat(e.findings);
    }

    return { masked: masked, findings: findings, total: findings.length };
  }

  // 公開API
  window.PasteGuard = {
    RULES: RULES,
    DEFAULTS: DEFAULTS,
    maskText: maskText,
    shannonEntropy: shannonEntropy
  };
})();
