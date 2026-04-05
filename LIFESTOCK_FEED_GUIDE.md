# LifeStock フィード配信 仕様書

## 概要

LifeStock アプリの「フィード」タブに表示するコンテンツを、GitHub Actions + Claude API + 楽天/Amazon 商品API で週1回自動生成し、GitHub Pages で配信します。

- サーバー不要（GitHub 無料プランで運用可能）
- 週1回 月曜 8:00 JST に自動更新
- Claude API がテーマ・キーワードを決定
- 楽天API / Amazon PA-API で実際の商品情報（画像・価格・レビュー）を取得

---

## Amazon PA-API の前提条件

Amazon PA-API (Product Advertising API v5.0) を利用するには以下が必要です。

| 条件 | 内容 |
|---|---|
| アソシエイト登録 | Amazonアソシエイト・プログラムへの参加 |
| **売上実績** | **登録後180日以内に3件以上の適格販売**（最重要） |
| APIキー取得 | 管理画面「ツール」→「Product Advertising API」→「アクセスキー」と「シークレットキー」 |

> ⚠️ 売上実績がない間は PA-API が使えません。その間は楽天APIのみで運用し、Amazon は検索URLリンクで代替してください（generate.js の `USE_AMAZON_API` フラグで切り替え可能）。

---

## リポジトリ構成

```
lifestock-feed/
├── config.json
├── generate.js
├── package.json
├── feed.json                 ← 自動生成
└── .github/
    └── workflows/
        └── generate.yml
```

---

## config.json

```json
{
  "amazon_tag": "your-associate-tag-22",
  "amazon_access_key": "",
  "amazon_secret_key": "",
  "rakuten_affiliate_id": "your-rakuten-affiliate-id",
  "rakuten_app_id": "your-rakuten-app-id",
  "use_amazon_api": true,
  "posts_per_week": 4,
  "post_types": {
    "deal": 2,
    "column": 1,
    "recommend": 1
  }
}
```

> `amazon_access_key` / `amazon_secret_key` は GitHub Secrets で管理します。config.json には空文字のままにしておいてください。

---

## package.json

```json
{
  "name": "lifestock-feed",
  "version": "1.0.0",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "paapi5-nodejs-sdk": "^1.0.0"
  }
}
```

---

## generate.js

```javascript
const Anthropic  = require('@anthropic-ai/sdk');
const fs         = require('fs');
const ProductAdvertisingAPIv1 = require('paapi5-nodejs-sdk');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const client = new Anthropic();

// Amazon PA-API の認証情報は環境変数から取得（GitHub Secrets）
const AMAZON_ACCESS_KEY = process.env.AMAZON_ACCESS_KEY || config.amazon_access_key || '';
const AMAZON_SECRET_KEY = process.env.AMAZON_SECRET_KEY || config.amazon_secret_key || '';
const USE_AMAZON_API    = config.use_amazon_api && !!AMAZON_ACCESS_KEY && !!AMAZON_SECRET_KEY;

// ══════════════════════════════════════
//  Amazon PA-API v5
// ══════════════════════════════════════
function buildAmazonClient() {
  const defaultClient = ProductAdvertisingAPIv1.ApiClient.instance;
  defaultClient.accessKey  = AMAZON_ACCESS_KEY;
  defaultClient.secretKey  = AMAZON_SECRET_KEY;
  defaultClient.host        = 'webservices.amazon.co.jp';
  defaultClient.region      = 'us-west-2';
  return new ProductAdvertisingAPIv1.DefaultApi();
}

async function searchAmazon(keyword, itemCount = 3) {
  if (!USE_AMAZON_API) return [];

  return new Promise((resolve) => {
    const api = buildAmazonClient();

    const req = new ProductAdvertisingAPIv1.SearchItemsRequest();
    req.PartnerTag  = config.amazon_tag;
    req.PartnerType = 'Associates';
    req.Keywords    = keyword;
    req.SearchIndex = 'All';
    req.ItemCount   = itemCount;
    req.Resources   = [
      'Images.Primary.Medium',
      'ItemInfo.Title',
      'Offers.Listings.Price',
      'CustomerReviews.StarRating',
      'CustomerReviews.Count',
    ];

    api.searchItems(req, (error, data) => {
      if (error || !data?.SearchResult?.Items) {
        console.warn(`  Amazon API warning: ${error?.message || 'No results'}`);
        return resolve([]);
      }
      const items = data.SearchResult.Items.map(item => {
        const listing = item.Offers?.Listings?.[0];
        const price   = listing?.Price?.Amount || null;
        const image   = item.Images?.Primary?.Medium?.URL || null;
        const title   = item.ItemInfo?.Title?.DisplayValue || '';
        const url     = item.DetailPageURL || '';

        // セット商品の単価計算
        let price_per_unit = null;
        if (price) {
          const m = title.match(/(\d+)(?:本|個|袋|枚|食|缶|箱)(?:入|×|セット|組)/);
          if (m && parseInt(m[1]) > 1) {
            price_per_unit = `（1個${Math.round(price / parseInt(m[1]))}円）`;
          }
        }

        return {
          name:           title.slice(0, 60),
          price:          price ? Math.round(price) : null,
          price_per_unit,
          image_url:      image,
          url,            // アソシエイトタグはURLに自動付与される
          review_average: item.CustomerReviews?.StarRating?.DisplayValue
                            ? parseFloat(item.CustomerReviews.StarRating.DisplayValue) : null,
          review_count:   item.CustomerReviews?.Count?.DisplayValue
                            ? parseInt(item.CustomerReviews.Count.DisplayValue) : null,
          source:         'amazon',
        };
      });
      resolve(items);
    });
  });
}

// ══════════════════════════════════════
//  楽天商品検索API
// ══════════════════════════════════════
function rakutenAffiliateUrl(itemUrl) {
  return `https://hb.afl.rakuten.co.jp/hgc/${config.rakuten_affiliate_id}/?pc=${encodeURIComponent(itemUrl)}`;
}

