# 当たったら

「大きなお金が入ったら、今の自分の生活はどう変わる？」を会話しながら考え、選択を **MY LIFE** として残していくプロトタイプです。

## 現在の構成

- `index.html` — これまでのGitHub Pages向けルールベース版
- `ai.html` / `ai.js` / `ai.css` — 本物のAIと会話する新プロトタイプ
- `api/chat.js` — OpenAI Responses APIを呼ぶVercel Serverless Function
- `vercel.json` — Vercelでは `/` をAI版へ表示

AI版は会話の返答と同時に、仕事・家族・住まい・旅行・車・挑戦・残額などのMY LIFEデータを構造化して更新します。

## AI版の起動に必要な設定

GitHub PagesだけではAPIキーを安全に保持できないため、AI版はVercelで動かします。

VercelでこのGitHubリポジトリを新規ProjectとしてImportし、Environment Variablesに以下を設定します。

- `OPENAI_API_KEY` — OpenAI API key
- `OPENAI_MODEL` — 任意。未設定時は `gpt-5.6-terra`

設定後にDeployすると、VercelのトップURLでAI版が開きます。

APIキーはHTML/JavaScriptには書かず、必ずVercelのEnvironment Variablesに保存してください。
