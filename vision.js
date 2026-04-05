/* vision.js — Multi-provider Vision AI: Gemini / OpenAI / Claude */
const VisionAI = (() => {

  const MODELS = {
    openai: [
      { id:'gpt-4o-mini',  label:'GPT-4o mini',  cost:'最安',   inputPer1M:0.15, outputPer1M:0.60 },
      { id:'gpt-4.1-nano', label:'GPT-4.1 nano', cost:'最安',   inputPer1M:0.10, outputPer1M:0.40 },
      { id:'gpt-4.1-mini', label:'GPT-4.1 mini', cost:'安い',   inputPer1M:0.40, outputPer1M:1.60 },
      { id:'gpt-4o',       label:'GPT-4o',        cost:'高精度', inputPer1M:2.50, outputPer1M:10.0 },
    ],
    gemini: [
      { id:'gemini-2.5-flash-lite',  label:'Gemini 2.5 Flash-Lite', cost:'最安',   inputPer1M:0.10, outputPer1M:0.40 },
      { id:'gemini-2.5-flash',       label:'Gemini 2.5 Flash',      cost:'安い',   inputPer1M:0.30, outputPer1M:2.50 },
      { id:'gemini-3-flash-preview', label:'Gemini 3 Flash',        cost:'バランス', inputPer1M:0.50, outputPer1M:3.00 },
    ],
    claude: [
      { id:'claude-haiku-4-5-20251001',  label:'Claude Haiku 4.5',  cost:'バランス', inputPer1M:1.00, outputPer1M:5.00 },
      { id:'claude-sonnet-4-6-20260320', label:'Claude Sonnet 4.6', cost:'高精度',   inputPer1M:3.00, outputPer1M:15.0 },
    ],
  };

  // count_unit / volume_unit の許容値
  const COUNT_UNITS  = ['個','本','袋','缶','箱','食','枚','セット'];
  const VOLUME_UNITS = ['L','mL','kg','g','カップ'];

  const PROMPT = {
    // 複数画像対応・詳細プロンプト
    quick: `複数枚の写真は同一の備蓄品を異なる角度・面から撮影したものである。全ての写真を総合的に解析し、以下のJSON形式で情報を返せ。JSONのみ返せ。コードブロック・説明文は不要。

読み取り指示:
- name: 商品名・品名。パッケージ正面から読み取れ。ブランド名は含めなくてよい。読み取れない場合はnull。
- category: water/food/medicine/sanitation/disaster/pet/other から最も適切な1つ。
- expiry: 賞味期限または消費期限をYYYY-MM-DD形式で。年月のみの場合はその月の1日。読み取れない場合はnull。
- allergens: 成分表・原材料欄から以下の28品目に含まれるものだけを配列で返せ。なければ空配列。
  対象: 小麦/卵/乳/そば/落花生/えび/かに/くるみ/アーモンド/あわび/いか/いくら/オレンジ/カシューナッツ/キウイ/牛肉/ごま/さけ/さば/大豆/鶏肉/豚肉/バナナ/もも/やまいも/りんご/ゼラチン/マカダミアナッツ
- count: 箱・袋・パックの中に入っている個数・本数・入数を整数で。読み取れない場合はnull。
- count_unit: 個/本/袋/缶/箱/食/枚/セット から最も適切なもの。
- volume: 1つあたりの容量・重量の数値のみ（例: 2、500）。容量表記がない場合はnull。
- volume_unit: L/mL/kg/g/カップ から最も適切なもの。volumeがnullの場合はnull。

{"name":string|null,"category":string,"expiry":string|null,"allergens":string[],"count":number|null,"count_unit":string,"volume":number|null,"volume_unit":string|null}`,

    expiry:   'この食品の賞味期限/消費期限を読み取れ。JSONのみ返せ。コードブロック不要。\n{"expiry_date":"YYYY-MM-DD or null"}',
    allergens:'この食品の成分表から以下の28品目に該当するアレルゲンを全て返せ。JSONのみ返せ。コードブロック不要。\n対象: 小麦/卵/乳/そば/落花生/えび/かに/くるみ/アーモンド/あわび/いか/いくら/オレンジ/カシューナッツ/キウイ/牛肉/ごま/さけ/さば/大豆/鶏肉/豚肉/バナナ/もも/やまいも/りんご/ゼラチン/マカダミアナッツ\n{"allergens":["小麦","卵","乳"]}',
    full:     'この食品パッケージの情報を読み取れ。JSONのみ返せ。コードブロック不要。\n{"name":"商品名 or null","expiry_date":"YYYY-MM-DD or null","allergens":["アレルゲン名"]}',
  };

  function getDefaultModel(provider) {
    const list = MODELS[provider];
    return (list && list.length) ? list[0].id : '';
  }

  /**
   * base64DataURLs: string | string[]
   * 単一文字列も配列として扱う。
   */
  async function analyze(base64DataURLs, type) {
    if (!Array.isArray(base64DataURLs)) base64DataURLs = [base64DataURLs];
    type = type || 'full';
    const provider = await DB.Settings.get('ai_provider', 'none');
    if (provider === 'none') throw new Error('NO_PROVIDER');
    const apiKey  = await DB.Settings.get('ai_key_' + provider, '');
    if (!apiKey) throw new Error('NO_KEY');
    const modelId = await DB.Settings.get('ai_model_' + provider, getDefaultModel(provider));
    // data URL → 生 base64
    const bases   = base64DataURLs.map(url => url.indexOf(',') >= 0 ? url.split(',')[1] : url);
    const prompt  = PROMPT[type] || PROMPT.full;
    _incrementScan();
    switch (provider) {
      case 'gemini': return _callGemini(apiKey, modelId, bases, prompt, type);
      case 'openai': return _callOpenAI(apiKey, modelId, bases, prompt, type);
      case 'claude': return _callClaude(apiKey, modelId, bases, prompt, type);
      default: throw new Error('UNKNOWN_PROVIDER');
    }
  }

  async function _callGemini(apiKey, model, bases, prompt, type) {
    const cfg = { temperature: 0.1, maxOutputTokens: 300 };
    if (type === 'quick') cfg.responseMimeType = 'application/json';
    const parts = [
      { text: prompt },
      ...bases.map(b => ({ inline_data: { mime_type: 'image/jpeg', data: b } })),
    ];
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: cfg }) },
    );
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error('Gemini ' + res.status + ': ' + (e.error?.message || res.statusText)); }
    const d = await res.json();
    return _parse(d.candidates?.[0]?.content?.parts?.[0]?.text || '', type);
  }

  async function _callOpenAI(apiKey, model, bases, prompt, type) {
    const content = [
      { type: 'text', text: prompt },
      ...bases.map(b => ({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b, detail: 'auto' } })),
    ];
    const body = { model, max_tokens: 300, temperature: 0.1, messages: [{ role: 'user', content }] };
    if (type === 'quick') body.response_format = { type: 'json_object' };
    const res = await fetch('https://api.openai.com/v1/chat/completions',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey }, body: JSON.stringify(body) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error('OpenAI ' + res.status + ': ' + (e.error?.message || res.statusText)); }
    const d = await res.json();
    return _parse(d.choices?.[0]?.message?.content || '', type);
  }

  async function _callClaude(apiKey, model, bases, prompt, type) {
    const content = [
      ...bases.map(b => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b } })),
      { type: 'text', text: prompt },
    ];
    const res = await fetch('https://api.anthropic.com/v1/messages',
      { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model, max_tokens: 300, messages: [{ role: 'user', content }] }) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error('Claude ' + res.status + ': ' + (e.error?.message || res.statusText)); }
    const d = await res.json();
    return _parse(d.content?.[0]?.text || '', type);
  }

  function _parse(text, type) {
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      const m = clean.match(/\{[\s\S]*\}/);
      if (!m) return {};
      const obj = JSON.parse(m[0]);

      // expiry の正規化（キー名ゆれ対応）
      if (obj.expiry !== undefined && !obj.expiry_date) { obj.expiry_date = obj.expiry; delete obj.expiry; }
      if (obj.expiry_date) {
        if (/^\d{4}-\d{2}$/.test(obj.expiry_date)) obj.expiry_date += '-01';
        const d = new Date(obj.expiry_date);
        if (isNaN(d) || d.getFullYear() < 2000 || d.getFullYear() > 2060) obj.expiry_date = null;
      }

      if (!Array.isArray(obj.allergens)) obj.allergens = [];
      // 28品目リストに含まれるもののみ通す
      const VALID_ALLERGENS = new Set(['小麦','卵','乳','そば','落花生','えび','かに','くるみ',
        'アーモンド','あわび','いか','いくら','オレンジ','カシューナッツ','キウイ','牛肉',
        'ごま','さけ','さば','大豆','鶏肉','豚肉','バナナ','もも','やまいも','りんご',
        'ゼラチン','マカダミアナッツ']);
      obj.allergens = obj.allergens.filter(a => VALID_ALLERGENS.has(a));

      const vc = ['water', 'food', 'medicine', 'sanitation', 'disaster', 'pet', 'other'];
      if (obj.category && !vc.includes(obj.category)) obj.category = null;

      // count / count_unit
      if (obj.count != null) {
        obj.count = parseFloat(obj.count);
        if (isNaN(obj.count) || obj.count <= 0) obj.count = null;
      }
      if (!obj.count_unit || !COUNT_UNITS.includes(obj.count_unit)) obj.count_unit = '個';

      // volume / volume_unit
      if (obj.volume != null) {
        obj.volume = parseFloat(obj.volume);
        if (isNaN(obj.volume) || obj.volume <= 0) obj.volume = null;
      }
      if (!obj.volume_unit || !VOLUME_UNITS.includes(obj.volume_unit)) obj.volume_unit = null;
      if (obj.volume === null) obj.volume_unit = null; // volume なしなら unit も null

      return obj;
    } catch (e) { console.warn('[VisionAI] parse fail:', text); return {}; }
  }

  // ── 画像圧縮 ──
  function _compress(file, maxW, quality) {
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW || h > maxW) { if (w > h) { h = Math.round(h * maxW / w); w = maxW; } else { w = Math.round(w * maxW / h); h = maxW; } }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }
  function compressForAI(file)      { return _compress(file, 1024, 0.7);  }
  function compressForStorage(file) { return _compress(file, 900,  0.72); }

  // ── スキャン回数 ──
  async function _incrementScan() {
    try {
      const k = 'ai_scan_' + new Date().toISOString().slice(0, 7);
      const c = parseInt(await DB.Settings.get(k, '0')) || 0;
      await DB.Settings.set(k, String(c + 1));
    } catch (e) {}
  }
  async function getScanCount() {
    try { return parseInt(await DB.Settings.get('ai_scan_' + new Date().toISOString().slice(0, 7), '0')) || 0; } catch (e) { return 0; }
  }

  function estimateCostYenForModel(provider, modelId) {
    const list = MODELS[provider] || [];
    let m = list.find(x => x.id === modelId);
    if (!m && list.length) m = list[0];
    if (!m) return 0;
    return Math.round(((1000 / 1e6) * m.inputPer1M + (80 / 1e6) * m.outputPer1M) * 150 * 100) / 100;
  }

  async function estimateCostYen() {
    try {
      const p = await DB.Settings.get('ai_provider', 'none');
      if (p === 'none') return 0;
      return estimateCostYenForModel(p, await DB.Settings.get('ai_model_' + p, getDefaultModel(p)));
    } catch (e) { return 0; }
  }

  async function testConnection() {
    const tiny = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
    try { await analyze('data:image/jpeg;base64,' + tiny, 'full'); return true; }
    catch (e) { if (e.message === 'NO_PROVIDER' || e.message === 'NO_KEY') throw e; return true; }
  }

  function providerLabel(id) {
    return { gemini: 'Google Gemini', openai: 'OpenAI', claude: 'Anthropic Claude', none: '使用しない' }[id] || id;
  }
  function modelLabel(provider, modelId) {
    const m = (MODELS[provider] || []).find(x => x.id === modelId);
    return m ? m.label : modelId;
  }

  return {
    analyze, testConnection, providerLabel, modelLabel,
    compressForAI, compressForStorage,
    getScanCount, estimateCostYen, estimateCostYenForModel,
    MODELS, getDefaultModel,
  };
})();
