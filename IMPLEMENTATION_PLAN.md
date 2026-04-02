# Artemis II Tracker — 実装計画書

- 版数: v1.0
- 作成日: 2026-04-02
- ステータス: Phase 1 MVP 完了・本番稼働中

---

## 1. 方針・技術選定

### データソース
要件定義では AROW（NASA公式）優先 + Horizons フォールバックとしていたが、**AROW の公開 API 仕様が不明確**なため MVP では JPL Horizons を一次ソースとして採用。

| ソース | 状態 | 備考 |
|---|---|---|
| JPL Horizons API | ✅ 稼働中 | NAIF ID `-1024` (Artemis II / Spacecraft) |
| NASA AROW | Phase 2 候補 | API 仕様確認後に追加 |

### ポーリング方針
要件定義（初期値5秒）から変更。実際の Horizons API の更新粒度と負荷を考慮：

| フェーズ | 間隔 | 条件 |
|---|---|---|
| 通常クルーズ | 30分 | `is_approaching = false` |
| 月・地球接近時 | 1分 | 月 <100,000 km または 地球 <50,000 km |
| ユーザー選択 | 5秒〜5分 | フロントエンドの RefreshIntervalSelector |

### インフラ（低コスト Azure 構成）
| コンポーネント | サービス | 理由 |
|---|---|---|
| フロントエンド | Azure Static Web Apps (Free) | 静的エクスポートで十分、無料枠 |
| バックエンド | Azure Container Apps (Consumption) | スケールゼロ対応、使った分だけ課金 |
| コンテナレジストリ | Azure Container Registry (Basic) | 最小構成 |
| 永続化 | Azure Table Storage | 最安値のNoSQL、訪問者・軌跡データ保存 |

**リソースグループ:** `artemis-rg` (japaneast)

---

## 2. アーキテクチャ

```
[Browser]
    │  SWR polling (refreshInterval ms)
    ▼
[Azure Static Web Apps]
  Next.js 15 (static export)
    │  NEXT_PUBLIC_API_BASE_URL
    ▼
[Azure Container Apps]
  FastAPI / Python 3.12
  ┌─────────────────────────────────────┐
  │  Background polling loop (asyncio)  │
  │    ↕ 30min / 1min                   │
  │  [JPL Horizons API]                 │
  │    ↕                                │
  │  TelemetryNormalizer                │
  │    ↕                                │
  │  CacheService (in-memory deque)     │
  │    ↕                                │
  │  TrajectoryStore ──→ [Table Storage]│
  │  VisitorService  ──→ [Table Storage]│
  └─────────────────────────────────────┘
```

### バックエンド ファイル構成

```
backend/
├── app/
│   ├── main.py                      # FastAPI アプリ、lifespan、CORS
│   ├── config.py                    # pydantic-settings 設定
│   ├── models/
│   │   ├── mission.py               # Vector3D, MissionCurrentResponse, TrajectoryPoint
│   │   └── system.py                # SystemStatusResponse, SourceInfo
│   ├── routers/
│   │   ├── mission.py               # /api/mission/* エンドポイント
│   │   └── system.py                # /api/system/* エンドポイント
│   ├── services/
│   │   ├── horizons_client.py       # JPL Horizons API クライアント
│   │   ├── telemetry_normalizer.py  # 座標→距離・フェーズ変換
│   │   ├── phase_service.py         # フェーズ判定ロジック
│   │   ├── cache_service.py         # インメモリキャッシュ (deque)
│   │   ├── mock_data.py             # ローカル開発用モックデータ
│   │   ├── trajectory_store.py      # Table Storage 軌跡永続化
│   │   └── visitor_service.py       # Table Storage 訪問者追跡
│   └── background/
│       └── poller.py                # バックグラウンドポーリングループ
├── data/
│   └── mission_events.json          # ミッションイベント定義
├── requirements.txt
└── Dockerfile
```

### フロントエンド ファイル構成