async function searchRakuten(keyword, hits = 3) {
  const params = new URLSearchParams({
    applicationId: config.rakuten_app_id,
    keyword,
    hits,
    sort: '-reviewCount',
    availability: 1,
    imageFlag: 1,
  });
  const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706?${params}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Rakuten API: ${res.status}`);
  const data = await res.json();

  return (data.Items || []).map(({ Item: i }) => {
    let price_per_unit = null;
    const m = i.itemName.match(/(\d+)(?:本|個|袋|枚|食|缶|箱)(?:入|×|セット|組)/);
    if (m && parseInt(m[1]) > 1) {
      price_per_unit = `（1個${Math.round(i.itemPrice / parseInt(m[1]))}円）`;
    }
    return {
      name:           i.itemName.slice(0, 60),
      price:          i.itemPrice,
      price_per_unit,
      image_url:      i.mediumImageUrls?.[0]?.imageUrl || null,
      url:            rakutenAffiliateUrl(i.itemUrl),
      review_average: i.reviewAverage || null,
      review_count:   i.reviewCount   || null,
      source:         'rakuten',
    };
  });
}

// ══════════════════════════════════════
//  両APIで検索してマージ
// ══════════════════════════════════════
async function searchProducts(keyword) {
  const [rakutenItems, amazonItems] = await Promise.allSettled([
    searchRakuten(keyword, 2),
    searchAmazon(keyword, 2),
  ]);

  const rakuten = rakutenItems.status === 'fulfilled' ? rakutenItems.value : [];
  const amazon  = amazonItems.status  === 'fulfilled' ? amazonItems.value  : [];

  if (rakuten.length === 0 && amazon.length === 0) return [];

  // 楽天1件 + Amazon1件を交互に並べる（最大3件）
  const merged = [];
  const maxLen = Math.max(rakuten.length, amazon.length);
  for (let i = 0; i < maxLen && merged.length < 3; i++) {
    if (rakuten[i]) merged.push(rakuten[i]);
    if (amazon[i]  && merged.length < 3) merged.push(amazon[i]);
  }
  return merged;
}

// ══════════════════════════════════════
//  Claude で記事プランを生成
// ══════════════════════════════════════
const SYSTEM = `あなたは防災・備蓄管理アプリ「LifeStock」のコンテンツ担当です。日本語ユーザー向け。`;

const USER_PROMPT = `
今週配信する記事を計画してください。

## 構成
- deal（お得情報）: ${config.post_types.deal}本
  keyword: 楽天・Amazon検索に使う日本語キーワード（具体的・短め）
  body: 100〜200字。なぜ備蓄に役立つか、選び方のポイント

- column（コラム）: ${config.post_types.column}本
  keyword: null（商品検索なし）
  body: 150〜300字。備蓄ノウハウ・ローリングストック・賞味期限管理など

- recommend（おすすめ）: ${config.post_types.recommend}本
  keyword: あれば入れる（${new Date().toLocaleDateString('ja-JP',{month:'long'})}に合わせたもの）
  body: 100〜200字

## 出力（JSONのみ・コードブロック不要）
{
  "items": [
    {
      "type": "deal",
      "title": "タイトル（30字以内）",
      "body": "本文（\\nで改行可）",
      "keyword": "検索キーワード または null",
      "tags": ["タグ1"],
      "allergen_free": ["対応アレルゲン名 または 空配列"]
    }
  ]
}

推奨タグ: 水, 食料, 米, 缶詰, レトルト, 医薬品, 衛生用品, 防災, ペット, コラム, 備蓄
allergen_free: アレルゲン不使用・対応の商品の場合は、除去しているアレルゲン名を28品目の中から配列で。例: ["小麦","乳","卵"]。不明や非対応は [].
`.trim();

// ══════════════════════════════════════
//  週ID
// ══════════════════════════════════════
function weekId() {
  const d   = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const y = d.getFullYear();
  const w = Math.ceil(((d - new Date(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-w${String(w).padStart(2, '0')}`;
}

