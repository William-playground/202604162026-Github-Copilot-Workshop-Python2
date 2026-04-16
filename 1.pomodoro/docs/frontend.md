# フロントエンドドキュメント

## 概要

フロントエンドはバニラJavaScriptで実装されており、フレームワークは使用していません。単一のスクリプトファイル `static/js/timer.js` にすべてのロジックが含まれています。

---

## ファイル構成

| ファイル | 説明 |
|---|---|
| `templates/index.html` | メインHTMLテンプレート（Jinja2） |
| `static/js/timer.js` | タイマーロジック・UI更新・API通信 |
| `static/css/style.css` | スタイルシート |

---

## timer.js

### モジュール構造

全体をIIFE（即時実行関数式）で包み、グローバルスコープの汚染を防いでいます。

```javascript
(() => {
    "use strict";
    // ...
})();
```

### 定数

| 定数名 | 値 | 説明 |
|---|---|---|
| `WORK_MINUTES` | `25` | 作業セッションの時間（分） |
| `BREAK_MINUTES` | `5` | 休憩セッションの時間（分） |
| `CIRCLE_CIRCUMFERENCE` | `2 * Math.PI * 85 ≈ 534.07` | 円形プログレスバーの円周（px） |

### 状態変数

| 変数名 | 型 | 説明 |
|---|---|---|
| `totalSeconds` | number | 現在モードの合計秒数 |
| `remainingSeconds` | number | 残り秒数 |
| `timerInterval` | number \| null | `setInterval` のID |
| `isRunning` | boolean | タイマーが動作中かどうか |
| `isBreak` | boolean | 休憩モードかどうか |

### DOM要素

| ID | 説明 |
|---|---|
| `timerDisplay` | 残り時間の表示（例: `25:00`） |
| `statusLabel` | 現在のモード（`作業中` / `休憩中`） |
| `startBtn` | 開始/一時停止/再開ボタン |
| `resetBtn` | リセットボタン |
| `progressCircle` | SVGの円形プログレスバー要素 |
| `completedCount` | 完了ポモドーロ数の表示 |
| `focusTime` | 合計集中時間の表示 |

### 主要関数

#### 表示更新

| 関数名 | 説明 |
|---|---|
| `updateDisplay()` | `remainingSeconds` を `MM:SS` 形式で `timerDisplay` に表示する |
| `updateProgress()` | 経過割合に応じて円形プログレスバーの `strokeDashoffset` を更新する |
| `setMode(breakMode)` | 作業モード/休憩モードを切り替え、表示・時間・CSSクラスを更新する |
| `formatFocusTime(totalMinutes)` | 分数を `X分` または `X時間Y分` の形式にフォーマットする |
| `updateProgressStats(data)` | APIレスポンスデータをもとに `completedCount` と `focusTime` を更新する |

#### API通信

| 関数名 | 説明 |
|---|---|
| `fetchProgress()` | `GET /api/progress` を呼び出し、進捗統計を取得・表示する |
| `postProgress(minutes)` | `POST /api/progress` を呼び出し、ポモドーロ完了を記録する |

#### タイマー制御

| 関数名 | 説明 |
|---|---|
| `tick()` | 毎秒呼ばれ、`remainingSeconds` をデクリメントして表示を更新する。0になったら `onTimerComplete()` を呼ぶ |
| `start()` | タイマーを開始し、`setInterval` を設定する |
| `pause()` | タイマーを一時停止し、`clearInterval` する |
| `stop()` | タイマーを停止（ボタンテキストを「開始」に戻す） |
| `reset()` | タイマーを停止し、作業モードに戻す |
| `onTimerComplete()` | タイマー完了時の処理。作業完了なら進捗を記録して休憩へ、休憩完了なら作業へ移行する |

### タイマー動作フロー

```
[開始] startBtn クリック
    → start() → setInterval(tick, 1000)
    → 毎秒 tick() が呼ばれる
    → remainingSeconds が 0 になる
    → stop() + onTimerComplete()
        ├── 作業完了: postProgress(25) → setMode(true) [休憩へ]
        └── 休憩完了: setMode(false) [作業へ]
```

### ページ読み込み時の初期化

```javascript
updateDisplay();    // 初期時刻表示（25:00）
updateProgress();   // プログレスバーを初期化
fetchProgress();    // APIから今日の進捗を取得して表示
```

---

## style.css

### 主要なCSSクラス

| クラス名 | 説明 |
|---|---|
| `.app-container` | アプリ全体のカード（幅340px、角丸20px） |
| `.title-bar` | タイトルとウィンドウコントロールのヘッダー部分 |
| `.timer-circle` | 円形プログレスバーとタイマー数字を包むコンテナ（200×200px） |
| `.timer-display` | タイマー数字（42px、太字） |
| `.btn-primary` | 開始ボタン（紫色 `#6C63FF`） |
| `.btn-secondary` | リセットボタン（白背景・紫枠） |
| `.progress-section` | 今日の進捗統計エリア（薄灰色背景） |
| `.break-mode` | 休憩中に適用されるクラス。プログレスバーと状態ラベルを緑色（`#4CAF50`）に変更する |

### カラーパレット

| カラー | 用途 |
|---|---|
| `#6C63FF` | メインカラー（作業中のプログレスバー、ボタン） |
| `#4CAF50` | 休憩中のプログレスバーと状態ラベル |
| `#667eea` → `#764ba2` | ページ背景のグラデーション |

---

## index.html

Jinja2テンプレートエンジンを使用してFlaskから配信されます。`url_for` で静的ファイルのパスを動的に解決しています。

```html
<link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
<script src="{{ url_for('static', filename='js/timer.js') }}"></script>
```

ページはSPAに近い構成で、初期状態として `25:00` の表示と「作業中」ラベルがHTMLにハードコードされています。実際の進捗値はページ読み込み後にJavaScriptで動的に更新されます。