```
frontend/src/
├── app/
│   ├── page.tsx                     # メインダッシュボード
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── orbit/
│   │   └── OrbitCanvas2D.tsx        # D3.js SVG 軌道ビジュアライザー
│   ├── telemetry/
│   │   └── TelemetryGrid.tsx        # 距離・速度・フェーズカード
│   ├── timeline/
│   │   └── TimelinePanel.tsx        # ミッションイベントタイムライン
│   ├── layout/
│   │   └── MissionHeader.tsx        # ヘッダー（フェーズ・ソース・更新時刻）
│   └── common/
│       ├── ApproachAlert.tsx        # 月/地球接近アラート
│       ├── ErrorBanner.tsx          # データ取得エラー表示
│       ├── EventLogPanel.tsx        # イベントログ
│       ├── RefreshIntervalSelector.tsx  # 更新間隔セレクター
│       └── VisitorCounter.tsx       # 訪問者カウンター（フッター）
├── hooks/
│   ├── useMissionCurrent.ts         # SWR: /api/mission/current
│   ├── useTrajectory.ts             # SWR: /api/mission/trajectory
│   └── useMissionEvents.ts          # SWR: /api/mission/events
├── lib/
│   └── api-client.ts                # apiFetch / apiPost
├── constants/
│   └── mission-config.ts
└── instrumentation.ts               # Node.js SSR での localStorage 修正
```

---

## 3. 主要 API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/health` | ヘルスチェック |
| GET | `/api/mission/current` | 現在位置・テレメトリ |
| GET | `/api/mission/trajectory?range=10m\|1h\|mission` | 軌跡ポイント列 |
| GET | `/api/mission/events` | ミッションイベント一覧 |
| POST | `/api/mission/poll-now` | 手動ポーリングトリガー |
| GET | `/api/system/status` | データソース・キャッシュ状態 |
| POST | `/api/system/visit` | 訪問記録 `{session_id: string}` |
| GET | `/api/system/visitors` | `{unique_visitors, total_visits, since}` |

---

## 4. データ永続化（Azure Table Storage）

### Table: `visitors`
| PartitionKey | RowKey | Columns |
|---|---|---|
| `session` | `<UUID>` | `first_visit` |
| `stats` | `counters` | `unique_visitors`, `total_visits` |

### Table: `trajectory`
| PartitionKey | RowKey | Columns |
|---|---|---|
| `points` | `2026-04-02T02:00:00Z`（ISO、辞書順＝時系列順） | `x`, `y`, `z` (km) |

**起動時の軌跡復元フロー:**
1. Table Storage から全ポイントをロード → メモリ deque に追加
2. 最新ポイントの timestamp を確認
3. `latest + 30min < now` であれば、差分だけ Horizons から取得して保存
4. `latest + 30min >= now` であれば Horizons 取得なし（ゼロ API コール）

---

## 5. 実装済み機能（Phase 1 MVP）

### ✅ 完了
- [x] JPL Horizons リアルタイムデータ取得（NAIF ID -1024）
- [x] バックグラウンドポーリング（30分 / 接近時1分 自動切替）
- [x] 2D 軌道ビジュアライザー（D3.js、レーダーグリッド、星空背景）
- [x] 軌跡表示（OFF / 10分 / 1時間 / 全軌跡、フェードイン演出）
- [x] Orion マーカー（外部矢印コールアウト + パルスアニメーション）
- [x] テレメトリカード（地球距離・月距離・速度・フェーズ・MET）
- [x] ミッションタイムライン（完了・進行中・未到達 表示）
- [x] 接近アラート（閾値: 月100,000km / 地球50,000km）
- [x] エラーバナー + リトライ
- [x] イベントログ
- [x] 更新間隔セレクター（5s〜30min + 手動）
- [x] レスポンシブ対応（xl: 2カラム、モバイル: 1カラム）
- [x] 訪問者カウンター（ユニーク来場者・来場回数）
- [x] Azure Table Storage 永続化（訪問者・軌跡）
- [x] Azure へのデプロイ（Container Apps + Static Web Apps）
- [x] Mock モード（`USE_MOCK=true` でオフライン動作可）

### 本番 URL
- **フロントエンド:** Azure Static Web Apps（`az staticwebapp show` で確認）
- **バックエンド API:** Azure Container Apps（`az containerapp show --query properties.configuration.ingress.fqdn` で確認）

