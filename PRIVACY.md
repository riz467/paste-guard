# プライバシーポリシー / Privacy Policy

最終更新日 / Last updated: 2026-06-16

---

## 日本語

### 基本方針

Paste Guard（以下「本拡張機能」）は、ユーザーのプライバシーを最優先に設計されています。本拡張機能は、ユーザーのいかなるデータも外部に送信しません。すべての処理はユーザーのブラウザ内（ローカル）で完結します。

### 収集する情報

本拡張機能は、個人を特定できる情報を含め、いかなる情報も収集・送信・保存しません。

具体的には、以下を一切行いません。

- 入力・貼り付けされたテキストの外部サーバーへの送信
- 閲覧履歴や利用状況の収集
- 個人情報・認証情報の収集
- 第三者へのデータ提供
- アナリティクス（解析）ツールの使用

### テキストの処理について

本拡張機能は、対応サイトの入力欄にテキストが貼り付けられた瞬間に、そのテキストをブラウザ内で解析し、APIキー・パスワード・トークン等のセンシティブ情報を検出してマスク（伏せ字化）します。

この解析処理は、すべてユーザーのブラウザ内で実行されます。貼り付けられたテキストが外部に送信されることは一切ありません。

### 設定の保存

本拡張機能の設定（検知ルールのON/OFF、エントロピー閾値、サイト別の有効/無効など）は、Chrome の `storage.sync` 機能を用いて保存されます。これは Google アカウントに紐づくブラウザ設定の同期領域であり、本拡張機能の開発者がアクセスできるサーバーではありません。設定内容に個人情報は含まれません。

### 権限について

本拡張機能が要求する権限と、その用途は以下の通りです。

- `storage`: ユーザーの設定をブラウザ内に保存するため
- `activeTab`: 設定画面で現在開いているサイトのドメイン名を表示するため
- ホスト権限（対応サイトのみ）: 対応する AI サービスの入力欄でペーストを監視するため

これらの権限は、上記の目的以外には使用されません。

### 対応サイト

本拡張機能は、以下のサイトでのみ動作します。

- claude.ai
- chatgpt.com
- gemini.google.com
- copilot.microsoft.com
- m365.cloud.microsoft

### お問い合わせ

本ポリシーに関するお問い合わせは、GitHub リポジトリの Issue よりお願いいたします。
https://github.com/riz467/paste-guard

---

## English

### Overview

Paste Guard ("the Extension") is designed with user privacy as the highest priority. The Extension does not transmit any user data to external servers. All processing is performed locally within the user's browser.

### Information We Collect

The Extension does not collect, transmit, or store any information, including personally identifiable information.

Specifically, the Extension does NOT:

- Send pasted or entered text to any external server
- Collect browsing history or usage statistics
- Collect personal or credential information
- Share data with third parties
- Use any analytics tools

### How Text Is Processed

When text is pasted into an input field on a supported site, the Extension analyzes that text within the browser to detect and mask sensitive information such as API keys, passwords, and tokens.

This analysis is performed entirely within the user's browser. Pasted text is never transmitted externally.

### Settings Storage

The Extension's settings (detection rule toggles, entropy threshold, per-site enable/disable, etc.) are stored using Chrome's `storage.sync` feature. This is a browser settings sync area tied to the user's Google account, not a server accessible by the Extension's developer. No personal information is included in the settings.

### Permissions

The permissions requested by the Extension and their purposes are:

- `storage`: To save user settings within the browser
- `activeTab`: To display the domain name of the currently open site in the settings screen
- Host permissions (supported sites only): To monitor paste events in the input fields of supported AI services

These permissions are not used for any purpose other than those stated above.

### Supported Sites

The Extension operates only on the following sites:

- claude.ai
- chatgpt.com
- gemini.google.com
- copilot.microsoft.com
- m365.cloud.microsoft

### Contact

For inquiries regarding this policy, please open an issue on the GitHub repository.
https://github.com/riz467/paste-guard