// ══════════════════════════════════════
//  メイン
// ══════════════════════════════════════
async function main() {
  console.log('=== LifeStock Feed Generator ===');
  console.log(`Amazon PA-API: ${USE_AMAZON_API ? '有効' : '無効（楽天のみ）'}`);

  // Step 1: Claude で記事プランを生成
  console.log('\nStep 1: Generating plan with Claude...');
  const res = await client.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 2000,
    system:     SYSTEM,
    messages:   [{ role: 'user', content: USER_PROMPT }],
  });
  const text  = res.content[0].text.replace(/```json|```/g, '').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude response did not include valid JSON');
  const plan = JSON.parse(match[0]);
  console.log(`  ${plan.items.length} articles planned`);

  // Step 2: 商品情報を取得
  console.log('\nStep 2: Fetching products...');
  const today = new Date().toISOString().slice(0, 10);
  const wid   = weekId();
  const items = [];

  for (let i = 0; i < plan.items.length; i++) {
    const p = plan.items[i];
    let products = [];

    if (p.keyword) {
      try {
        products = await searchProducts(p.keyword);
        const rakutenCount = products.filter(x => x.source === 'rakuten').length;
        const amazonCount  = products.filter(x => x.source === 'amazon').length;
        console.log(`  [${p.type}] "${p.title}" → 楽天${rakutenCount}件 / Amazon${amazonCount}件`);
      } catch (e) {
        console.warn(`  Product search failed: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 1100)); // レート制限対策
    } else {
      console.log(`  [${p.type}] "${p.title}" → 商品検索なし`);
    }

    items.push({
      id:           `${wid}-${p.type}-${i + 1}`,
      type:         p.type,
      title:        p.title,
      body:         p.body,
      products,
      links:        [],
      published_at: today,
      tags:         p.tags || [],
    });
  }

  // Step 3: feed.json 書き出し
  const feed = { generated_at: new Date().toISOString(), items };
  fs.writeFileSync('feed.json', JSON.stringify(feed, null, 2), 'utf8');

  console.log('\n=== Done ===');
  items.forEach(it => {
    const r = it.products.filter(x => x.source === 'rakuten').length;
    const a = it.products.filter(x => x.source === 'amazon').length;
    const suffix = it.products.length ? ` (楽天${r} / Amazon${a})` : '';
    console.log(` [${it.type}] ${it.title}${suffix}`);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
```

---

## .github/workflows/generate.yml

```yaml
name: Generate Feed

on:
  schedule:
    - cron: '0 23 * * 0'   # 毎週日曜 23:00 UTC = 月曜 8:00 JST
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Generate feed
        env:
          ANTHROPIC_API_KEY:  ${{ secrets.ANTHROPIC_API_KEY }}
          AMAZON_ACCESS_KEY:  ${{ secrets.AMAZON_ACCESS_KEY }}
          AMAZON_SECRET_KEY:  ${{ secrets.AMAZON_SECRET_KEY }}
        run: node generate.js

      - name: Commit and push
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add feed.json
          git diff --staged --quiet || git commit -m "chore: update feed $(date -u +'%Y-%m-%d')"
          git push
```

---

## GitHub Secrets 登録

リポジトリ → Settings → Secrets and variables → Actions → New repository secret

| Name | Value | 備考 |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | 必須 |
| `AMAZON_ACCESS_KEY` | アクセスキー | PA-API取得後に登録 |
| `AMAZON_SECRET_KEY` | シークレットキー | PA-API取得後に登録 |

---

## Amazon PA-API が使えない間の対応

`config.json` で `"use_amazon_api": false` にするだけで楽天APIのみの動作になります。`generate.js` の変更は不要です。

---

## feed.json スキーマ（products[]）

```json
{
  "products": [
    {
      "name": "商品名（60字以内）",
      "price": 1980,
      "price_per_unit": "（1本83円）",
      "image_url": "https://...",
      "url": "アフィリエイトリンク",
      "review_average": 4.3,
      "review_count": 234,
      "source": "rakuten"   // または "amazon"
    }
  ]
}
```

`source` フィールドでボタンの色が変わります（楽天=赤、Amazon=オレンジ）。

---

## セットアップ手順

1. GitHubで `lifestock-feed` リポジトリを作成
2. 上記4ファイルを配置（feed.json は `{"generated_at":"","items":[]}` で初期化）
3. GitHub Secrets を登録（Anthropic必須、Amazon は取得後）
4. GitHub Pages を有効化（Settings → Pages → main ブランチ）
5. LifeStock 設定 → フィードURL に `https://[name].github.io/lifestock-feed/feed.json` を登録
6. Actions → `Generate Feed` → `Run workflow` で動作確認

---

## 運用コスト試算

| 項目 | 月額 |
|---|---|
| GitHub Actions / Pages | 無料 |
| 楽天商品検索API | 無料 |
| Amazon PA-API | 無料 |
| Claude API（週4記事 × 4週） | 約 20〜50円 |