---

## 6. 実装時の主要な技術的知見

### JPL Horizons API（重要）
- `format=json` 必須 → レスポンスは `response.json().get("result", "")`
- 日付・文字列パラメータは**単引用符でラップ**が必要: `START_TIME = "'2026-Apr-02 11:00'"`
- httpx は `'` を `%27` にエンコードするが Horizons はそれを受け入れる
- 使えないパラメータ: `OBJ_DATA`, `REF_FRAME`, `TABLE_TYPE`, `MAKE_EPHEM`, `CSV_FORMAT`（400エラー）
- 日時は秒なし分単位 `%Y-%b-%d %H:%M` — 秒まで入れると "Too many constants" エラー
- Horizons エフェメリスは物理的な打ち上げ（22:35 UTC）より約3時間後（翌日02:00 UTC）から開始

### CORS
- `allow_credentials=True` + `allow_origins=["*"]` はブラウザが拒否 → `allow_credentials=False` に変更

### 静的エクスポート（next.config.ts）
- `output: "export"` が必要
- `instrumentation.ts` で Node.js SSR 環境の `localStorage` 問題を回避

---

## 7. デプロイ手順（手動）

GitHub Actions の `AZURE_CREDENTIALS` 未設定のため現在は手動デプロイ。

### バックエンド
```bash
cd backend
az acr build --registry artemis2tracker --image artemis-api:latest --platform linux/amd64 .
REVISION=$(az containerapp revision list --name artemis-api --resource-group artemis-rg \
  --query "[?properties.active].name" -o tsv)
az containerapp revision restart --name artemis-api --resource-group artemis-rg --revision "$REVISION"
```

### フロントエンド
```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=<バックエンドURL> \
  npm run build
STATIC_TOKEN=$(az staticwebapp secrets list --name artemis2-frontend \
  --resource-group artemis-rg --query "properties.apiKey" -o tsv)
npx @azure/static-web-apps-cli deploy ./out --deployment-token "$STATIC_TOKEN" --env production
```

### GitHub Actions 自動化（TODO）
`.github/workflows/backend-deploy.yml` と `frontend-deploy.yml` は実装済み。
GitHub リポジトリに以下のシークレットを設定すれば自動化される：
- `AZURE_CREDENTIALS` — サービスプリンシパル JSON
- `AZURE_STATIC_WEB_APPS_API_TOKEN` — Static Web Apps デプロイトークン
- `NEXT_PUBLIC_API_BASE_URL` — バックエンド URL

---

## 8. 今後のフェーズ計画

### Phase 2: データソース強化
- [ ] NASA AROW API 調査・接続（優先ソースとして追加）
- [ ] AROW ↔ Horizons 自動フォールバック実装
- [ ] 画面上のデータソース切替 UI
- [ ] GitHub Actions 自動デプロイ設定

### Phase 3: 表示強化
- [ ] 3D 軌道ビュー（Three.js）
- [ ] 月の現在位置を正確に表示（現在は単純な円軌道近似）
- [ ] ズーム・視点切替（地球中心 / 月中心 / 全体）
- [ ] 将来予測軌道（破線）

### Phase 4: 拡張
- [ ] リプレイ再生（過去軌跡のアニメーション）
- [ ] CSV / JSON ダウンロード
- [ ] 複数ミッション対応（Artemis III 等）
- [ ] Application Insights 監視
- [ ] raw data ビュー（開発者向け）

---

## 9. ミッション情報

| 項目 | 値 |
|---|---|
| 打ち上げ | 2026-04-01T22:35:12Z（LC-39B、KSC） |
| 宇宙船ニックネーム | "Integrity" |
| 乗組員 | Reid Wiseman, Victor Glover, Christina Koch, Jeremy Hansen |
| Horizons エフェメリス開始 | 2026-04-02T02:00:00Z |
| 月フライバイ予定 | ~2026-04-05 |
| スプラッシュダウン予定 | ~2026-04-12T18:30:00Z |
| ミッション長 | 10日間 |
