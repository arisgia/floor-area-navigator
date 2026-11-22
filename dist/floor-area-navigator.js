/* Floor Area Navigator 1.1 - Home Assistant dashboard card. No external dependencies. */
(() => {
  'use strict';
  if (customElements.get('floor-area-navigator')) return;
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
  class FloorAreaNavigator extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({mode:'open'});
      this.config={};
      this.floors=[]; this.areas=[]; this.devices=new Map(); this.entities=[];
      this.floor=null; this.area=null; this.loaded=false; this.loading=false;
      this.error=''; this.signature='';
    }
    static getStubConfig(){return {title:'Το σπίτι μου'};}
    getCardSize(){return 8;}
    getGridOptions(){return {columns:'full', min_columns:9};}
    setConfig(config){this.config=config||{}; if(this.isConnected)this.render();}
    connectedCallback(){
      this.shadowRoot.addEventListener('click',ev=>this.click(ev));
      this.render();
      if(this.ha&&!this.loaded)this.load();
    }
    set hass(value){
      this.ha=value;
      if(!this.isConnected)return;
      if(!this.loaded&&!this.loading)this.load();
      else if(this.loaded){
        const sig=this.currentEntities().map(e=>{const s=this.ha.states[e.entity_id];return e.entity_id+':'+s?.last_updated+':'+s?.state;}).join('|');
        if(sig!==this.signature)this.render();
      }
    }
    async load(force=false){
      if(!this.ha||this.loading||(this.loaded&&!force))return;
      this.loading=true;this.error='';this.render();
      try{
        const [floors,areas,devices,entities]=await Promise.all([
          this.ha.callWS({type:'config/floor_registry/list'}),
          this.ha.callWS({type:'config/area_registry/list'}),
          this.ha.callWS({type:'config/device_registry/list'}),
          this.ha.callWS({type:'config/entity_registry/list'})
        ]);
        this.floors=floors.sort((a,b)=>(Number(a.level||0)-Number(b.level||0))||a.name.localeCompare(b.name,'el'));
        this.areas=areas.sort((a,b)=>a.name.localeCompare(b.name,'el'));
        this.devices=new Map(devices.map(d=>[d.id,d]));
        this.entities=entities.filter(e=>!e.disabled_by&&!e.hidden_by&&!e.entity_category&&DOMAINS.has(e.entity_id.split('.')[0]));
        const opts=this.floorOptions();
        if(!opts.some(f=>f.id===this.floor))this.floor=opts[0]?.id??null;
        this.validateArea();this.loaded=true;
      }catch(err){this.error=String(err?.message||err);}
      finally{this.loading=false;this.render();}
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
      const body=this.loading?'<div class="notice">Φόρτωση…</div>':this.error?'<div class="notice">Σφάλμα: '+escapeHtml(this.error)+'</div>':!floors.length?
        '<div class="notice">Δημιούργησε πρώτα Floors και Areas στις Ρυθμίσεις του Home Assistant.</div>':
        '<h3>1. Επίλεξε όροφο</h3><div class="grid floors">'+floors.map(f=>
          '<button class="choice '+(this.floor===f.id?'chosen':'')+'" data-floor="'+escapeHtml(f.id)+'">'+icon(f.icon,'🏠')+'<span>'+escapeHtml(f.name)+'</span></button>').join('')+'</div>'+
        '<h3>2. Επίλεξε δωμάτιο <em>'+escapeHtml(selected?.name||'')+'</em></h3><div class="grid areas">'+areas.map(a=>
          '<button class="choice '+(this.area===a.area_id?'chosen':'')+'" data-area="'+escapeHtml(a.area_id)+'">'+icon(a.icon,'🚪')+'<span>'+escapeHtml(a.name)+'</span></button>').join('')+'</div>'+
        '<h3>3. Χειριστήρια <em>'+escapeHtml(room?.name||'')+'</em></h3>'+
        (entities.length?GROUPS.map(([domain,label,glyph])=>{
          const group=entities.filter(e=>e.entity_id.startsWith(domain+'.'));
          return group.length?'<section><h4>'+glyph+' '+escapeHtml(label)+' ('+group.length+')</h4><div class="grid controls">'+group.map(e=>this.entity(e)).join('')+'</div></section>':'';
        }).join(''):'<div class="notice">Δεν βρέθηκαν entities στο επιλεγμένο Area.</div>');
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
        .grid{display:grid;gap:10px}.floors{grid-template-columns:repeat(auto-fit,minmax(135px,1fr))}
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
        @media(max-width:480px){.floors,.areas,.controls{grid-template-columns:repeat(2,minmax(0,1fr))}}
      </style><ha-card><header><h2>${escapeHtml(this.config.title||'Το σπίτι μου')}</h2><button class="refresh" data-refresh="1">↻ Ανανέωση</button></header>${body}</ha-card>`;
      this.signature=entities.map(e=>{const s=this.ha?.states[e.entity_id];return e.entity_id+':'+s?.last_updated+':'+s?.state;}).join('|');
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
      if(d.floor){this.floor=d.floor;this.validateArea();this.render();return;}
      if(d.area){this.area=d.area;this.render();return;}
      if(d.info){this.moreInfo(d.info);return;}
      if(d.toggle){await this.service(d.toggle.split('.')[0],'toggle',{entity_id:d.toggle});return;}
      if(d.cmd){await this.service('cover',d.cmd,{entity_id:d.entity});return;}
      if(d.run){await this.service(d.run.split('.')[0],'turn_on',{entity_id:d.run});return;}
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
  customElements.define('floor-area-navigator',FloorAreaNavigator);
  window.customCards=window.customCards||[];
  window.customCards.push({type:'floor-area-navigator',name:'Όροφοι → Δωμάτια → Χειριστήρια',description:'Αυτόματη πλοήγηση μέσω Floors, Areas και Entities',preview:false});
})();
