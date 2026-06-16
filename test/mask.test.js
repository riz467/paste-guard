// test/mask.test.js — maskText の単体テスト & デバッグ
// 実行: node test/mask.test.js

const PasteGuard = require("../src/rules.js");

// ---- 簡易アサーション ----
let passed = 0;
let failed = 0;

function assertEqual(actual, expected, name) {
  if (actual === expected) {
    passed++;
    console.log("  \x1b[32mPASS\x1b[0m " + name);
  } else {
    failed++;
    console.log("  \x1b[31mFAIL\x1b[0m " + name);
    console.log("    期待: " + JSON.stringify(expected));
    console.log("    実際: " + JSON.stringify(actual));
  }
}

// 既定設定（全機能ON）でマスク
function mask(text, overrides) {
  const settings = Object.assign({}, PasteGuard.DEFAULTS, overrides || {});
  return PasteGuard.maskText(text, settings);
}

// ===== デバッグ: GITHUB_TOKEN がどう処理されるか =====
console.log("\n=== デバッグ: 各入力の検知結果 ===\n");

function debugMask(text, label) {
  console.log("[" + label + "]");
  console.log("  入力: " + JSON.stringify(text));
  const r = mask(text);
  console.log("  出力: " + JSON.stringify(r.masked));
  console.log("  検知: " + r.findings.map((f) => f.label).join(", "));
  console.log("");
}

debugMask("GITHUB_TOKEN=ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890", "GitHub単体");
debugMask("ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890", "ghpトークンのみ");
debugMask("API_KEY=sk-test123456789012345678", "API_KEY");

// 層を個別に切り分け
console.log("=== 層別の切り分け (GITHUB_TOKEN=ghp_...) ===\n");
const ghLine = "GITHUB_TOKEN=ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890";

console.log("[パターンのみ (kv:OFF, entropy:OFF)]");
let r1 = mask(ghLine, { kvEnabled: false, entropyEnabled: false });
console.log("  出力: " + JSON.stringify(r1.masked));
console.log("  検知: " + r1.findings.map((f) => f.label).join(", ") + "\n");

console.log("[パターン + kv (entropy:OFF)]");
let r2 = mask(ghLine, { kvEnabled: true, entropyEnabled: false });
console.log("  出力: " + JSON.stringify(r2.masked));
console.log("  検知: " + r2.findings.map((f) => f.label).join(", ") + "\n");

console.log("[パターン + entropy (kv:OFF)]");
let r3 = mask(ghLine, { kvEnabled: false, entropyEnabled: true });
console.log("  出力: " + JSON.stringify(r3.masked));
console.log("  検知: " + r3.findings.map((f) => f.label).join(", ") + "\n");

console.log("[全部ON]");
let r4 = mask(ghLine);
console.log("  出力: " + JSON.stringify(r4.masked));
console.log("  検知: " + r4.findings.map((f) => f.label).join(", ") + "\n");

// ===== 回帰テスト（期待される正しい挙動） =====
console.log("=== 回帰テスト ===\n");

// 単体トークン
assertEqual(
  mask("API_KEY=sk-test123456789012345678").masked,
  "API_KEY=[****]",
  "API_KEY のマスク"
);

// 誤爆しない
assertEqual(
  mask("今日の天気は晴れです。サーバーはポート8080で動いています。").masked,
  "今日の天気は晴れです。サーバーはポート8080で動いています。",
  "通常文は素通り"
);

// kv構造解析
assertEqual(
  mask('{ "sessionId": "8f3kd9x92mfk1a2b3c4d5e6f", "userName": "tanaka" }').masked,
  '{ "sessionId": "[****]", "userName": "tanaka" }',
  "sessionId のみマスク"
);

console.log("\n=== 結果: " + passed + " passed, " + failed + " failed ===\n");
process.exit(failed > 0 ? 1 : 0);
