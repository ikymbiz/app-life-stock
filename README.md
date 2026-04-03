# 🛡️ LifeStock（ライフストック）

> **「もしも」の時に、物と健康を迷わず守る。**  
> 防災・備蓄管理アプリ — Web PWA → Android Native への段階的リリース戦略

---

## 📋 目次

1. [アプリ概要](#1-アプリ概要)
2. [機能要件](#2-機能要件)
   - [2.1 備蓄品管理（スマート・インベントリ）](#21-備蓄品管理スマートインベントリ)
   - [2.2 健康・エマージェンシー管理（命のカード）](#22-健康エマージェンシー管理命のカード)
   - [2.3 高度な入力・分析（AI / Data）](#23-高度な入力分析ai--data)
   - [2.4 外部連携・情報](#24-外部連携情報)
3. [データ構造（DB設計）](#3-データ構造db設計)
4. [システムアーキテクチャ](#4-システムアーキテクチャ)
5. [UI/UX ガイドライン](#5-uiux-ガイドライン)
6. [開発ロードマップ](#6-開発ロードマップ)
7. [技術スタック詳細](#7-技術スタック詳細)
8. [セットアップ手順](#8-セットアップ手順)
9. [ディレクトリ構成](#9-ディレクトリ構成)
10. [API仕様](#10-api仕様)
11. [テスト方針](#11-テスト方針)
12. [セキュリティ・プライバシー方針](#12-セキュリティプライバシー方針)
13. [コントリビューション](#13-コントリビューション)
14. [ライセンス](#14-ライセンス)

---

## 1. アプリ概要

| 項目 | 内容 |
|------|------|
| **名称** | LifeStock（ライフストック） |
| **コンセプト** | 「もしも」の時に、物と健康を迷わず守る |
| **対象ユーザー** | 家族の備蓄を管理する世帯主 / 持病・アレルギーを持つ方 / ペット飼育者 |
| **動作環境（Ph.1）** | HTML5/JS (PWA対応), IndexedDB |
| **動作環境（Ph.2）** | Kotlin / Jetpack Compose, Room (SQLite), Google ML Kit |
| **オフライン対応** | 全データ端末内保存、通信不能でも完全動作 |

### ターゲットユーザー詳細

```
👨‍👩‍👧‍👦 世帯主・家族管理者
   └─ 家族全員の備蓄・健康情報を一元管理したい

🏥 持病・アレルギー保持者
   └─ 緊急時に正確な医療情報を救急隊員に伝えたい

🐾 ペット飼育者
   └─ ペット用備蓄・ワクチン履歴等も含めて管理したい
```

---

## 2. 機能要件

### 2.1 備蓄品管理（スマート・インベントリ）

#### 基本登録

| 機能 | 詳細 |
|------|------|
| 品名登録 | 商品名のテキスト入力・バーコードスキャンによる自動入力 |
| 個数・単位 | 数量（Float）と単位（本 / 袋 / 缶 / L / 枚 など）を別管理 |
| カテゴリー | 水・食料・医薬品・衛生用品・防災グッズ・ペット用品 など |
| 目標数量 | `min_qty` を設定し、在庫が下回った場合に警告を表示 |

#### 収納場所管理

```
登録可能なロケーション例：
  - 玄関 / 廊下
  - キッチン / 食品庫
  - 寝室 / クローゼット
  - 床下収納
  - 車内
  - カスタム入力（自由記述）
```

- 場所別フィルタリング表示に対応
- 「持ち出し優先」フラグで非常用持ち出し袋の中身を識別

#### 賞味期限管理

| アラートタイミング | 通知方法 |
|---|---|
| 期限の **3ヶ月前** | アプリ内バナー ＋ プッシュ通知（Android） |
| 期限の **1ヶ月前** | アプリ内バナー ＋ プッシュ通知（Android） ＋ 買い物リストへ自動追加 |
| **期限切れ** | 赤色ハイライト表示、即時アラート |

- Web版：Tesseract.js による OCR で賞味期限を画像から自動抽出
- Android版：Google ML Kit Text Recognition V2 で高精度抽出

#### ローリングストック対応

```
ローリングストックフロー：
  [新規購入] → [在庫登録 is_rolling=true] → [日常消費]
       ↑                                           ↓
  [自動買い物リスト追加] ←─── [「消費済み」フラグ ON]
```

- `is_rolling = true` のアイテムが消費済みになると、不足分を自動で「買い物リスト」へ追加
- Amazon / 楽天への補充リンクを買い物リストから直接起動

#### 写真保存

- 1アイテムあたり **複数枚** の画像を保存可能
- 推奨撮影対象：パッケージ全体 / 成分表示 / 保管場所 / バーコード
- 保存形式：IndexedDB（Web）/ Room + FileProvider（Android）

---

### 2.2 健康・エマージェンシー管理（命のカード）

#### 多人数プロフィール

- 家族全員 ＋ ペットを **個別プロフィール** として登録
- ペット専用フィールド：種類 / 品種 / 体重 / ワクチン接種履歴

#### 医療データ登録フィールド

| フィールド | 型 | 説明 |
|---|---|---|
| 氏名 | String | フルネーム（漢字・ふりがな） |
| 生年月日 | Date | 年齢自動計算に使用 |
| 血液型 | Enum | A / B / O / AB × Rh+/- |
| 食物アレルギー | String / Tag | 小麦・卵・乳・ナッツ等、複数選択 |
| 薬物アレルギー | String | 薬品名・系統名で自由記述 |
| 持病 | String | 病名・症状の詳細 |
| 常用薬 | String | 薬品名・服用量・頻度 |
| かかりつけ医 | String | 医院名 / 電話番号 / 住所 |
| 緊急連絡先 | String | 氏名 / 電話番号 / 続柄 |
| 保険証番号 | String | 健康保険証の記号・番号 |

#### デジタルお薬手帳

```
スキャンフロー（Android）：
  カメラ起動
    └─ ML Kit Document Scanner（台形補正・自動クロップ）
         └─ ML Kit Text Recognition（薬品名・用法用量OCR）
              └─ プロフィールへ自動紐付け保存
```

- 処方箋 / 薬のパッケージ / お薬手帳の見開きページ に対応
- Web版：手動撮影 → Tesseract.js で簡易テキスト抽出

#### QRコード生成（緊急医療カード）

- 登録した緊急情報を **1つのQRコード** に集約
- QRコードに含まれる情報：

```json
{
  "name": "山田 太郎",
  "dob": "1980-05-15",
  "blood_type": "A+",
  "allergies": ["スギ花粉", "ペニシリン系抗生物質"],
  "conditions": ["高血圧", "2型糖尿病"],
  "medications": ["アムロジピン 5mg 朝1錠", "メトホルミン 500mg 毎食後"],
  "emergency_contact": "山田花子 / 090-XXXX-XXXX / 配偶者",
  "doctor": "田中クリニック / 03-XXXX-XXXX"
}
```

- QR画像はローカル生成（`qrcode.js` / Android `zxing`）でオフライン動作
- 印刷・スクリーンショット保存で救急隊員への提示が可能
- **ロック画面ウィジェット**（Android）への配置対応（Ph.2）

---

### 2.3 高度な入力・分析（AI / Data）

#### Google ML Kit OCR（Android版）

| 機能 | 使用API | 精度 |
|---|---|---|
| 賞味期限自動読み取り | Text Recognition V2 | 日本語・数字混在対応 |
| 書類台形補正スキャン | Document Scanner API | A4相当まで自動検出 |
| バーコード読み取り | Barcode Scanning API | JAN / QR / PDF417 対応 |
| 薬品ラベルOCR | Text Recognition V2 | 縦書き・細字フォント対応 |

#### サバイバル・シミュレーター

```
計算ロジック：

  入力：家族構成（大人N人 / 子供M人 / ペットP匹）
  入力：現在の在庫数量（カテゴリ別）
  
  計算：
    水 → (在庫L数) ÷ (一人あたり3L × 人数) = 生存可能日数
    食料 → (在庫カロリー合計) ÷ (推奨カロリー × 人数) = 生存可能日数
    
  出力：ダッシュボードに「あと○日分」をゲージ表示
        カテゴリ別の不足状況をレーダーチャートで可視化
```

- 内閣府・環境省の推奨備蓄量基準をデフォルト値として採用
- 季節・気候条件による補正係数を設定可能

#### バーコード照合（JAN コード検索）

```
照合フロー：
  バーコードスキャン（ML Kit）
    └─ Open Food Facts API / 楽天商品検索API に問い合わせ
         └─ 商品名・メーカー・カテゴリを自動補完
              └─ ユーザーが確認・修正して登録
```

- オフライン時はバーコード番号のみ保存し、次回オンライン時に自動補完

---

### 2.4 外部連携・情報

#### 補充リンク

| サービス | リンク形式 | 備考 |
|---|---|---|
| Amazon | `https://www.amazon.co.jp/s?k={商品名}` | アフィリエイトタグ追加可能 |
| 楽天市場 | `https://search.rakuten.co.jp/search/mall/{商品名}` | 同上 |

- 買い物リストの各アイテムに「Amazonで探す」「楽天で探す」ボタンを表示

#### 災害情報フィード

| 情報源 | 取得方法 | 更新頻度 |
|---|---|---|
| 気象庁 緊急地震速報 | XML Feed | リアルタイム |
| NHK ニュース防災 | RSS | 15分ごと |
| 国土交通省 河川水位 | API | 10分ごと |
| J-ALERT | RSS | プッシュ連携（Ph.2） |

- オフライン時は最後に取得したフィードをキャッシュ表示（Service Worker）
- 重大情報（震度5以上・大津波警報等）は端末バイブレーション ＋ 音声アラート

---

## 3. データ構造（DB設計）

### ストア1：`items`（備蓄品）

```sql
CREATE TABLE items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  category     TEXT    NOT NULL,              -- 'water'|'food'|'medicine'|'sanitation'|'disaster'|'pet'
  location     TEXT    NOT NULL,              -- 保管場所
  qty          REAL    NOT NULL DEFAULT 0,
  unit         TEXT    NOT NULL DEFAULT '個', -- '本'|'袋'|'缶'|'L'|'枚' 等
  min_qty      REAL    NOT NULL DEFAULT 0,    -- 目標数量（不足アラートの閾値）
  expiry_date  TEXT,                          -- ISO 8601 形式 YYYY-MM-DD
  barcode      TEXT,                          -- JANコード
  is_rolling   INTEGER NOT NULL DEFAULT 0,   -- ローリングストック対象 Boolean
  is_consumed  INTEGER NOT NULL DEFAULT 0,   -- 消費済みフラグ Boolean
  is_emergency INTEGER NOT NULL DEFAULT 0,   -- 非常用持ち出し対象 Boolean
  notes        TEXT,                          -- メモ
  created_at   TEXT    NOT NULL,             -- ISO 8601
  updated_at   TEXT    NOT NULL              -- ISO 8601
);

-- 画像は別テーブルで1:N管理
CREATE TABLE item_images (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id  INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  image    BLOB    NOT NULL,    -- 圧縮済み画像データ
  caption  TEXT,                -- 'package'|'label'|'storage'|'other'
  sort_order INTEGER DEFAULT 0
);
```

### ストア2：`profiles`（健康・緊急情報）

```sql
CREATE TABLE profiles (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_name        TEXT    NOT NULL,
  furigana          TEXT,
  dob               TEXT,                      -- ISO 8601 YYYY-MM-DD
  blood_type        TEXT,                      -- 'A+'|'A-'|'B+'|... |'Unknown'
  is_pet            INTEGER NOT NULL DEFAULT 0,-- ペットフラグ
  pet_species       TEXT,                      -- 犬|猫|鳥 等
  allergies_food    TEXT,                      -- JSON配列 ["小麦","卵"...]
  allergies_drug    TEXT,
  conditions        TEXT,                      -- 持病（自由記述）
  medications       TEXT,                      -- 常用薬（自由記述）
  doctor_name       TEXT,
  doctor_phone      TEXT,
  insurance_number  TEXT,                      -- 暗号化保存
  emergency_contact TEXT,                      -- JSON {"name":"","phone":"","relation":""}
  qr_generated_at   TEXT,                      -- QRコード最終生成日時
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL
);

-- お薬手帳・保険証等のスキャン画像
CREATE TABLE profile_documents (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  doc_type   TEXT    NOT NULL, -- 'medicine_notebook'|'insurance'|'prescription'|'other'
  image      BLOB    NOT NULL,
  extracted_text TEXT,         -- OCRで抽出したテキスト
  created_at TEXT   NOT NULL
);
```

### ストア3：`shopping_list`（買い物リスト）

```sql
CREATE TABLE shopping_list (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     INTEGER REFERENCES items(id),   -- 元在庫アイテムへの参照（任意）
  name        TEXT    NOT NULL,
  qty_needed  REAL    NOT NULL DEFAULT 1,
  unit        TEXT,
  is_bought   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);
```

### ストア4：`settings`（アプリ設定）

```sql
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 初期データ例
INSERT INTO settings VALUES ('family_adults',   '2');
INSERT INTO settings VALUES ('family_children', '1');
INSERT INTO settings VALUES ('family_pets',     '1');
INSERT INTO settings VALUES ('alert_90days',    '1');
INSERT INTO settings VALUES ('alert_30days',    '1');
INSERT INTO settings VALUES ('theme',           'auto');
```

---

## 4. システムアーキテクチャ

### フェーズ1：Web PWA アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / PWA                         │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  在庫管理  │  │ 健康カード │  │シミュレータ│  │ 情報フィード│  │
│  │  (React) │  │  (React) │  │  (React) │  │  (React) │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       └──────────────┴─────────────┴──────────────┘        │
│                          │                                   │
│                   ┌──────▼──────┐                           │
│                   │ State Manager│  (Zustand / Redux)        │
│                   └──────┬──────┘                           │
│                          │                                   │
│          ┌───────────────┼───────────────┐                  │
│          ▼               ▼               ▼                  │
│   ┌─────────────┐ ┌─────────────┐ ┌──────────────┐        │
│   │  IndexedDB  │ │ Tesseract.js│ │ Service Worker│        │
│   │  (永続化)   │ │ (OCR)       │ │ (オフライン) │        │
│   └─────────────┘ └─────────────┘ └──────────────┘        │
│                                            │                 │
│                                   ┌────────▼────────┐       │
│                                   │   Cache Storage  │       │
│                                   └─────────────────┘       │
└─────────────────────────────────────────────────────────────┘
              │ （オンライン時のみ）
              ▼
┌─────────────────────────────────┐
│         外部サービス             │
│  ・Open Food Facts API          │
│  ・気象庁XML / NHK RSS          │
│  ・Amazon / 楽天 検索リンク     │
└─────────────────────────────────┘
```

### フェーズ2：Android Native アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    Android Application                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              UI Layer (Jetpack Compose)               │  │
│  │  InventoryScreen │ ProfileScreen │ SimulatorScreen   │  │
│  └────────────────────────┬────────────────────────────┘  │
│                            │                               │
│  ┌─────────────────────────▼────────────────────────────┐  │
│  │            ViewModel Layer (MVVM)                     │  │
│  │       ItemViewModel │ ProfileViewModel                │  │
│  └────────────────────────┬────────────────────────────┘  │
│                            │                               │
│  ┌─────────────────────────▼────────────────────────────┐  │
│  │              Repository Layer                         │  │
│  │   ItemRepository │ ProfileRepository                  │  │
│  └────────┬───────────────────────────┬────────────────┘  │
│           │                           │                    │
│  ┌────────▼────────┐      ┌──────────▼──────────┐        │
│  │   Room Database  │      │   Google ML Kit      │        │
│  │  (SQLite)        │      │  ・Text Recognition   │        │
│  │  items           │      │  ・Document Scanner  │        │
│  │  profiles        │      │  ・Barcode Scanning  │        │
│  │  shopping_list   │      └──────────────────────┘        │
│  └─────────────────┘                                       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              WorkManager (バックグラウンド処理)          │  │
│  │  ExpiryCheckWorker │ FeedSyncWorker                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. UI/UX ガイドライン

### デザイン原則

| 原則 | 実装方針 |
|------|----------|
| **オフライン第一主義** | 全登録データを端末内に保存。通信不能でも閲覧・編集完全動作 |
| **アクセシビリティ** | WCAG 2.1 AA 準拠。停電・パニック時でも直感操作できる大ボタン設計 |
| **高コントラスト** | 文字色と背景のコントラスト比 4.5:1 以上を全画面で保証 |
| **緊急モード** | 起動後ワンタップで「健康カード」または「持ち出しリスト」へ遷移 |

### カラーパレット

```
Primary:    #E53935  (警戒レッド)       — 緊急情報・アラート
Secondary:  #1565C0  (安心ブルー)       — メイン操作・ナビ
Success:    #2E7D32  (安全グリーン)     — 在庫OK・期限余裕あり
Warning:    #F57F17  (注意オレンジ)     — 期限3ヶ月以内
Neutral:    #37474F  (フォールアウトグレー) — テキスト・背景
```

### 画面構成（主要5画面）

```
┌─────────────┐
│   ダッシュボード  │ ← 在庫サマリー・シミュレーター・災害情報
├─────────────┤
│   在庫一覧    │ ← カテゴリ/場所フィルタ・バーコードスキャン追加
├─────────────┤
│   健康カード   │ ← プロフィール一覧・QRコード生成
├─────────────┤
│   買い物リスト  │ ← 不足品自動追加・Amazon/楽天リンク
├─────────────┤
│   設定       │ ← 家族構成・通知・テーマ・バックアップ
└─────────────┘
```

### 緊急モード（ロック画面対応 ※Android Ph.2）

```
通常起動
  └─ ホーム画面（ダッシュボード）
       ├─ [🆘 健康カード] ボタン → プロフィール選択 → QR表示
       └─ [🎒 持ち出しリスト] ボタン → 非常用持ち出しアイテム一覧

ロック画面ウィジェット（Android）
  └─ [健康カード QR] → 認証なしで QR コードを救急隊員に提示可能
```

---

## 6. 開発ロードマップ

### Step 1：Web MVP（目安：4〜6週間）

- [ ] HTML/JS/IndexedDB での基本 CRUD（在庫登録・編集・削除）
- [ ] カテゴリ・場所別フィルタリング
- [ ] Tesseract.js による賞味期限 OCR（簡易版）
- [ ] `qrcode.js` による緊急医療カード QR 生成
- [ ] 賞味期限アラート（ブラウザ通知）

**完成判定基準：** 家族3人分の備蓄品50件を快適に管理できること

---

### Step 2：PWA 強化 ＋ 外部連携（目安：3〜4週間）

- [ ] Service Worker によるオフライン完全動作
- [ ] Add to Home Screen（PWA インストール）対応
- [ ] Amazon・楽天補充リンク実装
- [ ] 気象庁・NHK RSS フィード表示
- [ ] ローリングストック自動買い物リスト機能
- [ ] サバイバル・シミュレーター（基本版）
- [ ] データ エクスポート（JSON / CSV）

---

### Step 3：Android Native（目安：8〜12週間）

- [ ] Kotlin / Jetpack Compose への UI 再実装
- [ ] Room Database 移行（IndexedDB → SQLite）
- [ ] Google ML Kit 統合
  - [ ] Text Recognition V2（賞味期限・薬品ラベル）
  - [ ] Document Scanner（台形補正スキャン）
  - [ ] Barcode Scanning（JAN コード照合）
- [ ] WorkManager による賞味期限チェック（バックグラウンド）
- [ ] FCM プッシュ通知
- [ ] ロック画面ウィジェット（健康カード QR）
- [ ] Google Drive バックアップ連携
- [ ] Play Store 公開

---

## 7. 技術スタック詳細

### フェーズ1：Web

| レイヤー | 技術 | バージョン |
|----------|------|-----------|
| UI フレームワーク | React | 18.x |
| 状態管理 | Zustand | 4.x |
| ローカル DB | IndexedDB (idb wrapper) | 8.x |
| OCR | Tesseract.js | 5.x |
| QR 生成 | qrcode.js | 1.5.x |
| バーコード | @zxing/library | 0.21.x |
| チャート | Recharts | 2.x |
| PWA | Vite PWA Plugin | 0.19.x |
| ビルド | Vite | 5.x |

### フェーズ2：Android

| レイヤー | 技術 | バージョン |
|----------|------|-----------|
| 言語 | Kotlin | 1.9.x |
| UI | Jetpack Compose | 1.6.x |
| アーキテクチャ | MVVM + Repository | — |
| DB | Room | 2.6.x |
| DI | Hilt | 2.51.x |
| 非同期 | Kotlin Coroutines + Flow | 1.8.x |
| OCR | ML Kit Text Recognition V2 | 16.0.x |
| スキャン | ML Kit Document Scanner | 16.0.x |
| バーコード | ML Kit Barcode Scanning | 17.3.x |
| バックグラウンド | WorkManager | 2.9.x |
| プッシュ通知 | FCM | 24.0.x |
| 画像読み込み | Coil | 2.6.x |
| ナビゲーション | Navigation Compose | 2.7.x |

---

## 8. セットアップ手順

### Web版（開発環境）

```bash
# リポジトリのクローン
git clone https://github.com/your-org/lifestock.git
cd lifestock/web

# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev
# → http://localhost:5173 で起動

# PWAビルド（本番用）
npm run build

# プレビュー（Service Worker 動作確認）
npm run preview
```

### Android版（開発環境）

```bash
# Android Studio (Hedgehog以降) を使用
# JDK 17 が必要

# プロジェクトを Android Studio で開く
File → Open → lifestock/android

# local.properties に SDK パスを設定（自動生成される場合が多い）
sdk.dir=/Users/{username}/Library/Android/sdk

# Gradle Sync を実行
# → Tools → Android → Sync Project with Gradle Files

# エミュレータまたは実機で実行
# → Run → Run 'app'
```

---

## 9. ディレクトリ構成

### Web版

```
lifestock/web/
├── public/
│   ├── icons/              # PWA アイコン各サイズ
│   ├── manifest.json       # PWA マニフェスト
│   └── sw.js               # Service Worker（ビルド時生成）
├── src/
│   ├── components/
│   │   ├── inventory/      # 在庫管理UI コンポーネント
│   │   ├── profile/        # 健康カードUI コンポーネント
│   │   ├── simulator/      # シミュレーターUI
│   │   ├── feed/           # 災害情報フィード
│   │   └── common/         # 共通コンポーネント（Button, Modal等）
│   ├── db/
│   │   ├── schema.ts       # IndexedDB スキーマ定義
│   │   ├── items.ts        # 在庫 CRUD
│   │   └── profiles.ts     # プロフィール CRUD
│   ├── hooks/
│   │   ├── useOCR.ts       # Tesseract.js フック
│   │   ├── useBarcode.ts   # バーコードスキャン フック
│   │   └── useQR.ts        # QRコード生成 フック
│   ├── store/
│   │   ├── itemStore.ts    # 在庫 State (Zustand)
│   │   └── profileStore.ts # プロフィール State (Zustand)
│   ├── utils/
│   │   ├── expiryUtils.ts  # 賞味期限計算ロジック
│   │   ├── simulator.ts    # サバイバル計算ロジック
│   │   └── feedParser.ts   # RSS/XML パーサー
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Inventory.tsx
│   │   ├── HealthCard.tsx
│   │   ├── ShoppingList.tsx
│   │   └── Settings.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

### Android版

```
lifestock/android/
├── app/src/main/
│   ├── java/com/lifestock/
│   │   ├── ui/
│   │   │   ├── dashboard/
│   │   │   ├── inventory/
│   │   │   ├── profile/
│   │   │   ├── shopping/
│   │   │   └── settings/
│   │   ├── data/
│   │   │   ├── local/
│   │   │   │   ├── AppDatabase.kt      # Room DB 定義
│   │   │   │   ├── dao/                # DAO インターフェース
│   │   │   │   └── entity/             # Entity クラス
│   │   │   └── repository/
│   │   │       ├── ItemRepository.kt
│   │   │       └── ProfileRepository.kt
│   │   ├── domain/
│   │   │   ├── model/                  # ドメインモデル
│   │   │   └── usecase/                # UseCase クラス
│   │   ├── mlkit/
│   │   │   ├── TextRecognizer.kt       # OCR ラッパー
│   │   │   ├── DocumentScanner.kt      # スキャン ラッパー
│   │   │   └── BarcodeScanner.kt       # バーコード ラッパー
│   │   ├── worker/
│   │   │   ├── ExpiryCheckWorker.kt    # 賞味期限チェック
│   │   │   └── FeedSyncWorker.kt       # RSS 同期
│   │   └── di/
│   │       └── AppModule.kt            # Hilt モジュール
│   └── res/
│       ├── layout/                     # XML レイアウト（Compose では最小限）
│       └── values/                     # テーマ・文字列リソース
└── build.gradle.kts
```

---

## 10. API仕様

### 外部 API 一覧

| API | エンドポイント | 用途 | 認証 |
|-----|--------------|------|------|
| Open Food Facts | `https://world.openfoodfacts.org/api/v0/product/{barcode}.json` | JAN コード照合 | 不要 |
| 気象庁 XML | `https://www.data.jma.go.jp/developer/xml/feed/` | 地震・気象情報 | 不要 |
| NHK RSS | `https://www.nhk.or.jp/rss/news/cat0.xml` | 防災ニュース | 不要 |

### Open Food Facts レスポンス例

```json
{
  "product": {
    "product_name_ja": "ミネラルウォーター 2L",
    "brands": "サントリー",
    "categories": "飲料水",
    "image_url": "https://..."
  },
  "status": 1
}
```

---

## 11. テスト方針

### Web版

```bash
# ユニットテスト（Vitest）
npm run test

# E2E テスト（Playwright）
npm run test:e2e

# テスト対象
- 賞味期限アラート計算ロジック
- ローリングストック 自動買い物リスト追加
- サバイバル・シミュレーター 計算精度
- IndexedDB CRUD 操作
- OCR 日付抽出の精度（テスト画像セット使用）
```

### Android版

```kotlin
// ユニットテスト（JUnit5 + MockK）
// UI テスト（Compose Testing）
// 統合テスト（Room In-Memory DB）

./gradlew test              // ユニットテスト
./gradlew connectedTest     // 実機/エミュレータテスト
```

---

## 12. セキュリティ・プライバシー方針

| 項目 | 方針 |
|------|------|
| **データ保存** | 全データを端末内のみに保存。外部サーバーへの送信なし |
| **保険証番号** | Android Keystore による暗号化（AES-256）で保存 |
| **QRコード** | 生成は完全ローカル。QRデータのサーバー送信なし |
| **バックアップ** | ユーザー自身の Google Drive へのオプション連携のみ |
| **カメラ権限** | バーコード・OCR スキャン時のみ要求。常時アクセス不可 |
| **位置情報** | 本アプリでは使用しない |
| **広告** | 広告 SDK を一切組み込まない |

---

## 13. コントリビューション

```bash
# ブランチ命名規則
feature/  → 新機能開発
fix/      → バグ修正
docs/     → ドキュメント更新
refactor/ → リファクタリング

# コミットメッセージ（Conventional Commits）
feat: OCRによる賞味期限自動入力を追加
fix: iOS Safariでのカメラ権限エラーを修正
docs: README のセットアップ手順を更新

# PR 提出前チェック
□ npm run test がすべて通過
□ コード変更に対応するテストを追加
□ README・コメントの更新
```

---

## 14. ライセンス

MIT License

Copyright (c) 2025 LifeStock Project

---

## 📞 サポート・連絡先

| 用途 | 連絡先 |
|------|--------|
| バグ報告 | GitHub Issues |
| 機能要望 | GitHub Discussions |
| セキュリティ脆弱性 | security@lifestock.app（非公開報告） |

---

> **⚠️ 重要事項**  
> 本アプリは防災・備蓄管理の補助ツールです。医療行為・診断の代替となるものではありません。  
> 緊急時は必ず 119番（救急）/ 110番（警察）/ 171番（災害用伝言ダイヤル）に連絡してください。

---

*LifeStock — あなたと家族の「もしも」を、静かに、確実に支える。*
