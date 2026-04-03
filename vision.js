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

  const PROMPT = {
    quick:    'この備蓄品の写真から情報を読み取れ。JSONのみ返せ。コードブロック不要。\n{"name":"品名","category":"water|food|medicine|sanitation|disaster|pet|other","expiry":"YYYY-MM-DD or null","allergens":["アレルゲン名"],"unit":"個|本|袋|缶|箱|食|L|mL|枚|セット|kg|g|カップ","qty":数値or null}',
    expiry:   'この食品の賞味期限/消費期限を読み取れ。JSONのみ返せ。コードブロック不要。\n{"expiry_date":"YYYY-MM-DD or null"}',
    allergens:'この食品の成分表からアレルゲンを特定せよ。日本の特定原材料と準ずるもの。JSONのみ返せ。コードブロック不要。\n{"allergens":["小麦","卵","乳"]}',
    full:     'この食品パッケージの情報を読み取れ。JSONのみ返せ。コードブロック不要。\n{"name":"商品名 or null","expiry_date":"YYYY-MM-DD or null","allergens":["アレルゲン名"]}',
  };

  function getDefaultModel(provider) {
    const list = MODELS[provider];
    return (list && list.length) ? list[0].id : '';
  }

  async function analyze(base64DataURL, type) {
    type = type || 'full';
    const provider = await DB.Settings.get('ai_provider', 'none');
    if (provider === 'none') throw new Error('NO_PROVIDER');
    const apiKey = await DB.Settings.get('ai_key_' + provider, '');
    if (!apiKey) throw new Error('NO_KEY');
    const modelId = await DB.Settings.get('ai_model_' + provider, getDefaultModel(provider));
    const base64 = base64DataURL.indexOf(',') >= 0 ? base64DataURL.split(',')[1] : base64DataURL;
    const prompt = PROMPT[type] || PROMPT.full;
    _incrementScan();
    switch (provider) {
      case 'gemini': return _callGemini(apiKey, modelId, base64, prompt, type);
      case 'openai': return _callOpenAI(apiKey, modelId, base64, prompt, type);
      case 'claude': return _callClaude(apiKey, modelId, base64, prompt, type);
      default: throw new Error('UNKNOWN_PROVIDER');
    }
  }

  async function _callGemini(apiKey, model, b64, prompt, type) {
    const cfg = { temperature: 0.1, maxOutputTokens: 200 };
    if (type === 'quick') cfg.responseMimeType = 'application/json';
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey,
      { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ contents:[{parts:[{text:prompt},{inline_data:{mime_type:'image/jpeg',data:b64}}]}], generationConfig:cfg }) }
    );
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error('Gemini '+res.status+': '+(e.error?.message||res.statusText)); }
    const d = await res.json();
    return _parse(d.candidates?.[0]?.content?.parts?.[0]?.text || '', type);
  }

  async function _callOpenAI(apiKey, model, b64, prompt, type) {
    const body = { model, max_tokens:200, temperature:0.1,
      messages:[{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+b64,detail:'low'}}]}] };
    if (type === 'quick') body.response_format = { type:'json_object' };
    const res = await fetch('https://api.openai.com/v1/chat/completions',
      { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey}, body:JSON.stringify(body) });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error('OpenAI '+res.status+': '+(e.error?.message||res.statusText)); }
    const d = await res.json();
    return _parse(d.choices?.[0]?.message?.content || '', type);
  }

  async function _callClaude(apiKey, model, b64, prompt, type) {
    const res = await fetch('https://api.anthropic.com/v1/messages',
      { method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({ model, max_tokens:200, messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},{type:'text',text:prompt}]}] }) });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error('Claude '+res.status+': '+(e.error?.message||res.statusText)); }
    const d = await res.json();
    return _parse(d.content?.[0]?.text || '', type);
  }

  function _parse(text, type) {
    try {
      const clean = text.replace(/```json|```/g,'').trim();
      const m = clean.match(/\{[\s\S]*\}/);
      if (!m) return {};
      const obj = JSON.parse(m[0]);
      if (obj.expiry !== undefined && !obj.expiry_date) { obj.expiry_date = obj.expiry; delete obj.expiry; }
      if (obj.expiry_date) {
        if (/^\d{4}-\d{2}$/.test(obj.expiry_date)) obj.expiry_date += '-01';
        const d = new Date(obj.expiry_date);
        if (isNaN(d)||d.getFullYear()<2000||d.getFullYear()>2060) obj.expiry_date = null;
      }
      if (!Array.isArray(obj.allergens)) obj.allergens = [];
      const vc = ['water','food','medicine','sanitation','disaster','pet','other'];
      if (obj.category && vc.indexOf(obj.category)<0) obj.category = null;
      if (obj.qty!=null) { obj.qty=parseFloat(obj.qty); if(isNaN(obj.qty)||obj.qty<=0) obj.qty=null; }
      return obj;
    } catch(e) { console.warn('[VisionAI] parse fail:', text); return {}; }
  }

  // 画像圧縮
  function _compress(file, maxW, quality) {
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        let w=img.width,h=img.height;
        if(w>maxW||h>maxW){if(w>h){h=Math.round(h*maxW/w);w=maxW;}else{w=Math.round(w*maxW/h);h=maxW;}}
        const c=document.createElement('canvas');c.width=w;c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg',quality));
      };
      img.onerror=()=>{URL.revokeObjectURL(url);resolve(null);};
      img.src=url;
    });
  }
  function compressForAI(file)      { return _compress(file, 384, 0.5); }
  function compressForStorage(file) { return _compress(file, 900, 0.72); }

  // スキャン回数
  async function _incrementScan() {
    try { const k='ai_scan_'+new Date().toISOString().slice(0,7); const c=parseInt(await DB.Settings.get(k,'0'))||0; await DB.Settings.set(k,String(c+1)); } catch(e){}
  }
  async function getScanCount() {
    try { return parseInt(await DB.Settings.get('ai_scan_'+new Date().toISOString().slice(0,7),'0'))||0; } catch(e){return 0;}
  }

  function estimateCostYenForModel(provider, modelId) {
    const list = MODELS[provider]||[];
    let m = list.find(x=>x.id===modelId);
    if (!m && list.length) m = list[0];
    if (!m) return 0;
    return Math.round(((300/1e6)*m.inputPer1M + (80/1e6)*m.outputPer1M)*150*100)/100;
  }

  async function estimateCostYen() {
    try {
      const p = await DB.Settings.get('ai_provider','none');
      if (p==='none') return 0;
      return estimateCostYenForModel(p, await DB.Settings.get('ai_model_'+p, getDefaultModel(p)));
    } catch(e){return 0;}
  }

  async function testConnection() {
    const tiny='/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
    try { await analyze('data:image/jpeg;base64,'+tiny,'full'); return true; }
    catch(e) { if(e.message==='NO_PROVIDER'||e.message==='NO_KEY') throw e; return true; }
  }

  function providerLabel(id) {
    return {gemini:'Google Gemini',openai:'OpenAI',claude:'Anthropic Claude',none:'使用しない'}[id]||id;
  }
  function modelLabel(provider,modelId) {
    const m = (MODELS[provider]||[]).find(x=>x.id===modelId);
    return m ? m.label : modelId;
  }

  return { analyze, testConnection, providerLabel, modelLabel, compressForAI, compressForStorage,
           getScanCount, estimateCostYen, estimateCostYenForModel, MODELS, getDefaultModel };
})();
