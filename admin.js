/*
 * StreamDrive - Painel Administrativo independente
 * O site principal continua com sua própria interface; o acesso ao admin usa a mesma tela de login.
 * O painel usa o mesmo catálogo localStorage do site para que inclusões,
 * edições e exclusões apareçam no site principal quando estiverem no mesmo domínio.
 */
(() => {
  "use strict";

  const DB_KEY = "streamdrive_catalog_v23";
  const LEGACY_KEYS = ["streamdrive_mobile_v22","streamdrive_local_v21"];
  const ADMIN_SESSION_KEY = "streamdrive_admin_session_v1";
  const ACCOUNTS_KEY = "streamdrive_accounts_v1";
  const SERIES_OVERRIDES_KEY = "streamdrive_series_overrides_v1";
  const SERIES_ADDED_KEY = "streamdrive_series_added_v1";
  const SERIES_DELETED_KEY = "streamdrive_series_deleted_v1";

  const $ = (s, root=document) => root.querySelector(s);
  const esc = (v="") => String(v).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const clone = v => JSON.parse(JSON.stringify(v));
  let db = loadDB();
  let state = { view:"dashboard", search:"", type:"all", category:"all", editingId:null };

  function normalize(data){
    data = data && typeof data === "object" ? data : {};
    if(!Array.isArray(data.accounts)) data.accounts=[];
    data.accounts.forEach(a=>{
      a.id = a.id || uid("a");
      a.role = a.role === "admin" ? "admin" : "user";
      a.name = a.name || (a.role === "admin" ? "Administrador" : "Usuário");
      a.email = String(a.email || "").trim().toLowerCase();
      a.username = String(a.username || "").trim();
      if(!a.username){
        const base = (a.role === "admin" ? "paineladmin" : (a.email.split("@")[0] || "usuario"));
        a.username = base.replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase() || (a.role === "admin" ? "paineladmin" : "usuario");
      }
      if(!a.password) a.password = a.role === "admin" ? "Admin@2026" : "123456";
      if(!Array.isArray(a.profiles)) a.profiles=[];
      if(!Array.isArray(a.notifications)) a.notifications=[];
    });
    // Migração das credenciais de teste da versão anterior.
    const legacyAdmin=data.accounts.find(a=>a.role==="admin" && a.email==="admin@streamdrive.local");
    if(legacyAdmin && (!legacyAdmin.username || legacyAdmin.username==="admin" || legacyAdmin.password==="123456")){
      legacyAdmin.username="paineladmin"; legacyAdmin.password="Admin@2026";
    }
    const legacyUser=data.accounts.find(a=>a.role!=="admin" && a.email==="usuario@streamdrive.local");
    if(legacyUser){ legacyUser.name="teste6"; legacyUser.username="3030370teste"; legacyUser.email="usuario@streamdrive.local"; legacyUser.password="teste3030370"; legacyUser.profiles=Array.isArray(legacyUser.profiles)&&legacyUser.profiles.length?legacyUser.profiles:[{id:uid("p"),name:"teste6",avatar:"T"}]; }
    if(!data.accounts.some(a=>a.role==="admin")){
      data.accounts.push({id:uid("a"),name:"Administrador",username:"paineladmin",email:"admin@streamdrive.local",password:"Admin@2026",role:"admin",profiles:[{id:uid("p"),name:"Admin",avatar:"A"}]});
    }
    if(!data.accounts.some(a=>a.role!=="admin")){
      data.accounts.push({id:uid("a"),name:"teste6",username:"3030370teste",email:"usuario@streamdrive.local",password:"teste3030370",role:"user",profiles:[{id:uid("p"),name:"teste6",avatar:"T"}]});
    }
    if(!Array.isArray(data.contents)) data.contents=[];
    if(!Array.isArray(data.favorites)) data.favorites=[];
    if(!Array.isArray(data.history)) data.history=[];
    if(!Array.isArray(data.releases)) data.releases=[];
    data.releases=data.releases.map((r,i)=>({id:r.id||uid("rel"),title:String(r.title||"Sem título"),category:String(r.category||"Lançamento recente"),synopsis:String(r.synopsis||""),poster:String(r.poster||""),releaseDate:String(r.releaseDate||""),createdAt:Number(r.createdAt)||Date.now()-i}));
    data.contents.forEach(c => {
      c.id = c.id || uid(c.type === "series" ? "s" : "m");
      c.type = c.type === "series" ? "series" : "movie";
      c.title = c.title || "Sem título";
      c.category = c.category || "Sem categoria";
      c.year = c.year ?? "";
      c.rating = c.rating ?? "";
      c.synopsis = c.synopsis ?? "";
      c.poster = c.poster ?? "";
      c.drive = c.drive ?? "";
      if(c.type === "series"){
        c.seasons = Array.isArray(c.seasons) ? c.seasons : [];
        c.seasons.forEach((s,i)=>{
          s.number = Number(s.number)||i+1;
          s.episodes = Array.isArray(s.episodes) ? s.episodes : [];
          s.episodes.forEach((e,j)=>{
            e.id=e.id||uid("ep"); e.number=Number(e.number)||j+1; e.title=e.title||`Episódio ${j+1}`;
            e.synopsis=e.synopsis||""; e.drive=e.drive||"";
          });
          s.episodes.sort((a,b)=>a.number-b.number);
        });
        c.seasons.sort((a,b)=>a.number-b.number);
      }
    });
    return data;
  }
  function readJSON(key, fallback){
    try { const raw=localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch(e){ return fallback; }
  }
  function writeJSON(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch(e){ console.warn("StreamDrive admin: não foi possível salvar", key, e); return false; }
  }
  function staticSeriesCatalog(){
    const out=[];
    if(typeof importedSeriesCatalog!=="undefined" && Array.isArray(importedSeriesCatalog)) out.push(...importedSeriesCatalog);
    if(typeof seriesCatalog!=="undefined" && Array.isArray(seriesCatalog)) out.push(...seriesCatalog);
    if(typeof houseSeriesCatalog!=="undefined" && Array.isArray(houseSeriesCatalog)) out.push(...houseSeriesCatalog);
    const byId=new Map();
    out.forEach(x=>{ if(x && x.id) byId.set(String(x.id), clone(x)); });
    const byTitle=new Map();
    for(const item of byId.values()){
      const key=String(item.title||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s*\(\d{4}\)\s*$/g,"").replace(/\s*\[l\]\s*$/g,"").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
      const episodes=(item.seasons||[]).reduce((n,s)=>n+(s?.episodes?.length||0),0);
      const prev=byTitle.get(key);
      const prevEpisodes=prev?(prev.seasons||[]).reduce((n,s)=>n+(s?.episodes?.length||0),0):-1;
      if(!prev || episodes>prevEpisodes) byTitle.set(key,item);
    }
    return [...byTitle.values()];
  }
  function loadSeriesOverrides(){ return readJSON(SERIES_OVERRIDES_KEY, {}); }
  function loadSeriesAdded(){ return readJSON(SERIES_ADDED_KEY, []); }
  function loadSeriesDeleted(){ return new Set(readJSON(SERIES_DELETED_KEY, [])); }
  function saveSeriesStore(){
    const overrides={};
    const staticList=staticSeriesCatalog();
    const staticMap=new Map(staticList.map(x=>[String(x.id),x]));
    db.contents.filter(c=>c.type==="series").forEach(c=>{
      const base=staticMap.get(String(c.id));
      if(base && JSON.stringify(base)!==JSON.stringify(c)) overrides[c.id]=clone(c);
    });
    const added=db.contents.filter(c=>c.type==="series" && !staticSeriesCatalog().some(x=>String(x.id)===String(c.id)));
    const deleted=[...loadSeriesDeleted()];
    const staticIds=new Set(staticSeriesCatalog().map(x=>String(x.id)));
    staticIds.forEach(id=>{ if(!db.contents.some(c=>String(c.id)===id && c.type==="series")) deleted.push(id); });
    writeJSON(SERIES_OVERRIDES_KEY, overrides);
    writeJSON(SERIES_ADDED_KEY, added);
    writeJSON(SERIES_DELETED_KEY, [...new Set(deleted)]);
  }
  function mergeStaticSeries(data){
    const staticList=staticSeriesCatalog();
    const overrides=loadSeriesOverrides();
    const deleted=loadSeriesDeleted();
    const added=loadSeriesAdded();
    const movies=data.contents.filter(c=>c.type!=="series");
    const currentSeries=data.contents.filter(c=>c.type==="series");
    const currentMap=new Map(currentSeries.map(c=>[String(c.id),c]));
    const merged=[];
    staticList.forEach(src=>{
      const id=String(src.id); if(deleted.has(id)) return;
      const item=overrides[id] || currentMap.get(id) || src;
      merged.push(clone(item));
    });
    added.forEach(src=>{ if(src && src.id && !deleted.has(String(src.id)) && !merged.some(c=>String(c.id)===String(src.id))) merged.push(normalize(clone(src))); });
    currentSeries.forEach(src=>{ if(src && src.id && !merged.some(c=>String(c.id)===String(src.id)) && !deleted.has(String(src.id))) merged.push(normalize(clone(src))); });
    data.contents=movies.concat(merged);
    return data;
  }
  function loadDB(){
    try {
      let raw=localStorage.getItem(DB_KEY);
      if(!raw){ for(const key of LEGACY_KEYS){ raw=localStorage.getItem(key); if(raw) break; } }
      const data=normalize(JSON.parse(raw||"{}"));
      const savedAccounts=readJSON(ACCOUNTS_KEY, null);
      if(Array.isArray(savedAccounts)) data.accounts=savedAccounts;
      normalize(data);
      mergeStaticSeries(data);
      return normalize(data);
    } catch(e){ return mergeStaticSeries(normalize({contents:[],favorites:[],history:[],accounts:[],releases:[]})); }
  }
  function saveAccounts(){ return writeJSON(ACCOUNTS_KEY, db.accounts); }
  function saveDB(){
    saveAccounts();
    const seriesIds=new Set(staticSeriesCatalog().map(x=>String(x.id)));
    const persistable={...db, contents:db.contents.filter(c=>c.type!=="series" || !seriesIds.has(String(c.id))) };
    const ok=writeJSON(DB_KEY, persistable);
    saveSeriesStore();
    return ok;
  }
  function uid(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function toast(msg){ const el=$("#adminToast"); el.textContent=msg; el.classList.add("show"); clearTimeout(window.__toast); window.__toast=setTimeout(()=>el.classList.remove("show"),2400); }
  function adminSessionId(){ return sessionStorage.getItem(ADMIN_SESSION_KEY) || localStorage.getItem(ADMIN_SESSION_KEY) || ""; }
  function logged(){
    const id=adminSessionId();
    return !!id && db.accounts.some(a=>a.id===id && a.role==="admin");
  }
  function logout(){
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_SESSION_KEY);
    location.href="login.html";
  }

  // Não existe mais uma segunda tela de login. O acesso ao painel só é liberado
  // depois que o administrador entra pela tela de login do site principal.
  function render(){
    if(logged()) renderPanel();
    else location.href="login.html";
  }

  function renderPanel(){
    db=loadDB();
    $("#adminApp").innerHTML=`
      <header class="topbar">
        <div class="top-brand">STREAMDRIVE<span>ADMIN</span></div>
        <div class="admin-name">Painel separado do site principal</div>
        <div class="top-actions"><button class="btn btn-dark btn-sm" id="refreshBtn">Atualizar dados</button><button class="btn btn-red btn-sm" id="logoutBtn">Sair</button></div>
      </header>
      <div class="layout">
        <aside class="sidebar">
          <div class="side-title">Gerenciamento</div>
          ${side("dashboard","Painel inicial")}
          ${side("movies","Filmes")}
          ${side("series","Séries")}
          ${side("releases","Lançamentos recentes")}
          ${side("categories","Categorias")}
          ${side("users","Usuários e administradores")}
          ${side("notifications","Notificações")}
          ${side("backup","Backup / dados")}
        </aside>
        <main class="main" id="adminMain"></main>
      </div>`;
    $("#logoutBtn").onclick=logout;
    $("#refreshBtn").onclick=()=>{db=loadDB(); renderPanel(); toast("Dados atualizados.");};
    document.querySelectorAll(".side-btn").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.editingId=null;renderPanel();});
    renderView();
  }
  function side(view,label){ return `<button class="side-btn ${state.view===view?"active":""}" data-view="${view}">${label}</button>`; }
  function renderView(){
    const root=$("#adminMain");
    // Quando um item foi selecionado para edição, mostrar o formulário em vez
    // de redesenhar a lista. Antes, o clique em "Editar" apenas preenchia
    // state.editingId e renderPanel() voltava a montar a lista, fazendo parecer
    // que o botão não funcionava.
    if(state.editingId && (state.view==="movies" || state.view==="series")){
      const type=state.view==="series" ? "series" : "movie";
      root.innerHTML=contentForm(type,state.editingId);
      bindView();
      return;
    }
    if(state.view==="dashboard") root.innerHTML=dashboard();
    if(state.view==="movies") root.innerHTML=contentList("movie");
    if(state.view==="series") root.innerHTML=contentList("series");
    if(state.view==="releases") root.innerHTML=releasesView();
    if(state.view==="categories") root.innerHTML=categoriesView();
    if(state.view==="users") root.innerHTML=usersView();
    if(state.view==="notifications") root.innerHTML=notificationsView();
    if(state.view==="backup") root.innerHTML=backupView();
    bindView();
  }

  function dashboard(){
    const movies=db.contents.filter(c=>c.type==="movie").length, series=db.contents.filter(c=>c.type==="series").length;
    const seasons=db.contents.filter(c=>c.type==="series").reduce((n,s)=>n+(s.seasons?.length||0),0);
    const episodes=db.contents.filter(c=>c.type==="series").reduce((n,s)=>n+(s.seasons||[]).reduce((a,x)=>a+(x.episodes?.length||0),0),0);
    return `<div class="page-head"><div><h1>Painel administrativo</h1><p>Gerencie o catálogo sem modificar os arquivos do site principal.</p></div><button class="btn btn-red" data-action="new-movie">+ Novo filme</button></div>
      <div class="stats"><div class="stat"><b>${movies}</b><span>Filmes</span></div><div class="stat"><b>${series}</b><span>Séries</span></div><div class="stat"><b>${seasons}</b><span>Temporadas</span></div><div class="stat"><b>${episodes}</b><span>Episódios</span></div></div>
      <div class="panel"><h2>Mecânica disponível</h2><p class="note">Filmes: adicionar, editar, excluir, nome, categoria, ano, classificação, sinopse, capa e link do vídeo.</p><p class="note">Séries: adicionar, editar e excluir séries; criar/excluir temporadas; criar/editar/excluir episódios; definir número, nome, sinopse e link de reprodução de cada episódio.</p><p class="note">As alterações são gravadas no armazenamento do navegador usado pelo site. Para funcionar entre páginas publicadas, abra o painel e o site no mesmo domínio.</p></div>`;
  }

  function contentList(type){
    const isSeries=type==="series";
    let arr=db.contents.filter(c=>c.type===type);
    const q=state.search.toLowerCase();
    if(q) arr=arr.filter(c=>`${c.title} ${c.category} ${c.year}`.toLowerCase().includes(q));
    if(state.category!=="all") arr=arr.filter(c=>c.category===state.category);
    arr.sort((a,b)=>String(a.title).localeCompare(String(b.title),"pt-BR"));
    const restoredCats=(type==="series" && typeof restoredSeriesCategories!=="undefined" && Array.isArray(restoredSeriesCategories))?restoredSeriesCategories:[];
    const cats=[...new Set(db.contents.filter(c=>c.type===type).map(c=>c.category).filter(Boolean).concat(restoredCats))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
    return `<div class="page-head"><div><h1>${isSeries?"Séries":"Filmes"}</h1><p>${arr.length} item(ns) encontrado(s).</p></div><button class="btn btn-red" data-action="new-${type}">+ Adicionar ${isSeries?"série":"filme"}</button></div>
      <div class="toolbar"><input id="searchBox" value="${esc(state.search)}" placeholder="Pesquisar por nome, categoria ou ano..."><select id="categoryFilter"><option value="all">Todas as categorias</option>${cats.map(c=>`<option ${state.category===c?"selected":""}>${esc(c)}</option>`).join("")}</select></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Capa</th><th>Nome</th><th>Categoria</th><th>Ano</th><th>${isSeries?"Temporadas":"Link"}</th><th>Ações</th></tr></thead><tbody>
      ${arr.length?arr.map(c=>`<tr><td><img class="poster-mini" src="${esc(c.poster||"")}" onerror="this.style.visibility='hidden'" alt=""></td><td class="title-cell">${esc(c.title)}</td><td><span class="badge">${esc(c.category||"-")}</span></td><td>${esc(c.year||"-")}</td><td>${isSeries?`<span class="badge blue">${c.seasons?.length||0}</span>`:`${c.drive?'<span class="badge green">Vídeo</span>':'<span class="badge">Sem link</span>'}`}</td><td class="actions"><button class="btn btn-dark btn-sm" data-edit="${esc(c.id)}">Editar</button><button class="btn btn-danger btn-sm" data-delete="${esc(c.id)}">Excluir</button></td></tr>`).join(""): `<tr><td colspan="6" class="empty">Nenhum item encontrado.</td></tr>`}
      </tbody></table></div>`;
  }

  function contentForm(type,id=null){
    const item=id?db.contents.find(c=>c.id===id):null;
    const isSeries=type==="series";
    const title=item?`Editar ${isSeries?"série":"filme"}`:`Novo ${isSeries?"série":"filme"}`;
    return `<div class="page-head"><div><h1>${title}</h1><p>Preencha os dados que aparecerão no catálogo.</p></div><button class="btn btn-dark" data-action="back-list">Voltar</button></div>
      <form id="contentForm" data-type="${type}" data-id="${esc(id||"")}" class="panel"><div class="form-grid">
      <div class="field"><label>Nome do ${isSeries?"série":"filme"}</label><input name="title" required value="${esc(item?.title||"")}"></div>
      <div class="field"><label>Categoria</label><input name="category" required value="${esc(item?.category||"")}" placeholder="Ex.: Ação, Comédia, Drama"></div>
      <div class="field"><label>Ano de lançamento</label><input name="year" type="number" min="1888" max="2100" value="${esc(item?.year||"")}"></div>
      <div class="field"><label>Classificação</label><input name="rating" value="${esc(item?.rating||"")}" placeholder="Ex.: 12, 14, 16, 18, L"></div>
      <div class="field full"><label>Sinopse</label><textarea name="synopsis" placeholder="Digite a sinopse...">${esc(item?.synopsis||"")}</textarea></div>
      <div class="field"><label>URL da capa</label><input name="poster" value="${esc(item?.poster||"")}" placeholder="https://..."></div>
      ${isSeries?"":`<div class="field"><label>Link do vídeo</label><input name="drive" value="${esc(item?.drive||"")}" placeholder="https://..."></div>`}
      </div><div class="form-actions"><button type="button" class="btn btn-dark" data-action="back-list">Cancelar</button><button class="btn btn-red">Salvar</button></div></form>
      ${isSeries&&item?seriesManager(item):""}`;
  }

  function seriesManager(series){
    return `<div class="panel"><div class="panel-head"><div><h2>Temporadas e episódios</h2><div class="note">Crie temporadas e depois cadastre os episódios de cada uma.</div></div><button class="btn btn-red btn-sm" data-add-season="${esc(series.id)}">+ Nova temporada</button></div><div class="season-list">
      ${(series.seasons||[]).map(s=>`<section class="season"><div class="season-head"><strong>Temporada ${s.number}</strong><span class="badge">${s.episodes?.length||0} episódio(s)</span><button class="btn btn-danger btn-sm" data-delete-season="${esc(series.id)}" data-season="${s.number}">Excluir temporada</button><button class="btn btn-dark btn-sm" data-add-episode="${esc(series.id)}" data-season="${s.number}">+ Episódio</button></div><div class="episode-list">
      ${(s.episodes||[]).map(e=>`<div class="episode"><div class="episode-number">EP ${e.number}</div><div><div class="episode-title">${esc(e.title)}</div><div class="muted">${esc(e.synopsis||"Sem sinopse")}</div></div><div class="episode-actions"><button class="btn btn-dark btn-sm" data-edit-episode="${esc(series.id)}" data-season="${s.number}" data-episode="${esc(e.id)}">Editar</button><button class="btn btn-danger btn-sm" data-delete-episode="${esc(series.id)}" data-season="${s.number}" data-episode="${esc(e.id)}">Excluir</button></div></div>`).join("")||'<div class="empty">Nenhum episódio nesta temporada.</div>'}
      </div></section>`).join("")||'<div class="empty">Nenhuma temporada cadastrada.</div>'}
    </div></div>`;
  }

  function releasesView(){
    const arr=[...(db.releases||[])].sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0));
    return `<div class="page-head"><div><h1>Lançamentos recentes</h1><p>Cadastre os títulos que aparecerão na seção “Lançamentos em breve” da página inicial.</p></div><button class="btn btn-red" id="newReleaseBtn">+ Novo lançamento</button></div>
      <div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Capa</th><th>Nome</th><th>Categoria</th><th>Lançamento</th><th>Ações</th></tr></thead><tbody>${arr.length?arr.map(r=>`<tr><td><img class="poster-mini" src="${esc(r.poster||"")}" onerror="this.style.visibility='hidden'" alt=""></td><td class="title-cell">${esc(r.title)}</td><td><span class="badge">${esc(r.category||"Lançamento recente")}</span></td><td>${esc(r.releaseDate||"-")}</td><td class="actions"><button class="btn btn-dark btn-sm" data-release-edit="${esc(r.id)}">Editar</button><button class="btn btn-danger btn-sm" data-release-delete="${esc(r.id)}">Excluir</button></td></tr>`).join(""):`<tr><td colspan="5" class="empty">Nenhum lançamento cadastrado.</td></tr>`}</tbody></table></div></div>`;
  }
  function releaseDialog(id=null){
    const r=id?(db.releases||[]).find(x=>x.id===id):null;
    const html=`<div style="position:fixed;inset:0;background:#000b;display:grid;place-items:center;padding:20px;z-index:200" id="releaseOverlay"><div class="panel" style="width:min(720px,100%);max-height:90vh;overflow:auto"><div class="panel-head"><div><h2>${r?"Editar lançamento":"Novo lançamento"}</h2><div class="note">Esses dados serão exibidos na Home em “Lançamentos em breve”.</div></div><button class="btn btn-dark btn-sm" id="releaseClose">Fechar</button></div><form id="releaseForm"><div class="form-grid"><div class="field"><label>Nome</label><input name="title" required value="${esc(r?.title||"")}" placeholder="Nome do filme ou série"></div><div class="field"><label>Categoria</label><input name="category" required value="${esc(r?.category||"Lançamento recente")}" placeholder="Ex.: Ação, Drama, Animação"></div><div class="field"><label>Data de lançamento</label><input name="releaseDate" type="date" value="${esc(r?.releaseDate||"")}"></div><div class="field full"><label>URL da miniatura</label><input name="poster" value="${esc(r?.poster||"")}" placeholder="https://..."></div><div class="field full"><label>Sinopse</label><textarea name="synopsis" rows="5" placeholder="Digite a sinopse...">${esc(r?.synopsis||"")}</textarea></div></div><div class="form-actions"><button type="button" class="btn btn-dark" id="releaseCancel">Cancelar</button><button class="btn btn-red">Salvar lançamento</button></div></form></div></div>`;
    document.body.insertAdjacentHTML("beforeend",html);
    $("#releaseClose").onclick=$("#releaseCancel").onclick=()=>$("#releaseOverlay")?.remove();
    $("#releaseForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const data={title:String(f.get("title")||"").trim(),category:String(f.get("category")||"").trim(),poster:String(f.get("poster")||"").trim(),synopsis:String(f.get("synopsis")||"").trim(),releaseDate:String(f.get("releaseDate")||"").trim()};if(!data.title||!data.category)return toast("Preencha nome e categoria.");if(!Array.isArray(db.releases))db.releases=[];if(r)Object.assign(r,data);else db.releases.push({...data,id:uid("rel"),createdAt:Date.now()});saveDB();$("#releaseOverlay")?.remove();toast("Lançamento salvo.");renderPanel();};
  }
  function deleteRelease(id){const r=(db.releases||[]).find(x=>x.id===id);if(!r)return;if(!confirm(`Excluir o lançamento “${r.title}”?`))return;db.releases=db.releases.filter(x=>x.id!==id);saveDB();toast("Lançamento excluído.");renderPanel();}

  function categoriesView(){
    const cats={}; db.contents.forEach(c=>{const k=c.category||"Sem categoria";cats[k]=(cats[k]||0)+1});
    if(typeof restoredSeriesCategories!=="undefined" && Array.isArray(restoredSeriesCategories)) restoredSeriesCategories.forEach(k=>{if(!(k in cats))cats[k]=0});
    return `<div class="page-head"><div><h1>Categorias</h1><p>Visão geral das categorias usadas no catálogo. As categorias de séries também aparecem mesmo quando estão sem itens cadastrados.</p></div></div><div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Categoria</th><th>Itens</th><th>Tipo</th></tr></thead><tbody>${Object.keys(cats).sort((a,b)=>a.localeCompare(b,"pt-BR")).map(k=>`<tr><td class="title-cell">${esc(k)}</td><td>${cats[k]}</td><td>${db.contents.filter(c=>c.category===k&&c.type==="movie").length} filme(s) • ${db.contents.filter(c=>c.category===k&&c.type==="series").length} série(s)</td></tr>`).join("")||'<tr><td colspan="3" class="empty">Nenhuma categoria.</td></tr>'}</tbody></table></div></div>`;
  }

  function usersView(){
    const users=db.accounts.filter(a=>a.role!=="admin");
    const admins=db.accounts.filter(a=>a.role==="admin");
    const accountRows=(arr,role)=>arr.length?arr.map(a=>`<tr>
      <td class="title-cell">${esc(a.username)}</td>
      <td>${esc(a.name||"-")}<div class="muted">${esc(a.email||"-")}</div></td>
      <td><code class="password-cell">${esc(a.password||"")}</code></td>
      <td><span class="badge ${role==="admin"?"red":"blue"}">${role==="admin"?"Administrador":"Usuário"}</span></td>
      <td class="actions"><button class="btn btn-dark btn-sm" data-account-edit="${esc(a.id)}">Modificar</button><button class="btn btn-danger btn-sm" data-account-delete="${esc(a.id)}">Excluir</button></td>
    </tr>`).join(""):`<tr><td colspan="5" class="empty">Nenhum ${role==="admin"?"administrador":"usuário"} cadastrado.</td></tr>`;
    return `<div class="page-head"><div><h1>Usuários e administradores</h1><p>Gerencie usuário, senha e contas administrativas sem alterar a interface do restante do painel.</p></div>
      <div class="actions"><button class="btn btn-dark" data-new-account="user">+ Novo usuário</button><button class="btn btn-red" data-new-account="admin">+ Novo administrador</button></div></div>
      <div class="panel"><div class="panel-head"><div><h2>Usuários</h2><div class="note">Acesso normal ao site.</div></div><span class="badge blue">${users.length}</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Usuário</th><th>Nome / e-mail</th><th>Senha</th><th>Tipo</th><th>Ações</th></tr></thead><tbody>${accountRows(users,"user")}</tbody></table></div></div>
      <div class="panel"><div class="panel-head"><div><h2>Administradores</h2><div class="note">Entram pela mesma tela de login e são enviados ao painel administrativo.</div></div><span class="badge red">${admins.length}</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Usuário</th><th>Nome / e-mail</th><th>Senha</th><th>Tipo</th><th>Ações</th></tr></thead><tbody>${accountRows(admins,"admin")}</tbody></table></div></div>
      <div class="panel"><h2>Credenciais para teste</h2><p class="note">As credenciais atuais também são exibidas na tela de login. Se você alterar aqui, a tela de login mostrará os novos dados.</p></div>`;
  }

  function notificationsView(){
    const users=db.accounts.filter(a=>a.role!=="admin");
    const sent=users.flatMap(u=>(u.notifications||[]).map(n=>({u,n}))).sort((a,b)=>(Number(b.n.createdAt)||0)-(Number(a.n.createdAt)||0));
    const rows=sent.length?sent.map(({u,n})=>`<tr>
      <td class="title-cell">${esc(u.username)}</td>
      <td>${esc(u.name||"Usuário")}</td>
      <td>${esc(n.title||"Mensagem")}</td>
      <td>${esc(n.message||"")}</td>
      <td>${n.createdAt?new Date(n.createdAt).toLocaleString("pt-BR"):"-"}</td>
      <td class="actions"><button class="btn btn-danger btn-sm" data-notification-delete="${esc(u.id)}" data-notification-id="${esc(n.id)}">Excluir</button></td>
    </tr>`).join(""): `<tr><td colspan="6" class="empty">Nenhuma mensagem enviada.</td></tr>`;
    return `<div class="page-head"><div><h1>Notificações</h1><p>Envie uma mensagem individual para um usuário. Ela aparecerá no sino de notificações da conta escolhida.</p></div><button class="btn btn-red" id="newNotificationBtn">+ Enviar mensagem</button></div>
      <div class="panel"><div class="panel-head"><div><h2>Mensagens enviadas</h2><div class="note">Cada mensagem é armazenada na conta do usuário selecionado.</div></div><span class="badge red">${sent.length}</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Usuário</th><th>Nome</th><th>Título</th><th>Mensagem</th><th>Data</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  function notificationDialog(){
    const users=db.accounts.filter(a=>a.role!=="admin");
    if(!users.length)return toast("Cadastre um usuário antes de enviar uma mensagem.");
    const html=`<div style="position:fixed;inset:0;background:#000b;display:grid;place-items:center;padding:20px;z-index:200" id="notificationOverlay"><div class="panel" style="width:min(720px,100%);max-height:90vh;overflow:auto">
      <div class="panel-head"><div><h2>Enviar notificação</h2><div class="note">A mensagem será enviada somente para o usuário escolhido.</div></div><button class="btn btn-dark btn-sm" id="notificationClose">Fechar</button></div>
      <form id="notificationForm"><div class="form-grid">
      <div class="field" style="grid-column:1/-1"><label>Usuário destinatário</label><select name="userId" required>${users.map(u=>`<option value="${esc(u.id)}">${esc(u.username)} — ${esc(u.name||"")}</option>`).join("")}</select></div>
      <div class="field" style="grid-column:1/-1"><label>Título</label><input name="title" maxlength="80" required placeholder="Ex.: Novidade no catálogo"></div>
      <div class="field" style="grid-column:1/-1"><label>Mensagem</label><textarea name="message" rows="6" maxlength="1000" required placeholder="Escreva a mensagem para este usuário..."></textarea></div>
      </div><div class="form-actions"><button type="button" class="btn btn-dark" id="notificationCancel">Cancelar</button><button class="btn btn-red">Enviar mensagem</button></div></form></div></div>`;
    document.body.insertAdjacentHTML("beforeend",html);
    $("#notificationClose").onclick=$("#notificationCancel").onclick=()=>$("#notificationOverlay")?.remove();
    $("#notificationForm").onsubmit=e=>{
      e.preventDefault(); const f=new FormData(e.target); const user=db.accounts.find(a=>a.id===String(f.get("userId"))); if(!user)return toast("Usuário não encontrado.");
      user.notifications=Array.isArray(user.notifications)?user.notifications:[];
      user.notifications.unshift({id:uid("n"),title:String(f.get("title")||"").trim(),message:String(f.get("message")||"").trim(),createdAt:Date.now()});
      saveDB(); $("#notificationOverlay")?.remove(); toast(`Mensagem enviada para ${user.username}.`); renderPanel();
    };
  }

  function deleteNotification(userId,notificationId){
    const user=db.accounts.find(x=>x.id===userId); if(!user)return;
    user.notifications=Array.isArray(user.notifications)?user.notifications:[];
    user.notifications=user.notifications.filter(n=>n.id!==notificationId);
    saveDB(); toast("Notificação excluída."); renderPanel();
  }

  function accountDialog(role,id=null){
    const a=id?db.accounts.find(x=>x.id===id):null;
    if(id&&!a)return;
    const isAdmin=role==="admin";
    const html=`<div style="position:fixed;inset:0;background:#000b;display:grid;place-items:center;padding:20px;z-index:200" id="accountOverlay"><div class="panel" style="width:min(720px,100%);max-height:90vh;overflow:auto">
      <div class="panel-head"><div><h2>${a?"Modificar":"Criar"} ${isAdmin?"administrador":"usuário"}</h2><div class="note">Defina o usuário e a senha usados na tela de login.</div></div><button class="btn btn-dark btn-sm" id="accountClose">Fechar</button></div>
      <form id="accountForm"><input type="hidden" name="id" value="${esc(id||"")}"><input type="hidden" name="role" value="${isAdmin?"admin":"user"}"><div class="form-grid">
      <div class="field"><label>Usuário de login</label><input name="username" required value="${esc(a?.username||"")}" placeholder="Ex.: usuario01"></div>
      <div class="field"><label>Senha</label><input name="password" type="text" minlength="4" required value="${esc(a?.password||"")}"></div>
      <div class="field"><label>Nome</label><input name="name" required value="${esc(a?.name||"")}"></div>
      <div class="field"><label>E-mail</label><input name="email" type="email" value="${esc(a?.email||"")}"></div>
      </div><div class="form-actions"><button type="button" class="btn btn-dark" id="accountCancel">Cancelar</button><button class="btn ${isAdmin?"btn-red":"btn-blue"}">Salvar</button></div></form></div></div>`;
    document.body.insertAdjacentHTML("beforeend",html);
    $("#accountClose").onclick=$("#accountCancel").onclick=()=>$("#accountOverlay")?.remove();
    $("#accountForm").onsubmit=e=>{
      e.preventDefault(); const f=new FormData(e.target); const username=String(f.get("username")||"").trim().toLowerCase(); const password=String(f.get("password")||""); const name=String(f.get("name")||"").trim(); const email=String(f.get("email")||"").trim().toLowerCase();
      if(username.length<3)return toast("O usuário precisa ter pelo menos 3 caracteres.");
      if(password.length<4)return toast("A senha precisa ter pelo menos 4 caracteres.");
      if(!name)return toast("Informe o nome.");
      const duplicate=db.accounts.find(x=>x.username.toLowerCase()===username && x.id!==id); if(duplicate)return toast("Esse usuário já existe.");
      if(email && db.accounts.some(x=>x.email && x.email.toLowerCase()===email && x.id!==id))return toast("Esse e-mail já está cadastrado.");
      if(a){a.username=username;a.password=password;a.name=name;a.email=email;a.role=isAdmin?"admin":"user";}
      else {db.accounts.push({id:uid("a"),username,password,name,email,role:isAdmin?"admin":"user",profiles:[{id:uid("p"),name,avatar:"A"}]});}
      saveDB(); $("#accountOverlay")?.remove(); toast(isAdmin?"Administrador salvo.":"Usuário salvo."); renderPanel();
    };
  }

  function deleteAccount(id){
    const a=db.accounts.find(x=>x.id===id); if(!a)return;
    if(a.role==="admin" && db.accounts.filter(x=>x.role==="admin").length<=1)return toast("Não é possível excluir o último administrador.");
    if(!confirm(`Excluir a conta “${a.username}”?`))return;
    const current=adminSessionId(); db.accounts=db.accounts.filter(x=>x.id!==id); saveDB();
    if(id===current){sessionStorage.removeItem(ADMIN_SESSION_KEY);localStorage.removeItem(ADMIN_SESSION_KEY);return location.href="login.html";}
    toast("Conta excluída."); renderPanel();
  }

  function backupView(){
    return `<div class="page-head"><div><h1>Backup / dados</h1><p>Exporte o catálogo antes de fazer alterações grandes.</p></div></div>
      <div class="panel"><h2>Exportar catálogo</h2><p class="note">Baixa um arquivo JSON com filmes, séries, temporadas e episódios.</p><button class="btn btn-blue" id="exportBtn">Exportar JSON</button></div>
      <div class="panel"><h2>Importar catálogo</h2><p class="note">A importação substitui o catálogo atual. Faça um backup antes.</p><input id="importFile" type="file" accept="application/json,.json"><div style="margin-top:12px"><button class="btn btn-danger" id="importBtn">Importar e substituir</button></div></div>
      <div class="panel danger-zone"><h3>Restaurar catálogo vazio</h3><p class="note">Remove todos os filmes e séries do catálogo local deste domínio. Não altera os arquivos HTML/CSS/JS do site principal.</p><button class="btn btn-danger" id="clearCatalog">Excluir todo o catálogo</button></div>`;
  }

  function bindView(){
    document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{
      const a=b.dataset.action;
      if(a==="new-movie"){state.view="movies";state.editingId="new";renderPanel();}
      if(a==="new-series"){state.view="series";state.editingId="new";renderPanel();}
      if(a==="back-list"){state.editingId=null;renderPanel();}
    });
    const search=$("#searchBox"); if(search){search.oninput=e=>{state.search=e.target.value; const type=state.view==="movies"?"movie":"series"; $("#adminMain").innerHTML=contentList(type); bindView();};}
    const cat=$("#categoryFilter"); if(cat){cat.onchange=e=>{state.category=e.target.value; renderView();};}
    document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{
      const id=String(b.dataset.edit||"");
      const item=db.contents.find(c=>String(c.id)===id);
      if(!item) return toast("Item não encontrado no catálogo.");
      state.view=item.type==="series" ? "series" : "movies";
      state.editingId=item.id;
      renderPanel();
    });
    document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteContent(b.dataset.delete));
    const form=$("#contentForm"); if(form) form.onsubmit=saveContent;
    if($("#newReleaseBtn")) $("#newReleaseBtn").onclick=()=>releaseDialog();
    document.querySelectorAll("[data-release-edit]").forEach(b=>b.onclick=()=>releaseDialog(b.dataset.releaseEdit));
    document.querySelectorAll("[data-release-delete]").forEach(b=>b.onclick=()=>deleteRelease(b.dataset.releaseDelete));
    document.querySelectorAll("[data-add-season]").forEach(b=>b.onclick=()=>addSeason(b.dataset.addSeason));
    document.querySelectorAll("[data-delete-season]").forEach(b=>b.onclick=()=>deleteSeason(b.dataset.deleteSeason,Number(b.dataset.season)));
    document.querySelectorAll("[data-add-episode]").forEach(b=>b.onclick=()=>episodeDialog(b.dataset.addEpisode,Number(b.dataset.season),null));
    document.querySelectorAll("[data-edit-episode]").forEach(b=>b.onclick=()=>episodeDialog(b.dataset.editEpisode,Number(b.dataset.season),b.dataset.episode));
    document.querySelectorAll("[data-delete-episode]").forEach(b=>b.onclick=()=>deleteEpisode(b.dataset.deleteEpisode,Number(b.dataset.season),b.dataset.episode));
    if($("#newNotificationBtn")) $("#newNotificationBtn").onclick=notificationDialog;
    document.querySelectorAll("[data-notification-delete]").forEach(b=>b.onclick=()=>deleteNotification(b.dataset.notificationDelete,b.dataset.notificationId));
    if($("#exportBtn")) $("#exportBtn").onclick=exportJSON;
    if($("#importBtn")) $("#importBtn").onclick=importJSON;
    if($("#clearCatalog")) $("#clearCatalog").onclick=clearCatalog;
    document.querySelectorAll("[data-new-account]").forEach(b=>b.onclick=()=>accountDialog(b.dataset.newAccount));
    document.querySelectorAll("[data-account-edit]").forEach(b=>b.onclick=()=>{const a=db.accounts.find(x=>x.id===b.dataset.accountEdit);if(a)accountDialog(a.role,a.id);});
    document.querySelectorAll("[data-account-delete]").forEach(b=>b.onclick=()=>deleteAccount(b.dataset.accountDelete));
  }

  function saveContent(e){
    e.preventDefault();
    const form=e.target;
    const f=new FormData(form);
    const type=form.dataset.type === "series" ? "series" : "movie";
    const rawId=String(form.dataset.id||"").trim();
    const isNew=!rawId || rawId==="new";
    const data={
      title:String(f.get("title")||"").trim(),
      category:String(f.get("category")||"").trim(),
      year:String(f.get("year")||"").trim(),
      rating:String(f.get("rating")||"").trim(),
      synopsis:String(f.get("synopsis")||"").trim(),
      poster:String(f.get("poster")||"").trim()
    };
    if(!data.title||!data.category) return toast("Preencha nome e categoria.");
    if(type==="movie") data.drive=String(f.get("drive")||"").trim();

    if(!isNew){
      const item=db.contents.find(c=>String(c.id)===rawId && c.type===type);
      if(!item) return toast(type==="series" ? "Série não encontrada no catálogo." : "Filme não encontrado no catálogo.");
      Object.assign(item,data);
      state.editingId=item.id;
    }else{
      data.id=uid(type==="series"?"s":"m");
      data.type=type;
      if(type==="series") data.seasons=[];
      db.contents.push(data);
      state.editingId=data.id;
    }

    // Séries importadas são armazenadas separadamente para preservar o catálogo
    // original. Filmes e demais dados continuam no catálogo principal.
    if(type==="series"){
      saveSeriesStore();
      // Atualiza também o objeto em memória após a persistência, evitando que
      // uma nova renderização perca a edição feita no formulário.
      db=mergeStaticSeries(db);
    }else{
      saveDB();
    }
    toast("Salvo com sucesso.");
    state.editingId=null;
    renderPanel();
  }

  function deleteContent(id){
    const c=db.contents.find(x=>x.id===id); if(!c)return;
    if(!confirm(`Excluir definitivamente “${c.title}”?`))return;
    db.contents=db.contents.filter(x=>x.id!==id); db.favorites=db.favorites.filter(x=>x!==id); db.history=db.history.filter(x=>x.contentId!==id&&x.id!==id);
    if(c.type==="series") saveSeriesStore(); else saveDB();
    toast("Item excluído."); renderPanel();
  }
  function addSeason(id){
    const c=db.contents.find(x=>x.id===id);if(!c)return;
    const nums=(c.seasons||[]).map(s=>Number(s.number)); const n=nums.length?Math.max(...nums)+1:1;
    c.seasons.push({number:n,episodes:[]}); c.seasons.sort((a,b)=>a.number-b.number); saveSeriesStore(); toast(`Temporada ${n} criada.`); renderPanel();
  }
  function deleteSeason(id,n){
    const c=db.contents.find(x=>x.id===id);if(!c)return;
    if(!confirm(`Excluir a Temporada ${n} e todos os episódios dela?`))return;
    c.seasons=c.seasons.filter(s=>Number(s.number)!==n);saveSeriesStore();toast("Temporada excluída.");renderPanel();
  }
  function episodeDialog(seriesId,seasonNumber,episodeId){
    const c=db.contents.find(x=>x.id===seriesId), s=c?.seasons?.find(x=>Number(x.number)===seasonNumber), e=s?.episodes?.find(x=>x.id===episodeId);
    if(!c||!s)return;
    const next=(s.episodes||[]).reduce((m,x)=>Math.max(m,Number(x.number)||0),0)+1;
    const html=`<div style="position:fixed;inset:0;background:#000b;display:grid;place-items:center;padding:20px;z-index:200" id="epOverlay"><div class="panel" style="width:min(700px,100%);max-height:90vh;overflow:auto"><div class="panel-head"><h2>${e?"Editar episódio":"Novo episódio"}</h2><button class="btn btn-dark btn-sm" id="epClose">Fechar</button></div><form id="episodeForm"><div class="form-grid"><div class="field"><label>Número do episódio</label><input name="number" type="number" min="1" value="${esc(e?.number??next)}" required></div><div class="field"><label>Nome do episódio</label><input name="title" value="${esc(e?.title||"")}" required></div><div class="field full"><label>Sinopse do episódio</label><textarea name="synopsis">${esc(e?.synopsis||"")}</textarea></div><div class="field full"><label>Link do vídeo do episódio</label><input name="drive" value="${esc(e?.drive||"")}" placeholder="https://..."></div></div><div class="form-actions"><button type="button" class="btn btn-dark" id="epCancel">Cancelar</button><button class="btn btn-red">Salvar episódio</button></div></form></div></div>`;
    document.body.insertAdjacentHTML("beforeend",html);
    $("#epClose").onclick=$("#epCancel").onclick=()=>$("#epOverlay")?.remove();
    $("#episodeForm").onsubmit=ev=>{
      ev.preventDefault();const f=new FormData(ev.target);const data={number:Number(f.get("number"))||next,title:String(f.get("title")||"").trim(),synopsis:String(f.get("synopsis")||"").trim(),drive:String(f.get("drive")||"").trim()};
      if(!data.title)return toast("Informe o nome do episódio.");
      if(e)Object.assign(e,data);else s.episodes.push({...data,id:uid("ep")});
      s.episodes.sort((a,b)=>a.number-b.number);saveSeriesStore();$("#epOverlay")?.remove();toast("Episódio salvo.");renderPanel();
    };
  }
  function deleteEpisode(seriesId,seasonNumber,episodeId){
    const c=db.contents.find(x=>x.id===seriesId),s=c?.seasons?.find(x=>Number(x.number)===seasonNumber);if(!s)return;
    const e=s.episodes.find(x=>x.id===episodeId);if(!e)return;
    if(!confirm(`Excluir o episódio “${e.title}”?`))return;s.episodes=s.episodes.filter(x=>x.id!==episodeId);saveSeriesStore();toast("Episódio excluído.");renderPanel();
  }

  function exportJSON(){
    const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`streamdrive-catalogo-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);toast("Backup exportado.");
  }
  function importJSON(){
    const file=$("#importFile")?.files?.[0];if(!file)return toast("Selecione um arquivo JSON.");
    if(!confirm("Isso substituirá o catálogo atual. Continuar?"))return;
    const r=new FileReader();r.onload=()=>{try{const incoming=normalize(JSON.parse(r.result));db=loadDB();db.contents=incoming.contents;saveDB();toast("Catálogo importado.");renderPanel();}catch(e){toast("Arquivo JSON inválido.");}};r.readAsText(file);
  }
  function clearCatalog(){
    if(!confirm("ATENÇÃO: excluir todos os filmes, séries, temporadas e episódios?"))return;
    db.contents=[];db.favorites=[];db.history=[];saveDB();toast("Catálogo limpo.");renderPanel();
  }

  window.addEventListener("storage", e=>{if(e.key===DB_KEY){db=loadDB();if(logged()&&state.view!=="backup")renderPanel();}});
  render();
})();
