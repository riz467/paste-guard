// rules.js — センシティブ情報の検知＆マスクロジック
// content.js / popup.js の両方から使う共通モジュール。
// グローバルの window.PasteGuard に公開する。

(function () {
  "use strict";

  // 検知ルール定義。
  //   id    : 内部識別子（設定の保存に使う）
  //   label : ポップアップ表示名
  //   re    : 検知用の正規表現（g フラグ必須）
  //   mask  : マッチ文字列を受け取り、マスク後の文字列を返す関数
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
    disabledRules: []   // 無効化されたルール id の配列
  };

  // テキストにマスク処理を適用する。
  //   text     : 入力文字列
  //   settings : { disabledRules: [...] }
  // 戻り値: { masked, findings, total }
  //   findings : [{ id, label, value }] 検知した項目
  function maskText(text, settings) {
    settings = settings || DEFAULTS;
    const disabled = settings.disabledRules || [];
    const active = RULES.filter((r) => disabled.indexOf(r.id) === -1);

    const findings = [];

    // 検知（マスク前に全件拾っておく）
    active.forEach((rule) => {
      const re = new RegExp(rule.re.source, rule.re.flags);
      let m;
      while ((m = re.exec(text)) !== null) {
        findings.push({ id: rule.id, label: rule.label, value: m[0] });
        // ゼロ幅マッチによる無限ループ防止
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    });

    // マスク適用
    let masked = text;
    active.forEach((rule) => {
      const re = new RegExp(rule.re.source, rule.re.flags);
      masked = masked.replace(re, rule.mask);
    });

    return { masked: masked, findings: findings, total: findings.length };
  }

  // 公開API
  window.PasteGuard = {
    RULES: RULES,
    DEFAULTS: DEFAULTS,
    maskText: maskText
  };
})();
