/* settings.js — Settings (clean redesign) */
const SettingsPage = (() => {

  async function render() {
    const el = document.getElementById('page-settings');
    if (!el) return;

    let aiProvider='none', aiModel='', apiKey='', adults='2', children='0';
    try {
      aiProvider = await DB.Settings.get('ai_provider','none');
      adults     = await DB.Settings.get('family_adults','2');
      children   = await DB.Settings.get('family_children','0');
      if (aiProvider !== 'none') {
        aiModel = await DB.Settings.get('ai_model_'+aiProvider, VisionAI.getDefaultModel(aiProvider));
        apiKey  = await DB.Settings.get('ai_key_'+aiProvider, '');
      }
    } catch(e){}

    var scanCount = 0, costPer = 0;
    try { scanCount = await VisionAI.getScanCount(); costPer = await VisionAI.estimateCostYen(); } catch(e){}
    var costTotal = Math.round(scanCount * costPer * 100) / 100;

    var h = '';

    // ── AI設定 ──
    h += secTitle('smart_toy', 'AI写真解析');
    h += '<div class="bg-white border border-secondary-container rounded-2xl p-5 shadow-sm mb-6">';

    h += '<div class="mb-5">';
    h += '<label class="block text-xs font-bold text-on-surface-variant mb-2">プロバイダー</label>';
    h += '<select id="s-provider" class="w-full p-3 rounded-xl border border-secondary-container bg-surface-variant/50 font-bold text-sm focus:border-primary outline-none" onchange="SettingsPage.onProviderChange(this.value)">';
    h += mkOpt('none','使用しない',aiProvider);
    h += mkOpt('gemini','Google Gemini — 無料枠あり',aiProvider);
    h += mkOpt('openai','OpenAI GPT — 安定・高精度',aiProvider);
    h += mkOpt('claude','Anthropic Claude — 日本語に強い',aiProvider);
    h += '</select></div>';

    if (aiProvider !== 'none') {
      var models = VisionAI.MODELS[aiProvider] || [];
      h += '<div class="mb-5">';
      h += '<label class="block text-xs font-bold text-on-surface-variant mb-2">モデル</label>';
      h += '<select id="s-model" class="w-full p-3 rounded-xl border border-secondary-container bg-surface-variant/50 font-bold text-sm focus:border-primary outline-none" onchange="SettingsPage.onModelChange(this.value)">';
      for (var i=0; i<models.length; i++) {
        var m = models[i], cy = VisionAI.estimateCostYenForModel(aiProvider,m.id);
        h += '<option value="'+m.id+'"'+(m.id===aiModel?' selected':'')+'>'+m.label+' （'+m.cost+' 約'+fmtCost(cy)+'円/回）</option>';
      }
      h += '</select></div>';

      h += '<div class="mb-4">';
      h += '<label class="block text-xs font-bold text-on-surface-variant mb-2">APIキー</label>';
      h += '<div class="flex gap-2">';
      h += '<input type="password" id="s-apikey" value="'+esc(apiKey)+'" placeholder="APIキーを貼り付け" class="flex-1 p-3 rounded-xl border border-secondary-container bg-surface-variant/50 text-sm font-mono focus:border-primary outline-none">';
      h += '<button onclick="SettingsPage.toggleKey()" class="px-3 rounded-xl border border-secondary-container bg-white text-on-surface-variant"><span class="material-symbols-rounded text-lg">visibility</span></button>';
      h += '</div>';
      h += '<div class="flex gap-2 mt-3">';
      h += '<button onclick="SettingsPage.saveKey()" class="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm active:scale-95 transition-transform">保存</button>';
      h += '<button onclick="SettingsPage.testKey()" class="flex-1 py-2.5 rounded-xl border border-primary/20 text-primary font-bold text-sm active:scale-95 transition-transform">接続テスト</button>';
      h += '</div>';
      h += '<div id="s-test-result" class="mt-2 text-xs"></div></div>';

      h += '<div class="flex items-center justify-between p-3 rounded-xl bg-primary-container/30">';
      h += '<div class="text-xs text-on-surface-variant">今月 <strong class="text-on-surface">'+scanCount+'回</strong></div>';
      h += '<div class="text-xs text-on-surface-variant">推定 <strong class="text-on-surface">'+fmtCost(costTotal)+'円</strong></div></div>';

      var links={gemini:['https://aistudio.google.com/apikey','Google AI Studio で取得（無料枠あり）'],openai:['https://platform.openai.com/api-keys','OpenAI Platform で取得'],claude:['https://console.anthropic.com/account/keys','Anthropic Console で取得']};
      var lk=links[aiProvider];
      if(lk) h+='<a href="'+lk[0]+'" target="_blank" class="flex items-center gap-2 mt-3 text-xs text-primary font-bold"><span class="material-symbols-rounded text-sm">open_in_new</span> '+lk[1]+'</a>';
    }
    h += '</div>';

    // ── 家族構成 ──
    h += secTitle('groups','家族構成');
    h += '<div class="bg-white border border-secondary-container rounded-2xl p-5 shadow-sm mb-6">';
    h += '<p class="text-xs text-on-surface-variant mb-5">生存日数シミュレーションに使用します。</p>';
    h += mkStepper('adults','大人','12歳以上',adults);
    h += mkStepper('children','子供','12歳未満',children);
    h += '</div>';

    // ── データ管理 ──
    h += secTitle('folder','データ管理');
    h += '<div class="bg-white border border-secondary-container rounded-2xl overflow-hidden shadow-sm mb-6">';
    h += mkMenu('upload','エクスポート','JSONファイルに保存',"SettingsPage.exportData()");
    h += '<div class="border-t border-secondary-container/60"></div>';
    h += mkMenu('download','インポート','バックアップから復元',"document.getElementById('s-import').click()");
    h += '<input type="file" id="s-import" accept=".json" style="display:none" onchange="SettingsPage.importData(event)">';
    h += '</div>';

    h += '<button onclick="SettingsPage.clearAll()" class="w-full flex items-center gap-3 p-4 rounded-2xl border border-error/20 text-error text-sm font-bold mb-6 active:bg-error/5 transition-colors"><span class="material-symbols-rounded">delete_forever</span> 全データを削除</button>';

    h += '<div class="text-center text-xs text-on-surface-variant pb-4"><p class="font-headline font-bold text-primary text-sm mb-1">LifeStock</p><p>v2.1.0 — 防災・備蓄管理</p><p class="mt-1">データは端末内にのみ保存されます</p></div>';

    el.innerHTML = h;
  }

  function esc(s){return Utils.escape(s||'');}
  function fmtCost(v){return v<1?v.toFixed(2):String(Math.round(v*10)/10);}
  function mkOpt(v,l,cur){return '<option value="'+v+'"'+(v===cur?' selected':'')+'>'+l+'</option>';}
  function secTitle(icon,text){return '<h3 class="flex items-center gap-2 text-xs font-bold text-primary tracking-wide mb-3 mt-2"><span class="material-symbols-rounded text-base">'+icon+'</span> '+text+'</h3>';}
  function mkStepper(key,label,sub,val){
    return '<div class="flex items-center justify-between mb-4"><div><span class="block font-bold text-sm">'+label+'</span><span class="text-[11px] text-on-surface-variant">'+sub+'</span></div>'
    +'<div class="flex items-center gap-3 bg-surface-variant rounded-full px-2 py-1">'
    +'<button onclick="SettingsPage.adj(\''+key+'\',-1)" class="text-primary p-1"><span class="material-symbols-rounded text-xl">remove_circle</span></button>'
    +'<span id="count-'+key+'" class="font-headline font-bold text-lg w-6 text-center">'+val+'</span>'
    +'<button onclick="SettingsPage.adj(\''+key+'\',1)" class="text-primary p-1"><span class="material-symbols-rounded text-xl">add_circle</span></button>'
    +'</div></div>';
  }
  function mkMenu(icon,title,sub,action){
    return '<button onclick="'+action+'" class="w-full flex items-center gap-4 p-4 text-left active:bg-surface-variant/50 transition-colors">'
    +'<span class="material-symbols-rounded text-primary">'+icon+'</span>'
    +'<div class="flex-1"><div class="font-bold text-sm">'+title+'</div><div class="text-[11px] text-on-surface-variant">'+sub+'</div></div>'
    +'<span class="material-symbols-rounded text-on-surface-variant text-lg">chevron_right</span></button>';
  }

  async function onProviderChange(val){
    await DB.Settings.set('ai_provider',val);
    if(val!=='none') await DB.Settings.get('ai_model_'+val,VisionAI.getDefaultModel(val));
    render();
    Toast.success('✅ '+VisionAI.providerLabel(val));
  }
  async function onModelChange(val){
    var p=await DB.Settings.get('ai_provider','none');
    await DB.Settings.set('ai_model_'+p,val);
    Toast.success('✅ '+VisionAI.modelLabel(p,val));
  }
  function toggleKey(){var inp=document.getElementById('s-apikey');if(inp)inp.type=inp.type==='password'?'text':'password';}
  async function saveKey(){
    var inp=document.getElementById('s-apikey');if(!inp)return;
    var p=await DB.Settings.get('ai_provider','none');
    await DB.Settings.set('ai_key_'+p,inp.value.trim());
    Toast.success('💾 保存しました');
  }
  async function testKey(){
    var res=document.getElementById('s-test-result');
    if(res)res.innerHTML='<span class="text-on-surface-variant">テスト中...</span>';
    try{await VisionAI.testConnection();if(res)res.innerHTML='<span class="text-primary font-bold">✅ 接続成功</span>';Toast.success('✅ 接続OK');}
    catch(e){var msg=e.message==='NO_KEY'?'APIキーを入力してください':e.message;if(res)res.innerHTML='<span class="text-error font-bold">❌ '+esc(msg)+'</span>';Toast.error('接続失敗');}
  }
  async function adj(type,delta){
    var key='family_'+type,cur=parseInt(await DB.Settings.get(key,'0'))||0,next=Math.max(0,cur+delta);
    await DB.Settings.set(key,String(next));
    var el=document.getElementById('count-'+type);
    if(el){el.textContent=next;el.style.transform='scale(1.2)';setTimeout(function(){el.style.transform='';},150);}
  }
  async function exportData(){
    try{var data=await DB.exportAll();if(data.settings)data.settings=data.settings.filter(function(s){return !s.key.startsWith('ai_key_');});
    var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download='lifestock-'+new Date().toISOString().split('T')[0]+'.json';
    a.click();URL.revokeObjectURL(a.href);Toast.success('📤 エクスポート完了');}catch(e){Toast.error('エクスポート失敗');}
  }
  async function importData(event){
    var file=event.target.files[0];if(!file)return;
    if(!confirm('現在のデータを上書きしますか？')){event.target.value='';return;}
    try{await DB.importAll(JSON.parse(await file.text()));Toast.success('📥 インポート完了');render();}catch(e){Toast.error('インポート失敗');}
    event.target.value='';
  }
  async function clearAll(){
    if(!confirm('全データを完全に削除しますか？'))return;
    try{await DB.importAll({items:[],item_stocks:[],profiles:[],shopping:[],settings:[]});Toast.success('削除しました');render();}catch(e){Toast.error('削除失敗');}
  }

  // 互換用
  async function selectProvider(id){await onProviderChange(id);}
  async function selectModel(p,m){await DB.Settings.set('ai_model_'+p,m);}
  function toggleKeyVisibility(){toggleKey();}
  async function saveApiKey(){await saveKey();}
  async function testConnection(){await testKey();}
  async function adjustFamily(t,d){await adj(t,d);}

  return {render,onProviderChange,onModelChange,toggleKey,saveKey,testKey,adj,exportData,importData,clearAll,
    selectProvider,selectModel,toggleKeyVisibility,saveApiKey,testConnection,adjustFamily};
})();
