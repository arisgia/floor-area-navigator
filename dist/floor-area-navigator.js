/* Floor Area Navigator 2.3 - global live Scripts + visual dashboard/card editor. */
(() => {
  'use strict';
  // Guard against loading the same frontend resource twice in one page session.
  if (window.__floorAreaNavigatorModuleLoaded) return;
  window.__floorAreaNavigatorModuleLoaded = true;
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const GROUPS = [
    ['light','Φώτα','💡'],['cover','Ρολά / Σκίαση','🪟'],['climate','Θέρμανση / Ψύξη','🌡️'],
    ['switch','Διακόπτες','🔌'],['input_boolean','Βοηθητικά','🔘'],['fan','Ανεμιστήρες','🌀'],
    ['scene','Σκηνές','✨'],['script','Σενάρια','▶️'],['camera','Κάμερες','📹'],
    ['media_player','Πολυμέσα','📺'],['sensor','Αισθητήρες','📊'],['binary_sensor','Καταστάσεις','📍']
  ];
  const DOMAINS = new Set(GROUPS.map(a => a[0]));
  const icon = (value, fallback) => value && value.startsWith('mdi:') ?
    '<ha-icon icon="' + escapeHtml(value) + '"></ha-icon>' : escapeHtml(value || fallback);
  // Physical order of floors: basement -2, basement -1, ground 0, first 1,
  // second 2, roof at the top. Prefer explicit HA level when configured.
  // When every HA level is empty/zero, infer the level from Greek/English names.
  const numericLevel = floor => {
    const value=floor.level;
    return value===null||value===undefined||value===''||!Number.isFinite(Number(value))
      ? null : Number(value);
  };
  const inferredLevel = name => {
    const label=String(name||'').toLocaleLowerCase('el')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
    const digit=label.match(/-?\d+/);
    const number=digit ? Number(digit[0]) : null;
    if(/υπογει|basement|underground|υποσταθ|^(?:b|β)\s*-?\d/.test(label))
      return -Math.max(1,Math.abs(number??1));
    if(/ισογει|ground\s*floor|ground\s*level|pilotis|πυλωτ|ισογε/.test(label))return 0;
    if(/δωμα|ταρατσ|roof|terrace|attic|ρετιρε/.test(label))return 100;
    if(number!==null && /οροφ|floor|level|επιπεδ|^(?:-?\d+)/.test(label))return number;
    const words=[
      ['πρωτ',1],['first',1],['δευτερ',2],['second',2],['τριτ',3],['third',3],
      ['τεταρτ',4],['fourth',4],['πεμπτ',5],['fifth',5],['εκτ',6],['sixth',6]
    ];
    for(const [pattern,level] of words)if(label.includes(pattern))return level;
    // Greek-letter floor shorthand, e.g. Α' όροφος, Β' όροφος.
    const letter=label.match(/^(?:οροφος\s*)?([αβγδεζηθ])(?:['’΄´ʹ′ʹ.\s-]|$)/);
    if(letter)return {α:1,β:2,γ:3,δ:4,ε:5,ζ:6,η:7,θ:8}[letter[1]]??null;
    return null;
  };
  const compareFloorOrder=(floors) => {
    const levels=floors.map(numericLevel).filter(level=>level!==null);
    const explicitLevelsUseful=new Set(levels).size>1;
    const order=f=>{
      const explicit=numericLevel(f);
      const inferred=inferredLevel(f.name);
      if(explicitLevelsUseful && explicit!==null)return explicit;
      return inferred??explicit??999;
    };
    return [...floors].sort((a,b)=>order(a)-order(b)||
      String(a.name||'').localeCompare(String(b.name||''),'el',{numeric:true}));
  };
  class FloorAreaNavigator extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({mode:'open'});
      this.config={};
      this.floors=[]; this.areas=[]; this.devices=new Map(); this.entities=[];
      this.floor=null; this.area=null; this.loaded=false; this.loading=false;
      this.error=''; this.signature='';
      this.watchingConnection=null; this.unsubscribers=[]; this.refreshTimer=null; this.pollTimer=null;
      this.focusListener=null; this.visibilityListener=null; this.pendingRefresh=false;
      this.scriptsCollapsed=null;
    }
    static getStubConfig(){return {title:'Το σπίτι μου',show_scripts:true};}
    static getConfigElement(){return document.createElement('floor-area-navigator-editor');}
    getCardSize(){return 8;}
    getGridOptions(){return {columns:'full', min_columns:9};}
    setConfig(config){
      const next=config||{};
      if(this.scriptsCollapsed===null || this.config?.scripts_collapsed!==next.scripts_collapsed){
        this.scriptsCollapsed=next.scripts_collapsed===true;
      }
      this.config=next;
      if(this.isConnected)this.render();
    }
    connectedCallback(){
      if(!this.clickListener){
        this.clickListener=ev=>this.click(ev);
        this.shadowRoot.addEventListener('click',this.clickListener);
      }
      this.render();
      this.startWatching();
      if(this.ha&&!this.loaded)this.load();
    }
    disconnectedCallback(){
      this.stopWatching();
    }
    set hass(value){
      this.ha=value;
      if(!this.isConnected)return;
      this.startWatching();
      if(!this.loaded&&!this.loading)this.load();
      else if(this.loaded){
        const sig=this.currentEntities().map(e=>{const s=this.ha.states[e.entity_id];return e.entity_id+':'+s?.last_updated+':'+s?.state;}).join('|')+'|scripts:'+this.scriptSignature();
        if(sig!==this.signature)this.render();
      }
    }
    startWatching(){
      const conn=this.ha?.connection;
      if(!this.isConnected||!conn||this.watchingConnection===conn)return;
      this.stopWatching();
      this.watchingConnection=conn;
      // Registry updates are published on the Home Assistant event bus.
      // Subscribing is near-real-time; the poll is a safety net if an event is missed.
      if(typeof conn.subscribeEvents==='function'){
        for(const type of ['floor_registry_updated','area_registry_updated','device_registry_updated','entity_registry_updated']){
          Promise.resolve().then(()=>conn.subscribeEvents(()=>this.scheduleRefresh(),type))
            .then(unsubscribe=>{
              if(typeof unsubscribe!=='function')return;
              if(this.isConnected&&this.watchingConnection===conn)this.unsubscribers.push(unsubscribe);
              else unsubscribe();
            })
            .catch(error=>console.warn('[Floor Area Navigator] Subscription unavailable:',type,error));
        }
      }
      this.pollTimer=window.setInterval(()=>this.scheduleRefresh(),30000);
      this.focusListener=()=>this.scheduleRefresh();
      window.addEventListener('focus',this.focusListener);
      this.visibilityListener=()=>{if(!document.hidden)this.scheduleRefresh();};
      document.addEventListener('visibilitychange',this.visibilityListener);
    }
    stopWatching(){
      this.watchingConnection=null;
      for(const unsubscribe of this.unsubscribers){
        try{unsubscribe();}catch(error){console.warn('[Floor Area Navigator] Unsubscribe:',error);}
      }
      this.unsubscribers=[];
      if(this.pollTimer!==null){window.clearInterval(this.pollTimer);this.pollTimer=null;}
      if(this.refreshTimer!==null){window.clearTimeout(this.refreshTimer);this.refreshTimer=null;}
      if(this.focusListener){window.removeEventListener('focus',this.focusListener);this.focusListener=null;}
      if(this.visibilityListener){document.removeEventListener('visibilitychange',this.visibilityListener);this.visibilityListener=null;}
      this.pendingRefresh=false;
    }
    scheduleRefresh(){
      if(!this.isConnected||!this.ha)return;
      if(this.refreshTimer!==null)window.clearTimeout(this.refreshTimer);
      // A single addition can emit multiple device + entity events; coalesce them.
      this.refreshTimer=window.setTimeout(()=>{
        this.refreshTimer=null;
        this.load(true);
      },900);
    }
    async load(force=false){
      if(!this.ha||(this.loaded&&!force))return;
      if(this.loading){if(force)this.pendingRefresh=true;return;}
      this.loading=true;this.error='';
      if(!this.loaded)this.render();
      try{
        const [floors,areas,devices,entities]=await Promise.all([
          this.ha.callWS({type:'config/floor_registry/list'}),
          this.ha.callWS({type:'config/area_registry/list'}),
          this.ha.callWS({type:'config/device_registry/list'}),
          this.ha.callWS({type:'config/entity_registry/list'})
        ]);
        this.floors=compareFloorOrder(floors);
        this.areas=areas.sort((a,b)=>a.name.localeCompare(b.name,'el'));
        this.devices=new Map(devices.map(d=>[d.id,d]));
        this.entities=entities.filter(e=>!e.disabled_by&&!e.hidden_by&&!e.entity_category&&DOMAINS.has(e.entity_id.split('.')[0]));
        const opts=this.floorOptions();
        if(!opts.some(f=>f.id===this.floor))this.floor=opts[0]?.id??null;
        this.validateArea();this.loaded=true;
      }catch(err){this.error=String(err?.message||err);}
      finally{
        this.loading=false;this.render();
        // If an update arrives during a registry fetch, fetch once more.
        if(this.pendingRefresh){
          this.pendingRefresh=false;
          this.scheduleRefresh();
        }
      }
    }
    floorOptions(){
      const list=this.floors.map(f=>({id:f.floor_id,name:f.name,icon:f.icon||'🏠'}));
      if(this.areas.some(a=>!a.floor_id))list.push({id:'__unassigned__',name:'Χωρίς όροφο',icon:'📍'});
      return list;
    }
    floorAreas(){return this.areas.filter(a=>this.floor==='__unassigned__'?!a.floor_id:a.floor_id===this.floor);}
    validateArea(){const list=this.floorAreas();if(!list.some(a=>a.area_id===this.area))this.area=list[0]?.area_id??null;}
    currentEntities(){
      if(!this.area||!this.ha)return [];
      return this.entities.filter(e=>(e.area_id||this.devices.get(e.device_id)?.area_id)===this.area&&this.ha.states[e.entity_id])
        .sort((a,b)=>this.name(a.entity_id).localeCompare(this.name(b.entity_id),'el'));
    }
    allScripts(){
      if(!this.ha?.states)return [];
      // All active Home Assistant script entities, including scripts without an Area.
      // Disabled scripts have no state, so they cannot be executed from this dashboard.
      return Object.entries(this.ha.states).filter(([id])=>id.startsWith('script.'))
        .map(([id,state])=>({id,state}))
        .sort((a,b)=>this.name(a.id).localeCompare(this.name(b.id),'el',{numeric:true}));
    }
    scriptSignature(){
      if(this.config.show_scripts===false||!this.ha)return '';
      return this.allScripts().map(({id,state})=>[id,state.state,state.last_updated,
        state.attributes?.friendly_name,state.attributes?.icon].join(':')).join('|');
    }
    renderScripts(){
      if(this.config.show_scripts===false)return '';
      const scripts=this.allScripts();
      const heading=escapeHtml(this.config.scripts_title||'Scripts · Γρήγορες εντολές');
      const list=scripts.map(({id,state})=>{
        const disabled=['unknown','unavailable'].includes(state.state);
        const label=escapeHtml(this.name(id)),entity=escapeHtml(id);
        return '<div class="script-item"><button class="script-run" data-run="'+entity+'"'+
          (disabled?' disabled':'')+' title="Εκτέλεση: '+label+'">'+
          '<span class="script-glyph">'+icon(state.attributes?.icon,'mdi:script-text-play')+'</span>'+
          '<span class="script-name">'+label+'</span><span class="script-action">▶ Εκτέλεση</span></button>'+
          '<button class="script-info" data-info="'+entity+'" title="Πληροφορίες">⋯</button></div>';
      }).join('');
      return '<section class="global-scripts"><div class="section-header"><h3>⚡ '+heading+
        ' <em>('+scripts.length+')</em></h3><button class="section-toggle" data-toggle-scripts="1" aria-expanded="'+
        (!this.scriptsCollapsed)+'">'+(this.scriptsCollapsed?'Εμφάνιση ▾':'Σύμπτυξη ▴')+
        '</button></div>'+(this.scriptsCollapsed?'':'<div class="grid scripts">'+
        (list||'<div class="notice">Δεν υπάρχουν scripts στο Home Assistant.</div>')+
        '</div>')+'</section>';
    }
    name(id){return this.ha?.states[id]?.attributes?.friendly_name||id;}
    state(s){if(!s)return 'Άγνωστο';try{return this.ha.formatEntityState(s);}catch{return s.state;}}
    entity(e){
      const id=e.entity_id, s=this.ha.states[id], domain=id.split('.')[0], a=s.attributes||{}, bad=['unknown','unavailable'].includes(s.state);
      const n=escapeHtml(this.name(id)), status=escapeHtml(this.state(s)), eid=escapeHtml(id);
      const glyph=GROUPS.find(g=>g[0]===domain)?.[2]||'◉';
      let actions='', extra=status;
      if(['light','switch','input_boolean','fan'].includes(domain)){
        const on=s.state==='on';
        actions='<button class="primary '+(on?'active':'')+'" data-toggle="'+eid+'" '+(bad?'disabled':'')+'>'+(on?'Κλείσιμο':'Άνοιγμα')+'</button>';
      }else if(domain==='cover'){
        const features=Number(a.supported_features??15);
        extra+=a.current_position!=null?' · '+escapeHtml(a.current_position)+'%':'';
        actions='<div class="actions"><button title="Άνοιγμα" data-cmd="open_cover" data-entity="'+eid+'" '+(bad||!(features&1)?'disabled':'')+'>▲</button>'+
          '<button title="Σταμάτημα" data-cmd="stop_cover" data-entity="'+eid+'" '+(bad||!(features&8)?'disabled':'')+'>■</button>'+
          '<button title="Κλείσιμο" data-cmd="close_cover" data-entity="'+eid+'" '+(bad||!(features&2)?'disabled':'')+'>▼</button></div>';
      }else if(domain==='climate'){
        extra='Χώρος: '+escapeHtml(a.current_temperature??'—')+'° · Στόχος: '+escapeHtml(a.temperature??'—')+'°';
        const supports=!!(Number(a.supported_features||0)&1)&&Number.isFinite(Number(a.temperature));
        actions='<div class="actions"><button data-temp="-1" data-entity="'+eid+'" '+(bad||!supports?'disabled':'')+'>−</button>'+
          '<button data-info="'+eid+'">Ρύθμιση</button><button data-temp="1" data-entity="'+eid+'" '+(bad||!supports?'disabled':'')+'>+</button></div>';
      }else if(['scene','script'].includes(domain)){
        actions='<button class="primary" data-run="'+eid+'" '+(bad?'disabled':'')+'>Εκτέλεση</button>';
      }else if(['camera','media_player'].includes(domain)){
        actions='<button class="primary" data-info="'+eid+'">Άνοιγμα</button>';
      }
      return '<div class="entity '+(bad?'dim':'')+'"><div class="entitytop"><span>'+glyph+'</span><button data-info="'+eid+'" title="Περισσότερα">⋯</button></div>'+
        '<strong>'+n+'</strong><small>'+extra+'</small>'+actions+'</div>';
    }
    render(){
      const root=this.shadowRoot;if(!root)return;
      const floors=this.floorOptions(),areas=this.floorAreas(),selected=floors.find(f=>f.id===this.floor),room=this.areas.find(a=>a.area_id===this.area);
      const entities=this.currentEntities();
      const scriptsSection=this.renderScripts();
      const body=(this.loading&&!this.loaded)?'<div class="notice">Φόρτωση…</div>':(this.error&&!this.loaded)?'<div class="notice">Σφάλμα: '+escapeHtml(this.error)+'</div>':scriptsSection+(!floors.length?
        '<div class="notice">Δημιούργησε πρώτα Floors και Areas στις Ρυθμίσεις του Home Assistant.</div>':
        '<h3>1. Επίλεξε όροφο</h3><div class="grid floors">'+floors.map(f=>
          '<button class="choice '+(this.floor===f.id?'chosen':'')+'" data-floor="'+escapeHtml(f.id)+'">'+icon(f.icon,'🏠')+'<span>'+escapeHtml(f.name)+'</span></button>').join('')+'</div>'+
        '<h3>2. Επίλεξε δωμάτιο <em>'+escapeHtml(selected?.name||'')+'</em></h3><div class="grid areas">'+areas.map(a=>
          '<button class="choice '+(this.area===a.area_id?'chosen':'')+'" data-area="'+escapeHtml(a.area_id)+'">'+icon(a.icon,'🚪')+'<span>'+escapeHtml(a.name)+'</span></button>').join('')+'</div>'+
        '<h3>3. Χειριστήρια <em>'+escapeHtml(room?.name||'')+'</em></h3>'+
        (entities.length?GROUPS.map(([domain,label,glyph])=>{
          const group=entities.filter(e=>e.entity_id.startsWith(domain+'.'));
          return group.length?'<section><h4>'+glyph+' '+escapeHtml(label)+' ('+group.length+')</h4><div class="grid controls">'+group.map(e=>this.entity(e)).join('')+'</div></section>':'';
        }).join(''):'<div class="notice">Δεν βρέθηκαν entities στο επιλεγμένο Area.</div>'));
      root.innerHTML=`<style>
        :host{display:block;color:var(--primary-text-color);font-family:Roboto,Arial,sans-serif}
        ha-card{padding:clamp(14px,2vw,28px);border-radius:18px}
        button{cursor:pointer;font:inherit;color:inherit;border:0}
        button:disabled{opacity:.35;cursor:not-allowed}
        button:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
        header{display:flex;justify-content:space-between;align-items:center;gap:10px}
        h2{font-size:24px;margin:0}h3{font-size:17px;margin:22px 0 10px}
        h4{font-size:15px;margin:16px 0 9px}
        em{font-style:normal;color:var(--secondary-text-color);font-size:13px;font-weight:400;margin-left:7px}
        .refresh{padding:9px 12px;border-radius:10px;background:var(--secondary-background-color)}
        .grid{display:grid;gap:10px}
        .section-header{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
        .section-header h3{margin:18px 0 10px}
        .section-toggle{padding:8px 12px;border-radius:10px;background:var(--secondary-background-color)}
        .global-scripts{border-bottom:1px solid var(--divider-color);padding-bottom:18px;margin-bottom:10px}
        .scripts{grid-template-columns:repeat(auto-fit,minmax(165px,1fr))}
        .script-item{display:flex;align-items:stretch;border:1px solid var(--divider-color);border-radius:14px;overflow:hidden;min-width:0;background:var(--card-background-color)}
        .script-run{flex:1;min-height:83px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:12px 7px;min-width:0}
        .script-run:hover:not(:disabled){background:var(--secondary-background-color)}
        .script-glyph ha-icon{--mdc-icon-size:26px}
        .script-name{font-size:14px;font-weight:600;overflow-wrap:anywhere;text-align:center}
        .script-action{font-size:12px;color:var(--secondary-text-color)}
        .script-info{width:35px;flex-shrink:0;background:var(--secondary-background-color)}
        .floors{grid-template-columns:repeat(auto-fit,minmax(135px,1fr))}
        .areas{grid-template-columns:repeat(auto-fit,minmax(115px,1fr))}
        .controls{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
        .choice{min-height:95px;display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:10px;border:1px solid var(--divider-color);border-radius:14px;background:var(--card-background-color);padding:10px;font-weight:600}
        .choice.chosen{border:2px solid var(--primary-color);background:var(--secondary-background-color)}
        .choice ha-icon{--mdc-icon-size:28px}.choice span{font-size:14px}
        .entity{min-width:0;padding:13px;border:1px solid var(--divider-color);border-radius:14px;
          display:flex;flex-direction:column;gap:10px;background:var(--card-background-color)}
        .entitytop{display:flex;justify-content:space-between;font-size:23px}
        .entitytop button{border-radius:99px;background:var(--secondary-background-color);width:30px;height:30px}
        strong{font-size:14px;overflow-wrap:anywhere}small{font-size:12px;color:var(--secondary-text-color);min-height:26px}
        .primary,.actions button{background:var(--secondary-background-color);border-radius:9px;min-height:36px;padding:8px}
        .primary.active{background:var(--primary-color);color:white}
        .actions{display:flex;gap:5px}.actions button{flex:1}
        .dim{opacity:.65}.notice{border:1px dashed var(--divider-color);border-radius:12px;padding:18px}
        @media(max-width:480px){.floors,.areas,.controls,.scripts{grid-template-columns:repeat(2,minmax(0,1fr))}}
      </style><ha-card><header><h2>${escapeHtml(this.config.title||'Το σπίτι μου')}</h2><button class="refresh" data-refresh="1">↻ Ανανέωση</button></header>${body}</ha-card>`;
      this.signature=entities.map(e=>{const s=this.ha?.states[e.entity_id];return e.entity_id+':'+s?.last_updated+':'+s?.state;}).join('|')+'|scripts:'+this.scriptSignature();
    }
    moreInfo(id){this.dispatchEvent(new CustomEvent('hass-more-info',{bubbles:true,composed:true,detail:{entityId:id}}));}
    async service(domain,name,data){
      try{await this.ha.callService(domain,name,data);}
      catch(err){alert('Αποτυχία εντολής: '+String(err?.message||err));}
    }
    async click(ev){
      const btn=ev.target.closest('button');if(!btn||btn.disabled)return;
      const d=btn.dataset;
      if(d.refresh){await this.load(true);return;}
      if(d.toggleScripts){this.scriptsCollapsed=!this.scriptsCollapsed;this.render();return;}
      if(d.floor){this.floor=d.floor;this.validateArea();this.render();return;}
      if(d.area){this.area=d.area;this.render();return;}
      if(d.info){this.moreInfo(d.info);return;}
      if(d.toggle){await this.service(d.toggle.split('.')[0],'toggle',{entity_id:d.toggle});return;}
      if(d.cmd){await this.service('cover',d.cmd,{entity_id:d.entity});return;}
      if(d.run){
        if(d.run.startsWith('script.')&&this.config.confirm_scripts===true &&
          !window.confirm('Εκτέλεση script: '+this.name(d.run)+';'))return;
        await this.service(d.run.split('.')[0],'turn_on',{entity_id:d.run});return;
      }
      if(d.temp&&d.entity){
        const a=this.ha.states[d.entity]?.attributes||{},target=Number(a.temperature);
        if(!Number.isFinite(target)){this.moreInfo(d.entity);return;}
        const step=Number(a.target_temp_step)>0?Number(a.target_temp_step):0.5;
        const min=a.min_temp!=null?Number(a.min_temp):7,max=a.max_temp!=null?Number(a.max_temp):35;
        const value=Math.max(min,Math.min(max,Math.round((target+Number(d.temp)*step)*100)/100));
        await this.service('climate','set_temperature',{entity_id:d.entity,temperature:value});
      }
    }
  }

  // Shared visual editor: works for both a standalone dashboard strategy and
  // the legacy custom Lovelace card. HA persists changes via config-changed.
  class FloorAreaNavigatorEditor extends HTMLElement {
    constructor(){
      super();this.attachShadow({mode:'open'});this.config={};this.bound=false;
    }
    set hass(value){this._hass=value;}
    setConfig(config){
      const next={...(config||{})};
      if(JSON.stringify(next)===JSON.stringify(this.config))return;
      this.config=next;this.render();
    }
    connectedCallback(){
      if(!this.bound){
        this.bound=true;
        const update=ev=>this.change(ev);
        this.shadowRoot.addEventListener('input',update);
        this.shadowRoot.addEventListener('change',update);
      }
      this.render();
    }
    change(ev){
      const field=ev.target?.dataset?.field;
      if(!field)return;
      const target=ev.target, value=target.type==='checkbox'?target.checked:target.value;
      // Keep the passed config.type, so this works for both card and strategy.
      this.config={...this.config,[field]:value};
      this.dispatchEvent(new CustomEvent('config-changed',{
        detail:{config:{...this.config}},bubbles:true,composed:true
      }));
    }
    render(){
      if(!this.shadowRoot)return;
      const c=this.config, checked=(k,def=true)=>(c[k]===undefined?def:c[k])?' checked':'';
      this.shadowRoot.innerHTML=`<style>
        :host{display:block;color:var(--primary-text-color);font-family:Roboto,Arial,sans-serif}
        .editor{display:flex;flex-direction:column;gap:16px;padding:12px 4px}
        h3{margin:0;font-size:16px}
        label{display:flex;flex-direction:column;gap:6px;font-size:14px}
        input[type="text"]{box-sizing:border-box;width:100%;border:1px solid var(--divider-color);border-radius:9px;
          padding:12px;background:var(--card-background-color);color:var(--primary-text-color);font:inherit}
        .check{flex-direction:row;align-items:center;gap:10px}
        input[type="checkbox"]{accent-color:var(--primary-color);width:18px;height:18px}
        small{color:var(--secondary-text-color)}
      </style><div class="editor">
        <h3>Ρυθμίσεις Floor Area Navigator</h3>
        <label>Τίτλος dashboard / κάρτας
          <input type="text" data-field="title" value="${escapeHtml(c.title??'Το σπίτι μου')}">
        </label>
        <label class="check">
          <input type="checkbox" data-field="show_scripts"${checked('show_scripts')}>
          Εμφάνιση όλων των Scripts πάνω από τους ορόφους
        </label>
        <label>Τίτλος ενότητας Scripts
          <input type="text" data-field="scripts_title" value="${escapeHtml(c.scripts_title??'Scripts · Γρήγορες εντολές')}">
        </label>
        <label class="check">
          <input type="checkbox" data-field="scripts_collapsed"${checked('scripts_collapsed',false)}>
          Αρχικά συμπτυγμένα Scripts
        </label>
        <label class="check">
          <input type="checkbox" data-field="confirm_scripts"${checked('confirm_scripts',false)}>
          Ζήτα επιβεβαίωση πριν από την εκτέλεση Script
        </label>
        <small>Τα Scripts, οι όροφοι και τα δωμάτια ανανεώνονται αυτόματα από το Home Assistant.
        Οι αλλαγές του Visual Editor αποθηκεύονται από το Home Assistant όταν πατήσεις Save.</small>
      </div>`;
    }
  }
  // Home Assistant 2026.5+ native dashboard strategy. Registers in the Community dashboards picker.
  // It generates a full panel dashboard from the existing self-populating card:
  // no YAML and no static list of rooms or entities are required.
  class FloorAreaDashboardStrategy extends HTMLElement {
    static noEditor = false;
    static async getConfigElement(){return document.createElement('floor-area-navigator-strategy-editor');}
    static registryDependencies = ['floors', 'areas', 'devices', 'entities'];
    static getCreateSuggestions() {
      return { title: 'Το σπίτι μου', icon: 'mdi:home-floor-1' };
    }
    static async generate(config) {
      const title = config?.title || 'Το σπίτι μου';
      return {
        title,
        views: [{
          title,
          path: 'home',
          icon: 'mdi:home',
          panel: true,
          cards: [{
            type: 'custom:floor-area-navigator',
            title,
            show_scripts: config?.show_scripts!==false,
            scripts_title: config?.scripts_title||'Scripts · Γρήγορες εντολές',
            scripts_collapsed: config?.scripts_collapsed===true,
            confirm_scripts: config?.confirm_scripts===true
          }]
        }]
      };
    }
  }

  // HA can replace the CustomElementRegistry while booting. Register into the
  // current registry again if that happens, preventing 5-second strategy timeouts.
  const registerComponents = () => {
    const registry = window.customElements;
    if (!registry.get('floor-area-navigator')) {
      registry.define('floor-area-navigator', FloorAreaNavigator);
    }
    if (!registry.get('floor-area-navigator-editor')) {
      registry.define('floor-area-navigator-editor', FloorAreaNavigatorEditor);
    }
    if (!registry.get('floor-area-navigator-strategy-editor')) {
      registry.define('floor-area-navigator-strategy-editor', class extends FloorAreaNavigatorEditor {});
    }
    if (!registry.get('ll-strategy-dashboard-floor-area-navigator')) {
      registry.define('ll-strategy-dashboard-floor-area-navigator', FloorAreaDashboardStrategy);
    }
  };
  registerComponents();

  const bootRegistry = window.customElements;
  bootRegistry.whenDefined('home-assistant').then(registerComponents, () => undefined);
  let registryChecks = 0;
  const checkRegistry = () => {
    if (registryChecks++ >= 40) return;
    registerComponents();
    if (window.customElements === bootRegistry && !window.customElements.get('home-assistant')) {
      window.setTimeout(checkRegistry, 250);
    } else if (window.customElements !== bootRegistry) {
      window.setTimeout(registerComponents, 1000);
    }
  };
  window.setTimeout(checkRegistry, 250);

  window.customStrategies = Array.isArray(window.customStrategies) ? window.customStrategies : [];
  if (!window.customStrategies.some(s => s.type === 'floor-area-navigator' && s.strategyType === 'dashboard')) {
    window.customStrategies.push({
      type: 'floor-area-navigator',
      strategyType: 'dashboard',
      name: 'Floor Area Navigator',
      description: 'Αυτόματο dashboard: Όροφος → Δωμάτιο → Χειριστήρια. Χωρίς YAML.',
      documentationURL: 'https://github.com/arisgia/floor-area-navigator'
    });
  }
  window.customCards=window.customCards||[];
  window.customCards.push({type:'floor-area-navigator',name:'Όροφοι → Δωμάτια → Χειριστήρια',description:'Αυτόματη πλοήγηση μέσω Floors, Areas και Entities',preview:false});
})();
