# データモデル仕様

## 概要

本アプリケーションはデータベースを使用せず、Pythonのインメモリ辞書でデータを管理します。

---

## progress（進捗データ）

サーバーメモリ上に保持される当日の進捗データです。

```python
progress = {
    "date": str(date.today()),  # 例: "2026-04-16"
    "count": 0,                 # 完了したポモドーロ数
    "total_minutes": 0,         # 合計集中時間（分）
}
```

### フィールド定義

| フィールド名 | 型 | 説明 |
|---|---|---|
| `date` | string | 当日の日付（`YYYY-MM-DD` 形式） |
| `count` | integer | 今日完了したポモドーロセッション数 |
| `total_minutes` | integer | 今日の合計集中時間（分） |

### ライフサイクル

- **初期化**: サーバー起動時に当日の日付で初期化されます。
- **更新**: `POST /api/progress` が呼ばれるたびに `count` と `total_minutes` がインクリメントされます。
- **リセット**: 日付が変わった後に最初の API アクセスがあった際、`_reset_if_new_day()` によって `count=0`・`total_minutes=0` にリセットされます。
- **永続化なし**: サーバーを再起動するとデータは消去されます。

---

## API レスポンスのデータ形式

フロントエンドに返却されるJSONの形式です（内部フィールド名とは異なります）。

```json
{
  "count": 3,
  "totalMinutes": 75
}
```

| フィールド名 | 対応する内部フィールド | 説明 |
|---|---|---|
| `count` | `progress["count"]` | 完了ポモドーロ数 |
| `totalMinutes` | `progress["total_minutes"]` | 合計集中時間（分） |
