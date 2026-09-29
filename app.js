const KEY="streamdrive_catalog_v23";
const LEGACY_KEYS=["streamdrive_mobile_v22","streamdrive_local_v21"];
const ADMIN_SESSION_KEY="streamdrive_admin_session_v1";
const ACCOUNTS_KEY="streamdrive_accounts_v1";
const SERIES_OVERRIDES_KEY="streamdrive_series_overrides_v1";
const SERIES_ADDED_KEY="streamdrive_series_added_v1";
const SERIES_DELETED_KEY="streamdrive_series_deleted_v1";
const defaultData={
 accounts:[
  {id:"a1",name:"Administrador",username:"paineladmin",email:"admin@streamdrive.local",password:"Admin@2026",role:"admin",profiles:[{id:"p1",name:"Admin",avatar:"A"}]},
  {id:"a2",name:"teste6",username:"3030370teste",email:"usuario@streamdrive.local",password:"teste3030370",role:"user",profiles:[{id:"p2",name:"teste6",avatar:"T"}]}
 ],
 contents:[
  {id:"m1",type:"movie",title:"Aventura Espacial",category:"Ficção",year:2026,rating:"12",synopsis:"Uma aventura espacial criada como exemplo para você substituir pelos seus próprios filmes.",poster:"https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=700&q=80",drive:""},
  {id:"m2",type:"movie",title:"Noite na Cidade",category:"Ação",year:2025,rating:"14",synopsis:"Exemplo de filme no catálogo.",poster:"https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=700&q=80",drive:""},
 ],
 favorites:[],history:[],releases:[]
};
let db,session=null,currentProfile=null,currentFilter="all",currentCategory="all",searchText="",selectedSeriesId=null,selectedSeasonNumber=null,selectedEpisodeId=null;
let heroPreviewIndex=0;
let heroPreviewPool=[];
let heroPreviewPoolType="";
let playerReturnUrl="index.html";

function clone(v){return JSON.parse(JSON.stringify(v))}
function normalizeSearch(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}
function readLocalJSON(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch(e){return fallback}}
function applyAdminSeriesStore(data){
 const overrides=readLocalJSON(SERIES_OVERRIDES_KEY,{}), added=readLocalJSON(SERIES_ADDED_KEY,[]), deleted=new Set(readLocalJSON(SERIES_DELETED_KEY,[]));
 if(!overrides || typeof overrides!=="object") return data;
 data.contents=data.contents.filter(c=>c.type!=="series" || !deleted.has(String(c.id)));
 data.contents=data.contents.map(c=>{const o=overrides[String(c.id)]; return o&&c.type==="series"?clone(o):c;});
 const existing=new Set(data.contents.map(c=>String(c.id)));
 (Array.isArray(added)?added:[]).forEach(c=>{if(c&&c.id&&!deleted.has(String(c.id))&&!existing.has(String(c.id))){data.contents.push(clone(c));existing.add(String(c.id));}});
 return data;
}
function normalizeData(data){
 data=data&&typeof data==="object"?data:clone(defaultData);
 const savedAccounts=readLocalJSON(ACCOUNTS_KEY,null);
 if(Array.isArray(savedAccounts)) data.accounts=savedAccounts;
 data.accounts=Array.isArray(data.accounts)?data.accounts:[];
 data.accounts.forEach(a=>{
  a.id=a.id||("a"+Date.now()+Math.random().toString(36).slice(2,7));
  a.role=a.role==="admin"?"admin":"user";
  a.name=a.name||(a.role==="admin"?"Administrador":"Usuário");
  a.email=String(a.email||"").trim().toLowerCase();
  a.username=String(a.username||"").trim().toLowerCase();
  if(!a.username){const base=a.role==="admin"?"paineladmin":(a.email.split("@")[0]||"usuario");a.username=base.replace(/[^a-z0-9._-]/g,"")||(a.role==="admin"?"paineladmin":"usuario");}
  if(!a.password)a.password=a.role==="admin"?"Admin@2026":"123456";
  if(!Array.isArray(a.profiles))a.profiles=[];
  if(!Array.isArray(a.notifications))a.notifications=[];
 });
 const oldAdmin=data.accounts.find(a=>a.role==="admin"&&a.email==="admin@streamdrive.local");
 if(oldAdmin && (!oldAdmin.username || oldAdmin.username==="admin" || oldAdmin.password==="123456")){oldAdmin.username="paineladmin";oldAdmin.password="Admin@2026";}
 const oldUser=data.accounts.find(a=>a.role!=="admin"&&a.email==="usuario@streamdrive.local");
 if(oldUser){oldUser.name="teste6";oldUser.username="3030370teste";oldUser.email="usuario@streamdrive.local";oldUser.password="teste3030370";oldUser.profiles=Array.isArray(oldUser.profiles)&&oldUser.profiles.length?oldUser.profiles:[{id:"p2",name:"teste6",avatar:"T"}];}
 if(!data.accounts.some(a=>a.role==="admin"))data.accounts.push({id:"a"+Date.now(),name:"Administrador",username:"paineladmin",email:"admin@streamdrive.local",password:"Admin@2026",role:"admin",profiles:[{id:"padmin",name:"Admin",avatar:"A"}]});
 if(!data.accounts.some(a=>a.role!=="admin"))data.accounts.push({id:"a"+(Date.now()+1),name:"teste6",username:"3030370teste",email:"usuario@streamdrive.local",password:"teste3030370",role:"user",profiles:[{id:"puser",name:"teste6",avatar:"T"}]});
 data.contents=Array.isArray(data.contents)?data.contents:[];
 data.contents=data.contents.filter(c=>!((c.id==="s1"||c.id==="s2")&&c.type==="series"));
 // Importa as séries fornecidas separadamente sem remover o catálogo existente.
 const importedSeries=[];
 if(typeof seriesCatalog!=="undefined" && Array.isArray(seriesCatalog)) importedSeries.push(...seriesCatalog);
 if(typeof houseSeriesCatalog!=="undefined" && Array.isArray(houseSeriesCatalog)) importedSeries.push(...houseSeriesCatalog);
 if(typeof importedSeriesCatalog!=="undefined" && Array.isArray(importedSeriesCatalog)) importedSeries.push(...importedSeriesCatalog);
 // Aplica as capas/prévias configuradas separadamente em series_images.js.
 if(typeof seriesImagesCatalog!=="undefined" && seriesImagesCatalog && typeof seriesImagesCatalog==="object") {
   importedSeries.forEach(src=>{
     const img=seriesImagesCatalog[src.title];
     if(img){ src.poster=img.poster||src.poster||""; src.backdrop=img.backdrop||src.backdrop||src.poster||""; src.posterSource="series_images.js"; }
   });
 }
 const importedIds=new Set();
 importedSeries.forEach((src)=>{
   const found=data.contents.find(c=>c.id===src.id);
   const normalized={...src,type:"series",backdrop:src.backdrop||src.poster||"",posterSource:src.posterSource||"",drive:""};
   if(typeof seriesImagesCatalog!=="undefined" && seriesImagesCatalog && seriesImagesCatalog[src.title]){
     const img=seriesImagesCatalog[src.title];
     normalized.poster=img.poster||normalized.poster||"";
     normalized.backdrop=img.backdrop||normalized.backdrop||normalized.poster||"";
     normalized.posterSource="series_images.js";
   }
   importedIds.add(src.id);
   if(found) Object.assign(found,normalized);
   else data.contents.push(normalized);
 });
 // Remove duplicatas de séries por título normalizado. Ano entre parênteses,
 // acentos, pontuação e o marcador [L] não criam um novo título. Entre duas
 // entradas equivalentes, preserva a que possui mais episódios.
 const seriesTitleKey=(title)=>String(title||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s*\(\d{4}\)\s*$/g,"").replace(/\s*\[l\]\s*$/g,"").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
 const seriesEpisodeCount=(c)=>(c?.seasons||[]).reduce((n,s)=>n+(s?.episodes?.length||0),0);
 const canonicalSeriesIds=new Set(importedSeries.map(s=>s.id));
 const dedupSeries=[]; const seenSeries=new Map();
 data.contents.forEach(c=>{
  if(c.type!=="series"){ dedupSeries.push(c); return; }
  const key=seriesTitleKey(c.title);
  if(!key){ dedupSeries.push(c); return; }
  const idx=seenSeries.get(key);
  if(idx===undefined){ seenSeries.set(key,dedupSeries.length); dedupSeries.push(c); return; }
  const previous=dedupSeries[idx];
  const cCanonical=canonicalSeriesIds.has(c.id), pCanonical=canonicalSeriesIds.has(previous.id);
  const replace=(cCanonical&&!pCanonical) || (cCanonical===pCanonical && seriesEpisodeCount(c)>seriesEpisodeCount(previous));
  if(replace) dedupSeries[idx]=c;
 });
 data.contents=dedupSeries;
 data.contents.forEach(c=>{ if(c.type==="series"){ c.category=String(c.category||"Drama").trim()||"Drama"; delete c.year; delete c.seasonCount; delete c.seasonsCount; } });

 data.favorites=Array.isArray(data.favorites)?data.favorites:[];
 data.history=Array.isArray(data.history)?data.history:[];
 data.releases=Array.isArray(data.releases)?data.releases:[];
 data.releases=data.releases.map((r,i)=>({id:r.id||("rel"+Date.now()+i),title:String(r.title||"Sem título"),category:String(r.category||"Lançamento recente"),synopsis:String(r.synopsis||""),poster:String(r.poster||""),releaseDate:String(r.releaseDate||""),createdAt:Number(r.createdAt)||Date.now()-i}));
 data.favorites=data.favorites.filter(id=>!data.contents.some(c=>c.id===id&&c.type==="series"));
 data.reactions=(data.reactions&&typeof data.reactions==="object")?data.reactions:{};
 data.contents.forEach(c=>{
  if(c.type!=="series") return;
  if(!Array.isArray(c.seasons)) c.seasons=[];
  if(c.seasons.length===0 && c.drive){
   c.seasons=[{number:1,episodes:[{id:c.id+"_ep1",number:1,title:"Episódio 1",synopsis:c.synopsis||"",drive:c.drive}]}];
   return;
  }
  // Os catálogos importados já chegam normalizados. Evitamos remapear
  // milhares de episódios durante a inicialização, que podia travar a página.
  if(importedIds.has(c.id)) return;
  c.seasons=c.seasons.map((s,i)=>({
   number:Number(s.number)||i+1,
   episodes:Array.isArray(s.episodes)?s.episodes.map((e,j)=>({
    id:e.id||("ep"+Date.now()+j+Math.random().toString(36).slice(2,7)),
    number:Number(e.number)||j+1, title:e.title||("Episódio "+(j+1)), synopsis:e.synopsis||"", drive:e.drive||""
   })):[]
  })).sort((a,b)=>a.number-b.number);
  c.seasons.forEach(s=>s.episodes.sort((a,b)=>a.number-b.number));
 });
 return data;
}
const SERIES_IMAGE_CACHE_KEY="streamdrive_series_images_v1";
function getSeriesImageCache(){
 try{return JSON.parse(localStorage.getItem(SERIES_IMAGE_CACHE_KEY)||"{}")}catch(e){return {}}
}
function saveSeriesImageCache(cache){try{localStorage.setItem(SERIES_IMAGE_CACHE_KEY,JSON.stringify(cache))}catch(e){}}
function seriesNeedsImage(c){
 const p=String(c?.poster||"");
 return c?.type==="series" && (!p || /placehold\.co|CAPA%20IN|CAPA INDISPON/i.test(p));
}
function normalizeShowQuery(title){
 return String(title||"").replace(/\s+/g," ").replace(/\btemporada\b.*$/i,"").trim();
}
async function fetchSeriesImage(title){
 const query=normalizeShowQuery(title);
 const candidates=[];
 try{
  const q=encodeURIComponent(query);
  const single=await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${q}`,{headers:{Accept:"application/json"}});
  if(single.ok){
   const show=await single.json();
   if(show?.image?.original||show?.image?.medium) return show.image.original||show.image.medium;
  }
 }catch(e){}
 // Fallback: o endpoint de busca é mais tolerante com títulos traduzidos/abreviados.
 try{
  const q=encodeURIComponent(query);
  const list=await fetch(`https://api.tvmaze.com/search/shows?q=${q}`,{headers:{Accept:"application/json"}});
  if(list.ok){
   const results=await list.json();
   for(const row of Array.isArray(results)?results:[]){
    const image=row?.show?.image?.original||row?.show?.image?.medium;
    if(image){ candidates.push(image); break; }
   }
  }
 }catch(e){}
 return candidates[0]||null;
}
async function hydrateSeriesImages(){
 if(!db?.contents?.length)return;
 const cache=getSeriesImageCache();
 const pending=db.contents.filter(c=>seriesNeedsImage(c));
 if(!pending.length)return;
 let changed=false;
 const queue=[...pending];
 const worker=async()=>{
  while(queue.length){
   const c=queue.shift(); if(!c)break;
   const key=normalizeShowQuery(c.title).toLowerCase();
   let image=cache[key];
   if(image===undefined){ image=await fetchSeriesImage(c.title); cache[key]=image||null; saveSeriesImageCache(cache); }
   if(image){ c.poster=image; c.backdrop=image; c.posterSource="TVMaze"; changed=true; }
  }
 };
 await Promise.all(Array.from({length:4},worker));
 if(changed){
  save();
  heroPreviewPool=[];
  heroPreviewPoolType="";
  renderCategoryMenus();
  renderHero();
  renderCatalog();
 }
}

function attachImportedSeriesCatalog(list){
 try{
  if(!Array.isArray(list)||!list.length||!db)return;
  const existing=new Set(db.contents.filter(c=>c.type==="series").map(c=>String(c.id)));
  const byTitle=new Map(db.contents.filter(c=>c.type==="series").map(c=>[String(c.title||"").trim().toLowerCase(),c]));
  list.forEach(src=>{
   if(!src||!src.id)return;
   const img=(typeof seriesImagesCatalog!=="undefined"&&seriesImagesCatalog&&seriesImagesCatalog[src.title])||null;
   const normalized={...src,type:"series",backdrop:src.backdrop||src.poster||img?.backdrop||img?.poster||"",poster:src.poster||img?.poster||"",posterSource:src.posterSource||""};
   if(img){normalized.poster=img.poster||normalized.poster;normalized.backdrop=img.backdrop||normalized.backdrop||normalized.poster;normalized.posterSource="series_images.js";}
   const sameId=existing.has(String(normalized.id));
   const sameTitle=byTitle.get(String(normalized.title||"").trim().toLowerCase());
   if(sameId){
    const found=db.contents.find(c=>String(c.id)===String(normalized.id));
    if(found)Object.assign(found,normalized);
   }else if(sameTitle){
    Object.assign(sameTitle,normalized);
   }else{
    db.contents.push(normalized);
    existing.add(String(normalized.id));
    byTitle.set(String(normalized.title||"").trim().toLowerCase(),normalized);
   }
  });
  // A catalogização completa só ocorre aqui, depois que a interface já abriu.
  db=normalizeData(db);
  applyAdminSeriesStore(db);
  try{save()}catch(e){}
  if(session&&document.getElementById("app")?.querySelector(".topbar")){
   renderCategoryMenus();
   renderHero();
   renderCatalog();
  }
 }catch(err){console.error("StreamDrive: falha ao anexar catálogo de séries",err)}
}
window.__attachImportedSeriesCatalog=attachImportedSeriesCatalog;

function load(){
 let stored=null;
 try{
   stored=JSON.parse(localStorage.getItem(KEY)||"null");
   if(!stored){ for(const k of LEGACY_KEYS){ const raw=localStorage.getItem(k); if(raw){ try{stored=JSON.parse(raw);break;}catch(e){} } } }
 }catch(e){}
 try{db=normalizeData(stored||clone(defaultData)); applyAdminSeriesStore(db)}catch(e){db=normalizeData(clone(defaultData)); applyAdminSeriesStore(db)}
 // Catálogo leve: garante 8 prévias na página Séries imediatamente,
 // mesmo enquanto o catálogo completo de episódios é carregado em segundo plano.
 if(typeof seriesPreviewCatalog!=="undefined" && Array.isArray(seriesPreviewCatalog)){
  const byId=new Set(db.contents.filter(c=>c.type==="series").map(c=>String(c.id)));
  seriesPreviewCatalog.forEach(c=>{
   if(!c||!c.id||byId.has(String(c.id))) return;
   db.contents.push({...c,type:"series"});
   byId.add(String(c.id));
  });
 }

 // Sincroniza o catálogo Ação com a fonte acao.js. Assim as capas não ficam
 // presas a versões antigas salvas no localStorage.
 if(typeof acaoCatalog!=="undefined"){
  const actionByKey=new Map(acaoCatalog.map((c,i)=>[String(c.title||"").trim().toLowerCase()+"|"+String(c.year||"")+"|ação",{...c,index:i}]));
  db.contents.forEach(c=>{
   const key=String(c.title||"").trim().toLowerCase()+"|"+String(c.year||"")+"|"+String(c.category||"").trim().toLowerCase();
   const src=actionByKey.get(key);
   if(src){
    c.poster=src.poster||c.poster||"";
    c.year=src.year||c.year||"";
    c.category="Ação";
    c.drive=src.drive||c.drive||"";
    c.type="movie";
   }
  });
  acaoCatalog.forEach((c,i)=>{
   const key=String(c.title||"").trim().toLowerCase()+"|"+String(c.year||"")+"|ação";
   const found=db.contents.find(x=>String(x.title||"").trim().toLowerCase()+"|"+String(x.year||"")+"|"+String(x.category||"").trim().toLowerCase()===key);
   if(!found) db.contents.push({...c,id:"acao-"+(i+1),rating:"",synopsis:"Filme da categoria Ação.",drive:c.drive||""});
  });
 }
 // Sincroniza o catálogo Animação com a fonte "Animação lista net.txt".
 // Cada entrada conserva nome, ano, capa e link de reprodução fornecidos.
 if(typeof animacaoCatalog!=="undefined"){
  animacaoCatalog.forEach((c,i)=>{
   const title=String(c.title||"").trim().toLowerCase();
   const year=String(c.year??"");
   const drive=String(c.drive||"").trim();
   const found=db.contents.find(x=>
    x.type==="movie" &&
    String(x.category||"").trim().toLowerCase()==="animação" &&
    String(x.title||"").trim().toLowerCase()===title &&
    String(x.year??"")===year &&
    String(x.drive||"").trim()===drive
   );
   if(found){
    found.poster=c.poster||found.poster||"";
    found.year=c.year??found.year??"";
    found.category="Animação";
    found.drive=drive;
    found.type="movie";
   }else{
    db.contents.push({...c,id:"animacao-"+(i+1),rating:"",synopsis:"Filme da categoria Animação.",drive});
   }
  });
 }
 // Sincroniza o catálogo Comédia extraído de "Comédia pobre flix(1).txt".
 // Mantém exatamente nome, ano, capa e link de reprodução do arquivo.
 if(typeof comediaCatalog!=="undefined"){
  comediaCatalog.forEach((c,i)=>{
   const title=String(c.title||"").trim().toLowerCase();
   const year=String(c.year??"");
   const drive=String(c.drive||"").trim();
   const found=db.contents.find(x=>
    x.type==="movie" &&
    String(x.category||"").trim().toLowerCase()==="comédia" &&
    String(x.title||"").trim().toLowerCase()===title &&
    String(x.year??"")===year &&
    String(x.drive||"").trim()===drive
   );
   if(found){
    found.poster=c.poster||found.poster||"";
    found.year=c.year??found.year??"";
    found.category="Comédia";
    found.drive=drive;
    found.type="movie";
   }else{
    db.contents.push({...c,id:"comedia-"+(i+1),rating:"",synopsis:"Filme da categoria Comédia.",drive});
   }
  });
 }
 setTimeout(()=>{try{save()}catch(e){console.warn("StreamDrive: sincronização do catálogo adiada",e)}},0);
}
function save(){
 try{
  try{localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(db.accounts||[]))}catch(accountErr){console.warn("StreamDrive: contas não puderam ser persistidas",accountErr)}
  localStorage.setItem(KEY,JSON.stringify(db));
  return true;
 }catch(e){
  // O catálogo de séries pode ser grande demais para a cota de localStorage.
  // A interface não pode parar por causa disso: os dados continuam disponíveis
  // nesta sessão através das fontes JS incorporadas ao projeto.
  console.warn("StreamDrive: catálogo não pôde ser persistido no localStorage.",e);
  return false;
 }
}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function toast(msg){const x=document.getElementById("toast");x.textContent=msg;x.style.cssText="position:fixed;right:20px;bottom:20px;z-index:100;background:#e50914;color:#fff;padding:13px 17px;border-radius:5px;box-shadow:0 5px 25px #000;";setTimeout(()=>x.style.cssText="",2500)}
function setSession(a){session=a;localStorage.setItem("sd_session",a.id)}
function restoreSession(){const id=localStorage.getItem("sd_session");session=db.accounts.find(a=>a.id===id)||null}
function initials(n){return (n||"?").trim().split(/\s+/).slice(0,8).map(x=>x[0]).join("").toUpperCase()}
function isImageUrl(url){
 const value=String(url||'').trim().split('#')[0].split('?')[0].toLowerCase();
 return /\.(?:jpg|jpeg|png|gif|webp|avif|bmp|svg|ico|tiff?)$/.test(value)
   || value.startsWith('data:image/')
   || /(?:image|poster|thumbnail|cover)/.test(value) && !/\.(?:mp4|m4v|webm|mov|m3u8|mpd)(?:$|[?#])/.test(value);
}
function isGoogleDriveUrl(url){
 const value=String(url||'').trim().toLowerCase();
 return value.includes('drive.google.com/') || value.includes('docs.google.com/') || value.includes('drive.usercontent.google.com/');
}
function isDirectVideo(url){
 const value=String(url||'').trim();
 if(!value || isImageUrl(value) || isGoogleDriveUrl(value)) return false;
 const path=value.split('#')[0].split('?')[0].toLowerCase();
 // Aceita arquivos de vídeo conhecidos e URLs de servidores de streaming.
 if(/\.(?:mp4|m4v|webm|ogv|ogg|mov|m3u8|mpd)$/.test(path)) return true;
 if(/(?:\/movie\/|\/video\/|\/videos\/|\/stream\/|\/live\/|[?&](?:file|video|stream)=)/i.test(value)) return true;
 return /^https?:\/\//i.test(value);
}

function drivePreview(url){
 if(!url)return "";
 let m=String(url).match(/\/file\/d\/([^/]+)/);
 if(m)return `https://drive.google.com/file/d/${m[1]}/preview`;
 if(String(url).includes("drive.google.com"))return String(url).replace(/\/view(\?.*)?$/,"/preview$1");
 return String(url);
}
function playbackCandidates(item){
 // SOMENTE campos de vídeo. Nunca usamos poster, image, url ou link genéricos,
 // porque esses campos frequentemente apontam para a capa do filme.
 const out=[];
 const keys=['drive','video','videoUrl','videoURL','video_link','videoLink','playback','playbackUrl','stream','streamUrl','source','sourceUrl','file','fileUrl'];
 for(const key of keys){
  const value=String(item?.[key]||'').trim();
  if(!value || isImageUrl(value)) continue;
  if(!out.includes(value)) out.push(value);
 }
 return out;
}
function personalizePlaybackUrl(url){
 const raw=String(url||"");
 if(!raw || !session || session.role==="admin") return raw;
 const user=encodeURIComponent(String(session.username||""));
 const pass=encodeURIComponent(String(session.password||""));
 return raw.replaceAll("3030370teste",String(session.username||"")).replaceAll("teste3030370",String(session.password||""));
}
function resolvePlaybackUrl(item){
 // A URL de reprodução vem exclusivamente do campo de vídeo.

 // O campo poster/image é proibido aqui.
 const candidates=playbackCandidates(item);
 let video=candidates.find(v=>isGoogleDriveUrl(v)||isDirectVideo(v));
 if(!video)return '';
 video=personalizePlaybackUrl(video);
 // NÃO trocamos HTTP por HTTPS automaticamente: isso altera a URL original
 // e pode quebrar servidores de vídeo que só oferecem HTTP.
 return video;
}
function showModal(html){
 const modal=document.getElementById('modal');
 const playerMode=html.includes('sd-player');
 modal.classList.toggle('modal-player-mode',playerMode);
 modal.classList.remove('hidden');
 modal.innerHTML=`<div class="modal-box ${playerMode?'sd-player-box':''}">${html}</div>`;
 if(playerMode) initStreamPlayer();
}
function closeModal(){
 const modal=document.getElementById('modal');
 modal.classList.remove('modal-player-mode');
 modal.classList.add('hidden');
 modal.innerHTML='';
 if(window.sdPlayerCleanup) window.sdPlayerCleanup();
 const params=new URLSearchParams(location.search);
 if(params.get('categoria')) renderCategoryPage(params.get('categoria'),params.get('tipo')||'movie');
 else if(document.getElementById('hero')&&document.getElementById('catalog')){renderHero();renderCatalog();}
}
function getPlayerReturnUrl(){
 const params=new URLSearchParams(location.search);
 if(params.get('categoria'))return `category.html?categoria=${encodeURIComponent(params.get('categoria'))}&tipo=${encodeURIComponent(params.get('tipo')||'movie')}`;
 if(location.pathname.endsWith('/series.html') || location.pathname.endsWith('\\series.html') || location.pathname.endsWith('series.html')) return 'series.html';
 return 'index.html';
}
function openPlayerBack(){
 const target=playerReturnUrl||getPlayerReturnUrl();
 const modal=document.getElementById('modal');
 modal?.classList.remove('modal-player-mode'); modal?.classList.add('hidden');
 if(modal)modal.innerHTML='';
 if(window.sdPlayerCleanup)window.sdPlayerCleanup();
 if(target.startsWith('category.html?')&&location.pathname.endsWith('/category.html')){
  const u=new URL(target,location.href); history.pushState(null,'',u.pathname+u.search);
  const params=new URLSearchParams(u.search); renderCategoryPage(params.get('categoria')||'',params.get('tipo')||'movie'); return;
 }
 location.href=target;
}

async function sdLockLandscape(){
  try{
    if(window.matchMedia && !matchMedia('(pointer:coarse)').matches) return;
    if(screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  }catch(e){}
}
function sdUnlockOrientation(){try{screen.orientation?.unlock?.()}catch(e){}}
function sdMobileLiteMedia(){
  const mobile=window.matchMedia && (matchMedia('(max-width:700px)').matches || matchMedia('(pointer:coarse)').matches);
  if(!mobile)return;
  document.body.classList.add('sd-mobile-lite');
  const selectors='.hero-preview-video,.category-page-preview-video,.card-preview-video,.inline-info-preview';
  document.querySelectorAll(selectors).forEach(v=>{
    if(v.src){v.dataset.mobileSrc=v.src;v.removeAttribute('src');}
    v.removeAttribute('autoplay'); v.removeAttribute('loop'); v.preload='none';
    try{v.load()}catch(e){}
  });
  document.querySelectorAll('img:not([loading])').forEach(img=>{img.loading='lazy';img.decoding='async'});
}
function initStreamPlayer(){
 const root=document.querySelector('.sd-player'); if(!root)return;
 const video=root.querySelector('video.sd-video');
 const frame=root.querySelector('iframe.sd-drive-frame');
 const play=root.querySelector('[data-action="play"]');
 const bigPlay=root.querySelector('[data-action="big-play"]');
 const centerBack=root.querySelector('[data-action="center-back10"]');
 const centerForward=root.querySelector('[data-action="center-forward10"]');
 const progress=root.querySelector('.sd-progress');
 const progressFill=root.querySelector('.sd-progress-fill');
 const current=root.querySelector('.sd-current');
 const duration=root.querySelector('.sd-duration');
 const volume=root.querySelector('.sd-volume');
 const volumeIcon=root.querySelector('.sd-volume-icon');
 const center=root.querySelector('.sd-center-message');
 const controls=root.querySelector('.sd-controls');
 const topbar=root.querySelector('.sd-topbar');
 const title=root.querySelector('.sd-title');
 const settings=root.querySelector('.sd-settings');
 const speedMenu=root.querySelector('.sd-speed-menu');
 const skipBack=root.querySelector('[data-action="back10"]');
 const skipForward=root.querySelector('[data-action="forward10"]');
 const fullscreen=root.querySelector('[data-action="fullscreen"]');
 const episodesToggle=root.querySelector('[data-action="episodes"]');
 const episodesPanel=root.querySelector('.sd-episodes-panel');
 let hideTimer=null;
 const fmt=t=>{if(!Number.isFinite(t))return '0:00'; t=Math.max(0,Math.floor(t)); const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=t%60; return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`};
 const showUI=()=>{root.classList.remove('sd-ui-hidden');clearTimeout(hideTimer);hideTimer=setTimeout(()=>root.classList.add('sd-ui-hidden'),3000)};
 const setPlaying=on=>{root.classList.toggle('sd-playing',on); if(play)play.textContent=on?'❚❚':'▶'; if(bigPlay){const icon=bigPlay.querySelector('.sd-big-play-icon'); if(icon) icon.textContent=on?'❚❚':'▶'; else bigPlay.textContent=on?'❚❚':'▶';}};
 const toggle=()=>{if(!video)return; video.paused?video.play().catch(()=>{}):video.pause();showUI()};
 const update=()=>{if(!video)return; const d=video.duration||0,p= d?video.currentTime/d*100:0; if(progress)progress.value=p; if(progressFill)progressFill.style.width=p+'%'; if(current)current.textContent=fmt(video.currentTime); if(duration)duration.textContent=fmt(d);};
 if(video){
  // Preserva as cores originais do vídeo. Não aplicar filtros, blends ou transformações
  // ao elemento <video>, pois alguns decodificadores do Chrome podem apresentar
  // dominante roxa/verde quando há composição gráfica sobre o vídeo.
  video.controls=false; video.autoplay=true; video.muted=false; video.defaultMuted=false; video.volume=0.6; video.playsInline=true;
  video.style.filter='none';
  video.style.mixBlendMode='normal';
  video.style.opacity='1';
  video.style.transform='none';
  video.style.backfaceVisibility='visible';
  video.addEventListener('loadedmetadata',update); video.addEventListener('timeupdate',update); video.addEventListener('durationchange',update);
  video.addEventListener('play',()=>setPlaying(true)); video.addEventListener('pause',()=>setPlaying(false));
  video.addEventListener('ended',()=>{setPlaying(false); showUI(); if(root.dataset.nextSeries==='1') setTimeout(()=>playNextEpisode(),350)});
  video.addEventListener('click',toggle);
  video.addEventListener('dblclick',()=>toggleFullscreen());
  video.addEventListener('volumechange',()=>{if(volume)volume.value=video.volume; if(volumeIcon)volumeIcon.textContent=video.muted||video.volume===0?'🔇':video.volume<.5?'🔉':'🔊'});
  // Tenta iniciar o autoplay já com áudio em 60%. Alguns navegadores podem bloquear
  // autoplay com áudio sem uma interação prévia do usuário.
  const startAutoplay=()=>{
   if(video.paused){
    const p=video.play();
    if(p&&p.catch)p.catch(()=>{});
   }
  };
  video.addEventListener('loadedmetadata',startAutoplay,{once:true});
  video.addEventListener('canplay',startAutoplay,{once:true});
  startAutoplay();
  setPlaying(!video.paused);
 }
 play?.addEventListener('click',toggle); bigPlay?.addEventListener('click',toggle);
 progress?.addEventListener('input',()=>{if(video&&video.duration)video.currentTime=(Number(progress.value)/100)*video.duration;showUI()});
 volume?.addEventListener('input',()=>{if(video){video.volume=Number(volume.value);video.muted=video.volume===0}showUI()});
 volumeIcon?.addEventListener('click',()=>{if(video){video.muted=!video.muted; if(!video.muted&&video.volume===0)video.volume=.7}showUI()});
 skipBack?.addEventListener('click',()=>{if(video)video.currentTime=Math.max(0,video.currentTime-10);showUI()});
 skipForward?.addEventListener('click',()=>{if(video)video.currentTime=Math.min(video.duration||Infinity,video.currentTime+10);showUI()});
 centerBack?.addEventListener('click',e=>{e.stopPropagation();if(video)video.currentTime=Math.max(0,video.currentTime-10);showUI()});
 centerForward?.addEventListener('click',e=>{e.stopPropagation();if(video)video.currentTime=Math.min(video.duration||Infinity,video.currentTime+10);showUI()});
 const toggleFullscreen=()=>{if(document.fullscreenElement){document.exitFullscreen?.();sdUnlockOrientation();return} const p=root.requestFullscreen?.(); if(p&&p.then)p.then(()=>sdLockLandscape()).catch(()=>{}); else sdLockLandscape();};
 fullscreen?.addEventListener('click',toggleFullscreen);
 settings?.addEventListener('click',e=>{e.stopPropagation();root.classList.toggle('sd-settings-open');showUI()});
 speedMenu?.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{if(video)video.playbackRate=Number(b.dataset.speed);speedMenu.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');root.classList.remove('sd-settings-open');showUI()}));
 episodesToggle?.addEventListener('click',e=>{e.stopPropagation();root.classList.toggle('sd-episodes-open');root.classList.remove('sd-settings-open');showUI()});
 episodesPanel?.querySelectorAll('[data-series-episode]').forEach(b=>b.addEventListener('click',()=>{
   const seriesId=b.dataset.seriesId, season=Number(b.dataset.season), episodeId=b.dataset.seriesEpisode;
   if(seriesId&&episodeId) openEpisodePlayer(seriesId,season,episodeId);
 }));
 episodesPanel?.querySelectorAll('[data-series-season]').forEach(b=>b.addEventListener('click',()=>{
   const season=Number(b.dataset.seriesSeason);
   if(selectedSeriesId) refreshPlayerEpisodes(selectedSeriesId,season);
 }));
 episodesPanel?.querySelector('[data-episodes-close]')?.addEventListener('click',()=>{root.classList.remove('sd-episodes-open');showUI()});
 root.querySelectorAll('[data-close-player]').forEach(b=>b.addEventListener('click',openPlayerBack));
 ['mousemove','pointermove','touchstart','keydown'].forEach(ev=>root.addEventListener(ev,showUI,{passive:ev!=='keydown'}));
 document.addEventListener('keydown',sdPlayerKeyHandler);
 function sdPlayerKeyHandler(e){if(!document.querySelector('.sd-player'))return; if(e.target?.tagName==='INPUT')return; if(e.key===' '){e.preventDefault();toggle()} else if(e.key==='ArrowLeft'&&video){video.currentTime=Math.max(0,video.currentTime-10);showUI()} else if(e.key==='ArrowRight'&&video){video.currentTime=Math.min(video.duration||Infinity,video.currentTime+10);showUI()} else if(e.key.toLowerCase()==='f')toggleFullscreen(); else if(e.key==='Escape'&&document.fullscreenElement)document.exitFullscreen?.();}
 window.sdPlayerCleanup=()=>{document.removeEventListener('keydown',sdPlayerKeyHandler);clearTimeout(hideTimer);window.sdPlayerCleanup=null};
 showUI();
 document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)sdUnlockOrientation();});
}
function toggleFullscreen(){const root=document.querySelector('.sd-player');if(!root)return;if(document.fullscreenElement){document.exitFullscreen?.();sdUnlockOrientation();}else{const p=root.requestFullscreen?.();if(p&&p.then)p.then(()=>sdLockLandscape()).catch(()=>{});else sdLockLandscape();}}
function playNextEpisode(){
 if(!selectedSeriesId||selectedSeasonNumber==null||!selectedEpisodeId)return;
 const c=getSeries(selectedSeriesId),s=getSeason(c,selectedSeasonNumber);if(!c||!s)return;
 const i=(s.episodes||[]).findIndex(e=>e.id===selectedEpisodeId);const next=s.episodes?.[i+1];
 if(next)openEpisodePlayer(c.id,s.number,next.id);
}
function playerMarkup(item, isEpisode=false){
 const raw=resolvePlaybackUrl(item);
 const direct=isDirectVideo(raw);
 const source=direct?raw:drivePreview(raw);
 const media=!raw
  ? `<div class="sd-empty"><div class="sd-empty-icon">!</div><h2>Vídeo indisponível</h2><p>Este título ainda não possui um arquivo de reprodução.</p></div>`
  : direct
    ? `<video class="sd-video" src="${esc(source)}" preload="auto" autoplay muted playsinline></video>`
    : `<iframe class="sd-drive-frame" src="${esc(source)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="${esc(item.title||'Vídeo')}"></iframe><div class="sd-drive-note">Controles do Google Drive</div>`;
 const custom=direct?`<div class="sd-controls">
   <div class="sd-progress-wrap"><div class="sd-progress-track"><div class="sd-progress-fill"></div></div><input class="sd-progress" type="range" min="0" max="100" step="0.1" value="0" aria-label="Progresso"></div>
   <div class="sd-control-row"><button class="sd-control" data-action="play" aria-label="Reproduzir">▶</button><button class="sd-control skip" data-action="back10" aria-label="Voltar 10 segundos">↶<small>10</small></button><button class="sd-control skip" data-action="forward10" aria-label="Avançar 10 segundos">↷<small>10</small></button><button class="sd-control sd-volume-icon" aria-label="Volume">🔊</button><input class="sd-volume" type="range" min="0" max="1" step="0.05" value="0.6" aria-label="Volume"><span class="sd-time"><span class="sd-current">0:00</span> / <span class="sd-duration">0:00</span></span><span class="sd-spacer"></span>${isEpisode?'<button class="sd-control sd-episodes-control" data-action="episodes" aria-label="Temporadas e episódios">☰ <span>Episódios</span></button>':''}<button class="sd-control" data-action="settings" aria-label="Velocidade">⚙</button><button class="sd-control" data-action="fullscreen" aria-label="Tela cheia">⛶</button></div>
   <div class="sd-settings sd-settings-menu"><div class="sd-speed-menu"><strong>Velocidade</strong><button data-speed="0.75">0,75×</button><button data-speed="1" class="active">Normal</button><button data-speed="1.25">1,25×</button><button data-speed="1.5">1,5×</button><button data-speed="2">2×</button></div></div>
 </div>`:'';
 return `<div class="sd-player ${isEpisode?'sd-series-player':'sd-movie-player'}" data-next-series="${isEpisode?'1':'0'}" role="dialog" aria-label="Player de ${esc(item.title||'Vídeo')}">
   <div class="sd-stage">${media}</div>
   ${direct?`<div class="sd-center-controls" aria-label="Controles do player"><button type="button" class="sd-center-skip" data-action="center-back10" aria-label="Voltar 10 segundos" title="Voltar 10 segundos">↶<span>10</span></button><button type="button" class="sd-big-play" data-action="big-play" aria-label="Reproduzir ou pausar"><span class="sd-big-play-icon">▶</span></button><button type="button" class="sd-center-skip" data-action="center-forward10" aria-label="Avançar 10 segundos" title="Avançar 10 segundos">↷<span>10</span></button></div>`:''}
   <div class="sd-vignette"></div>
   <div class="sd-topbar"><button class="sd-back" data-close-player type="button">‹ <span>Voltar</span></button><div class="sd-title">${esc(item.title||'')}</div><div class="sd-brand">STREAMDRIVE</div></div>
   <div class="sd-info"><div class="sd-label">${isEpisode?'SÉRIE':'FILME'}</div><h1>${esc(item.title||'')}</h1><p>${esc(item.synopsis||'')}</p>${!isEpisode?`<div class="sd-actions"><button class="sd-add" onclick="toggleFav('${esc(item.id||selectedSeriesId)}')">${db.favorites.includes(item.id||selectedSeriesId)?'✓ Na minha lista':'＋ Minha lista'}</button></div>`:''}</div>
   ${isEpisode?seriesEpisodesPanel(selectedSeriesId,selectedSeasonNumber,selectedEpisodeId):''}
   ${custom}
 </div>`;
}
function refreshPlayerEpisodes(seriesId,seasonNumber){
 const root=document.querySelector('.sd-player'); if(!root)return;
 selectedSeasonNumber=Number(seasonNumber); selectedEpisodeId=null;
 const panel=root.querySelector('.sd-episodes-panel'); if(!panel)return;
 panel.outerHTML=seriesEpisodesPanel(seriesId,selectedSeasonNumber,selectedEpisodeId);
 const newPanel=root.querySelector('.sd-episodes-panel');
 newPanel?.querySelectorAll('[data-series-season]').forEach(b=>b.addEventListener('click',()=>refreshPlayerEpisodes(seriesId,Number(b.dataset.seriesSeason))));
 newPanel?.querySelectorAll('[data-series-episode]').forEach(b=>b.addEventListener('click',()=>openEpisodePlayer(seriesId,Number(b.dataset.season),b.dataset.seriesEpisode)));
 newPanel?.querySelector('[data-episodes-close]')?.addEventListener('click',()=>root.classList.remove('sd-episodes-open'));
}

function seriesEpisodesPanel(seriesId,activeSeason,activeEpisode){
 const c=getSeries(seriesId); if(!c) return '';
 const seasons=Array.isArray(c.seasons)?c.seasons:[];
 const selected=getSeason(c,activeSeason)||seasons[0];
 const seasonButtons=seasons.map(s=>{const n=Number(s.number);return `<button type="button" class="sd-season-tab ${n===Number(selected?.number)?'active':''}" data-series-season="${n}" aria-label="Temporada ${n}" title="Temporada ${n}"><span>T${n}</span></button>`}).join('');
 const episodes=(selected?.episodes||[]).map(e=>`<button type="button" class="sd-episode-row ${e.id===activeEpisode?'active':''}" data-series-episode="${esc(e.id)}" data-series-id="${esc(c.id)}" data-season="${selected.number}"><span class="sd-episode-thumb">${e.number}</span><span class="sd-episode-copy"><strong>${esc(e.title||`Episódio ${e.number}`)}</strong><small>${esc(e.synopsis||'')}</small></span><span class="sd-episode-play">▶</span></button>`).join('');
 return `<aside class="sd-episodes-panel" aria-label="Temporadas e episódios"><div class="sd-episodes-head"><div><span class="sd-panel-kicker">SÉRIE</span><h2>${esc(c.title)}</h2></div><button type="button" class="sd-panel-close" data-episodes-close aria-label="Fechar episódios">×</button></div><div class="sd-season-tabs">${seasonButtons}</div><div class="sd-episode-list">${episodes||'<div class="sd-episode-empty">Nenhum episódio disponível nesta temporada.</div>'}</div></aside>`;
}
function getSeries(id){return db.contents.find(c=>c.id===id&&c.type==="series")}
function getSeason(series,n){return series?.seasons?.find(s=>Number(s.number)===Number(n))}
function getEpisode(series,seasonNumber,episodeId){const s=getSeason(series,seasonNumber);return s?.episodes?.find(e=>e.id===episodeId)}

function loginTestCredentials(){
 const user=db.accounts.find(a=>a.role!=="admin")||{};
 const admin=db.accounts.find(a=>a.role==="admin")||{};
 return `<div class="login-test-credentials"><div><b>Usuário para teste</b><span>Usuário: <strong>${esc(user.username||"usuario")}</strong></span><span>Senha: <strong>${esc(user.password||"123456")}</strong></span></div><div><b>Administrador para teste</b><span>Usuário: <strong>${esc(admin.username||"paineladmin")}</strong></span><span>Senha: <strong>${esc(admin.password||"Admin@2026")}</strong></span></div></div>`;
}
function renderLogin(){
 document.getElementById("app").innerHTML=`<div class="login-page"><div class="login-box">
 <button class="logo" id="siteLogo" type="button" aria-label="Ir para a Home">STREAMDRIVE</button><h1>Entrar</h1>
 <form id="loginForm"><div class="field"><label>E-mail ou usuário</label><input id="email" type="text" required autocomplete="username" placeholder="Seu e-mail ou usuário administrativo"></div>
 <div class="field"><label>Senha</label><input id="password" type="password" required autocomplete="current-password"></div>
 <button class="btn btn-red" type="submit">Entrar</button></form>
 <div class="login-links"><button id="createBtn">Criar conta</button><button id="forgotBtn">Esqueci minha senha</button></div>
 <div class="notice">Use seu e-mail ou usuário. O administrador entra nesta mesma tela e será levado automaticamente ao painel.</div>
 ${loginTestCredentials()}
 </div></div>`;
 document.getElementById("loginForm").onsubmit=e=>{
  e.preventDefault();
  const login=document.getElementById("email").value.trim(),pass=document.getElementById("password").value;
  const value=login.toLowerCase();
  const a=db.accounts.find(x=>(String(x.email||"").toLowerCase()===value || String(x.username||"").toLowerCase()===value) && x.password===pass);
  if(!a)return toast("E-mail/usuário ou senha incorretos.");
  if(a.role==="admin"){
   localStorage.setItem(ADMIN_SESSION_KEY,a.id);
   sessionStorage.setItem(ADMIN_SESSION_KEY,a.id);
   localStorage.removeItem("sd_session");
   location.href="admin.html";
   return;
  }
  setSession(a);currentProfile=a.profiles?.[0];
  renderApp();
 };
 document.getElementById("createBtn").onclick=showCreate;
 document.getElementById("forgotBtn").onclick=showForgot;
}
function showCreate(){
 document.getElementById("app").innerHTML=`<div class="login-page"><div class="login-box"><button class="logo" id="siteLogo" type="button" aria-label="Ir para a Home">STREAMDRIVE</button><h1>Criar conta</h1>
 <form id="createForm"><div class="field"><label>Nome</label><input id="n" required></div><div class="field"><label>E-mail</label><input id="e" type="email" required></div><div class="field"><label>Usuário</label><input id="u" required placeholder="Nome de usuário"></div><div class="field"><label>Senha</label><input id="p" type="password" minlength="6" required></div><button class="btn btn-red">Criar conta</button></form>
 <div class="login-links"><button onclick="renderLogin()">Voltar ao login</button></div></div></div>`;
 document.getElementById("createForm").onsubmit=e=>{
  e.preventDefault();
  const name=document.getElementById("n").value.trim(),email=document.getElementById("e").value.trim().toLowerCase(),username=document.getElementById("u").value.trim().toLowerCase(),pass=document.getElementById("p").value;
  if(db.accounts.some(a=>a.email===email))return toast("Esse e-mail já está cadastrado.");
  if(db.accounts.some(a=>String(a.username||"").toLowerCase()===username))return toast("Esse usuário já está cadastrado.");
  const stamp=Date.now(),a={id:"a"+stamp,name,email,username,password:pass,role:"user",profiles:[{id:"p"+stamp,name,avatar:"avatar-1"}]};
  db.accounts.push(a);save();setSession(a);currentProfile=a.profiles[0];renderApp();
 };
}
function showForgot(){
 document.getElementById("app").innerHTML=`<div class="login-page"><div class="login-box"><button class="logo" id="siteLogo" type="button" aria-label="Ir para a Home">STREAMDRIVE</button><h1>Redefinir senha</h1>
 <p style="color:#aaa">Como esta versão funciona sem servidor, a recuperação é local. Informe o e-mail cadastrado e uma nova senha.</p>
 <form id="forgotForm"><div class="field"><label>E-mail</label><input id="fe" type="email" required></div><div class="field"><label>Nova senha</label><input id="fp" type="password" minlength="6" required></div><button class="btn btn-red">Redefinir</button></form>
 <div class="login-links"><button onclick="renderLogin()">Voltar ao login</button></div></div></div>`;
 document.getElementById("forgotForm").onsubmit=e=>{
  e.preventDefault();const a=db.accounts.find(x=>x.email===document.getElementById("fe").value.trim().toLowerCase());
  if(!a)return toast("E-mail não encontrado.");a.password=document.getElementById("fp").value;save();toast("Senha alterada.");setTimeout(renderLogin,700)
 };
}
function avatarOptions(){
 return [
  {id:"avatar-1",src:"data:image/webp;base64,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",label:"Stitch Amor"},
  {id:"avatar-2",src:"data:image/webp;base64,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",label:"Stitch & Angel"},
  {id:"avatar-3",src:"data:image/webp;base64,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",label:"Charmander"},
  {id:"avatar-4",src:"data:image/webp;base64,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",label:"Hamster Radical"},
  {id:"avatar-5",src:"data:image/webp;base64,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",label:"Ben 10"},
  {id:"avatar-6",src:"data:image/webp;base64,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",label:"Goku"},
  {id:"avatar-7",src:"data:image/webp;base64,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",label:"Mickey"},
  {id:"avatar-8",src:"data:image/webp;base64,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",label:"Minnie"},
  {id:"avatar-9",src:"data:image/webp;base64,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",label:"Spider-Man 1"},
  {id:"avatar-10",src:"data:image/webp;base64,UklGRnQtAABXRUJQVlA4IGgtAADwmgCdASoAAQABPmEqkEUkIqGW2s3YQAYEtTdur8hO2FEkb5f+zfuR7Hde/xf90/XPB8135d/Rf/e/yP5SfM//Zerr9Xf8X3B/11/6HpresH91fUj+3v7Q+8j/z/WH/cf9n+VXyE/1//Qf+3sSvQP/cf05/3T+FP+3f8r9rf/T70X/n9gD/ze2h/AP//1h/ZHzA+VmL7o5+r+6nKeiU/P/01/N4pfn1qKe4P9b8xXMcXC/7vqQd+P9t/df28/w/xCff/8n8kveX7Yf9P8oPoB/Lj8k+ce9d9gL+if4T/bfk3/ePlp/8vNt9a/+73Dv57/cf+F/hf3u/zng1/c/2rP2ubnOew3264u3K77cnl6GoQ9aM5Jqeb/OLPvjwDYmnk7m8mMl9H/s2F/Ef9JcxsXX3kLBkO4f/ufj8alVDMIqjAb+NzLcPkXwxLabDHaf3N/tk7Mpn0nOaSWAmf3b1t3VHqDlj/aObJE/tv5+gosBo3s2aL1l/MZOQ+EQL8VR7q2N6g9nNzohrF2QrwRAUAUsBywHMR3CBnqDofaye+jLmVPMYrO/qg4rK4XqCid9ETY4hyAP5WzRjpuOa4xk9ERhKewJ2CkHYuNbZdCo3lUSZb6sufR9+RjKbY9+VZ/EusK1+v9lwgR3HeH1SkenD9Qy0HUtEcxz4ijYwD4SnSPH3EzbDbWXbznGqpWoQz/1OHgC2ZfxmkGViVql4BCbOjq+JfDlmsiH06s2phK2bHD1JfebrLWLHbUoq88+5XZJXMK6dRp5vNXUR8sfSpakrX7Pu7t+HhrykF3KUXKg35T1E2Ucrc2/mT5tb2lj27gF52gEJEIpvLD4kK/m73DxP68GKJP/8UD9SPElDN1nE4YFl/aUdbm/+mAnoNqddzivrqppFF4d4hj2LtW16HzMXSz46P9ueXGgb5SzkLuy7Zfj9ubIIMUUgllR5e0OrTBZBIb79Cjn4h5TgTk6BoG2aMHdtZU/Q4jw83xtgHTYLk0/K6WeTNnVz6DeNgNeU2kMLbF8VgFutE1//IMwQAqDEIO8rfygfPG9JsIg939XEGpB+zrbYlodb7jto2v0fbOHoYOXp6zCKXKTrBT1LuRCCOmDFvR7CyW2S7PD5HYl3wxvnMem+c7PJhnhftkng5iPY9KLqkL3PnoUPIwgLkCpZiSa/rZ0nDkagcUl6VnENe00itL1634TBdKrBt/0mLjrLLr0wcXt+68IMaUL7XoDxzZx1MUZuq4a+Hk8gMX/HJzOmhJ3x4LqHE5oR1DS9MSBm5mr53BIvWXOm1kUOQ+DVziLYqRzkGPOK4Zw6FrCwxAKLwJjm+2WOzwQhpNIDZW1+mSFkMDTkONrPxKW7X6zGIzpNXuGn3rIzyP4MNMtoAmZdF/gx9MRHFX9JS7VLJp1cUPNFA2CiaFvLJ2d81rKhpruUhVwpLdb8S3oSsTm/OMF0uO4mzezcb56dwMT6/xnRlS7xUrUx08rcNPsm7nOd8NmeaaYFA7Z/x1khFdcjxSu8M6qlCw+0hsHXcdab2Z6Z/5ViP/3i5TXsX8S3NQrgCdC6gjEB0EPXXnZVAHdvFvTrWss5XoAH7z3EjYVQn5X7abB5DSL0o9gYF1hLBSvnrMZVSzrjGDtUHYO/rejB343Nm5kSnjxvVt5m1+IcdX9pgAA/v60IHW4JjlOSr3wf6r7777Qh5fPTqmt5rATkLj1oJ4yBVNj04lCPurUjZE4y2OqiLYMEQrrK4ZAnVQ7elIb1GtX579pJwP6f4ghqqijcr+7dgjPW/A3HXTmfk2gBupQk3tf72qdkoHK13SfFky+OhWD62dUH2rYCHFEyKem+HMcS2Rf1l2zxjrhQA+UnFSvbo3Arh1qdZlX+PyZOhpJGJwN461wr6cJu+gkEDYRtH5s2aTOPBA3wpzuM0rf+yB3qxlaFp5SR2ug8qb9Y53R8H/5f+Zmzz8FKjXUU6T3ArGb9/hwCbbQlwb7ve/I6hgZKD8BIw7b+bHtFBnRGUjqnfODf00k1KkU93Jb54sINmaW4s4+lL6HoWX0FzHVYTO0ddn0c5gLWy/6KVbA1FKF8QnUqFpbsBFWfcTUpOUW5uF6dUFd3T0tz1itzIWrInLZXFZf2nzU9s9PJVawakjppCpl+g7I0x9r1G0tgC+rT+jVKQxY5NFVeJcNgAKXprlmW/wIupUKeqKfQQDW+4kc80fLEGLzDGEGJJf1t5Wz7IPrP+ncIVntZnkspbkD4KJk/ULpheK7dCdosVXoFElwdnEvx7FDFqOb8acbc4l0rceDS4ElqCvtsT9vxa/e7RD7rlaPFTx8yAsu8tx46pL6xsAToL1pW9g4M/pS8FmJl88n2U2mXzAfE14UN/pEl7bASe5K6xrHeFUzViZNzunayF3chhPb8p3nxWBKKDfQPhYqFc7gkaYQB1TjEQB1tzk60nLJ8Ln5XvNQCcKpUsuiQbw9ORj4VDSTmKiDwTyTHCMbOK46yMs/THD+3N41DkjiAPg/91xRl2gu+qJegTNxOvvYe6yHe2cJG/w3xRZz4XPHtwlEi8YBO47iNx06BvhT3RRgz4XvT0CQamhnh3O9+wsHyas92erxAT8RlWv+jEktyVlKWz/BVcFLuU9pvRKucTETEPRzVUK4UbYr6a852Bc0m03Z4WAA46l8tTLwDOktEYPB3fPa76EELdwj4KC6mecgD/+6EXTQM5gwkO51azbWjbYZhx59l1+fQZxg8gJEeP7nqfVdnkIy0cCPkXO2P9bipouotxuv/W3/F6NyMEoXr2t9r6Tfu0o8X6KbjsJV+J0Fd4TVBpCXR85mgeysyZbPFg6Bw8yDE811Fdr9HhMY5P7qN6rEbBw6jjU0adYFjhO01ng/bH5mhBxlWSYbqu2BMG+0TPu+FJHDai3MArjclhihkShFKcthLVVrByEMfKJu1qVsjRQTGrKR8kcy7TWtaDqJNP7fKouDaDqFWrikbKx7kxtbZaJ3q7LxngvF5iDLwT0xPA4Iua7CiaU5FO2P5cGGtC2ko7ksD/O1SmOVMZBf3RoTa8MNtVkJzkG1oVN8WscpoV+EMUx72rhLpe3IFMOXBTtShG6ziPnNunv4FrKZCm2qnMUvCf1/Pl6TO/LaUdjbUG7dpbaHs9Uf/s5SciT6wAfiqLJasa4wwe5bOaqJ40+UltolhmXXIpnnv9biHruW767UGq7trIvWXmjgbWyu1676QTGjRs8OdF40xP4yCLgNfx4t0ESO+Wij9uUsdOs0w5eUwnrmKdiZfMqjXnTmVfdGWwlfVFpkkqELRY8GOWUdvk5Vtpz/Bt4pePPePakJGjSiQj0cNbfcH/Qmi4Cysi6Bx/m0+5P3q/z7Er4Fk8oKpgYtu4Kyqs+fnK1ZPXQ93CCSUBF75v+aMToAubXqbLX/R0KL+OXI2LyqUdqsitCCc432LDMr5sRjHTTDqxskiJcLUK3FdbH96Jt2fFondisBjFZwBY8G2lUbTwEyJxJ5w2l/stqxh3weAb5qOn9+RPKnXAaj0ndSxD94kd1sTchhfkhUtYLJwY91tKbq0JbUHOzTCQsX5TwMt/ptidT6YWs1M105tWnsoMiFNrNSx9zqf7Nszx/3CAhzUAog8iLpqEdwO7O2ZeyHqHf6+vfDiVk/xSZg4fJh3037ROy349El58f430hW8zQlnfCpmOJ11UxMu+iCtwxxWrVzuEcPLkey8BaVXecwZ7JYYsYDbMdaU8pUyNALFbB0QYgsAM4Uuj346xWHf/iQqMTzDbjYxTgNfIO/orMZ4z0YvGF5ZB3rWTEgisj4Dvt9Kj58vkcrxoYpKQDYLB3LIUJ3is8fGonquYaLFIoj7Ut+pi1UIHKu2GUlXXHyh8lDvTTK3ESdcNrT+yam/MavDNSqnJT4f3EP/sfKnEbXmrV+P75TzowwyaE1WcsYDOYQHVa7Rp84HpKiL3PPixD41JQjZBU4zTLMPj0//iXgfHxRdGXimtygQATd4y9hEGklPOxjd94s2XA5Li+D5pYnocjY+aeI4/eBx5Ww0XzZAWp5oqRa0eeHAg/BfEEyhJ9KhbisuXSaKqD3rr/YjvGTkHXWrb/UCUI2KeOYoEeBxy/gYCORBHPkuWjNQgYBAy17Q93YL0QauUM64HE/+cX/onDuU+8g46bm1xVTar4f2o4kUWQ3yod3uox1ddnOZGAz1zyiLROzWsDS52ELGlsXK9Q7MloRaU0s6F6c0QWQKUADxPxlXK6VSwoaxZoGGPldGHKEMey5uJdEnhZwBCSJt0i/codVQqWDRQ45eMyhLI8swfdgCBGYlIo4WlsLjHPoqYTxTv7516KAQjvA5id1jvzA+NSkECKUB13k1gLjW4CuoCi8h2ljHWi/Q1o2g0YnY+ygw4qtNT0z7h/QNSpU8l9KPj1r77QLo02+4xuQ4FBoSXioxbEvtw4QYhdsYxonav9mfWq0UdKM+Cl7rNsZ1oUqfBpVfqjujRSyn3mzeByZ7xKwNtd5agu5XhXsnSicJLjv9DxB0e/Tx3cLiKEOVLcK6jJ4Ckv1bZz1+zbU4ddLK32apJQMasuIzStuJhJ1WAwODOvEfiSVRXs8AilZKxj0gyqr5IEkecdW0/hXKgNKoQ01QqgN1T5r0LVtn0ZnNHj+KJQq6NF+VN82bIX5PGYgAFsp+QkYS1p/2gppOGyb9S6Tr8JhKdBQcFwaVMsi67Yon2yHQVYIztUv6I6XdvbeRHe41mqSfZP3Oi0Kg3zD8vP4tof6dcvppJjzpBK8hmkYj/shg7xvnS2wA8S4n1vNjIzyi6UqksjurxCWzgD6B1s8JzytVK0vkbKRD/gMJg4CrRnptkM1QCS12j21GtpwvTkj9rgPUA3TK1C8OCfTflIw9/a6XNnSepspJkqioS/Q2YjM/SP6mVlIgi56yaIPd1F21hONSWioQjLkk2E1P2rFbtfXKMWy48u2MfwZWsn4CA2pb8B8gc4ZqDm2/8LCvnGwTFu902FnpTl5riZaeqPr9Ggjf+gkjC8NeY+qV0/VgNw4ZwNzGjmNbMJLXmZIjZxZG+y+Yn0GaZQRxP6zNj4x9IczGyrui9Z/kv/S9z9AF0OfBeF6WKfHN8HpDKPJJwErMYd7LoJEWsHZp5hnIRfHwCUWkMgzuuKG4zRZ10PnhY4fjJiz3HT7anJtyv8VWlUh3lfuvHPjrBxNRf/DiQoH7aj3lSXTAE/xbsszxvyNSpPToLaek4c3ceJuyNt8vNWzmVYCTsb2zS7TBHvd1uRklHh/IunOCZe/N2Rnk27ktiD8HqRywi8FjOUpzWLKumcD49KeLwZ7IHZlucw65u1xDhQf2PA5kio1Hq/NJ6W9oF6WWI3qYTx6vLsCwcKJ1HZR5k9e6HLfj7hbnLz50fQef09cm1ypGYo5SbycRyVoJk3zYdChgRnMcJbk2kovjNynVMOzZfRVa8a1o0GABPzHlUvMfnlmavaAC0LR7HmjlOkgdA97XzbdIilkMU53lONoSehPM/qIKOmcI+jUDm8mgz1K6kfPDyEAeIwoyxfQlhbZDdCHvVMsv8dZpGnPQUBZ7sEnqPKheQI0OE95D/bQ4b+WH54xAy0hWPiSOwASSYLP4f3m67E/oom7H3sfNdT7A48MPwMEpzaPDjXLJbM9S0TdSHV4x03mnC2AqsQMGvJClb8TQaOKAkswiEoRXjN30QfMcnG3UJf+H6yJswvNKLwo6NAvVqI4nIieYDFh6h3GexPcibbuNZgCGRUs1FHkPzRxWH1wWq/ucgzCbI+tKUfcVGJUUPJh+OjAkEd0Egi7dWiaj+hD0FjCo8wbCE6SmC8/ltriMVBxNpLv98vhFeqk9+opYasKiNZdDAMub3Swjj4ir2Lz03z3G/piJoBnI4/QYyTUHlaVBVLrNMYGuAT8UzXnjwodDTFw6E2CUzzl3aD+oWy4nVE/c1XVXiXZjF4zlSV+UZ3py5qA6bz7jhHt4uq7ECAJBuGj7IobnaDEpNndKL47dLyMqUBjGPB0izH6ya/vMZ4ApbSvjTMp6GqiM2qKTfTkzaZRAiq99PACgyXviBsm903CeI6XL9Ea8mWESb5cJscWA85pzRrXgesZNXK1Gu49el5fjYkJfZUVYcCZ48HhOSsyVrz572y9f99j59eKmzZRExM01aIK4Lp6LSp18IiKOVgcRMFBXfy28IfkB+39uk7/58pT81KCogmpHw9ZRXeuVA5rxUzHqwIRG7JRroo3FpgUKeJXn12rfhbBpiwIUjzN2Y3ac00h7LDIz3cQQANewdW0RiSfP5ixMA0m6ewfG05J2vMw9TufqLqEh03O5n46Hk5sr5ANJ3lrGDxHjMYPtnypK3bKGT0fgdJIotaSlf4UCa1jl+DyHRci2rpKgcDUcRrRm6lMAICf46iXMK7oGKtVLWFzjl7+DAv9onQ58bBdIlKXAv96lkbVzOeXiEnOx98vzbGOfBVK/yj2C5NxNfd4u4ft3QYjfVS3L4R2q7Nd8M7S1SxC/v8kGF8W7JOzcYTPvTAum9gHmnPa6a6H/ba2eACx5NqgM3j27sdQldK88fQ3/6iFBURkxUElDjj/4D3Vaw6U1Vdi9DEkMQI2cbEafbVmmk5gLhrBgXBD/QVzscsN30fmsKRIDqFgY6Z5KCuPF8Kmkl6fH2J+RjifP8cIb4OQyztWTYH/pXZDcJfXhIYn8VGRhHp0+s6tqXiM5do5RI0Tkm9C2pntDCGLvbUFFB2yuyiDlGvm4Ym5PqC5hEcCQSRgitltmAhmn5xWf4swYYqonrOWFJpPH3c9ZHVbOHJGcGGRSVftYhaCGwSSNGKsqNtuoE9fbpSlGS5+lllr/6vcGe8/xeLjnDAWBbiTzBS1YOxaRad8QHUW65FaUm+YyWGvHeDkhPRH1OBIt9GG9qMr8S6k4/jbn/PgObM8L8IoBUpkY32PCkSea7vjxS6uR9xGmGNKQI0TgcZAVA+rO8g1FkxhIPDyMCTZQsRr/YY7FsXurrUmqM+kTe6E/zibKFj0+MGz4OvXWXDt+RHvzSE4+yil39Kf3nZuERc5YGio132TTlpAvgztac01DQtCYXQKoXiTSlTOziH8hsfOAn4Y6Son6Cay5Px5fMgO2fpHLeN4V1Tt/ISCmyvakMLBOz7L+tjNvTeWYP7GNDEElhDrmmYDu645CHNrFUz3SXI4kZ86gZylURZe2SkPuMyQnWbW20j9dPrYfeuUXslSSRvqIFsXYdDNQP4ggYpZCQ6WqOZrUOhfS0lsfjIrW4pFcZmIVpNn1MfzqsyP45Snx6IkJrm70rZK8bUrgWi2OS50yYNmVnRbRe/57FFrBXEJZoT8kzyinyEDBLZ2n41NlIeM4RIFWbZmgABIzHpNZoUVQagC6DJQSCRX8FZ5gR5xtLDCnrZjqIAClk40MQfmyWkuMgsSOLbllt8cRXlMMoBuXsFJFhJ+XQJTs+TyCzkcZFtly6x37nJy39cHjj8pS+NT8gJpgEt08vL25QRMTetZQzt8KCKMvnhJrZqGztrt7ZohbFu8rCNukyVO25nPYvV4sPSpqc+epWc8c5zS+PcUPn8jMGr03GZkQclukqXfy+3iIrLPV69MMKg9CCBK5JCsOco4AkebpSMhT6TjRvob4rermh6Vovxo801l1rrmaDYequrylQRPmw2EhvUHsufLEiHFk7lga9ZYNowEo5aBlrvwlkW1gt+gCWpAkDenxh6XwWL9hGDfJ4JtWjuESwTi8976y0fKv0J5Meb+dZ1lL324DnaNh1j3tCkBnjXGYIjBOU/TNtcW3gOmNAJE6H2ZHavdMujBqAj2nJxMnqfHtjluWnvs0G49mx0vkQmL3wLMe09zCRua0PcP327e5FWUJv3dDQ8uo272Lq16vxpt3jtxENmKZABNk/h0Sv1q1px6sE5IGwXPTQo1t7wowmHPvQKjPOqHRAgEHOTgmm1LXfmzr5NUIUkcxb5NCDcT6B5zRTjmg9Xq5Y+kliyoelcC1dHCMM5JQxRzYur95odGTM0HpDGTrHmc92g4qpUTAbpXj2wYbo89wrunHUUWUIXMAVsSCFjET7nqibVzxYGEMFAcZtkh5EWaylCA4SSXUurcvR9O3ioUknIY8TxMTj5yKbOygtgQGjqmJl8xn3vtybWvXg6TsBjiEIeNZ+NYd5f7vSFoAj0f2S3ViDZX2cno7hdDJynSHzpC+hLD3wRHXc+H18kaBtkBiSts8mEguFiGOM50n5y+nDUa4V2Hvb00RFMXLJPqf2dx/MdfttqGxabDeAqp0HqV8QW930J9uOVleJhI5QVKnuxwI+V7lFOzigzKX9G5CgroNcmG0wRL0TwVRaa2CKqSOvVGqFuMDBdWrxViHpLsYj7DoIns8Q1uxCAae1qmkOvofeiVWZGoKuqXH+vkQgrBooM6aWLpeakgKocgRu6WeTzC9Kx5XJdPsTRr9hx9c3r8EQOfFtx9SaJeevSeHmk9nst29+lQD16zbvHz8NY9l1/r03iHPT5YJN0DrFZlYSDEpkZVsUM2r5PZNufl0zzUA26LXNqqXU8RU0x5ICOJtvn8ojTEHZTztTDACuuXOqEIQwFvTO4FWLfA2714w+AqmL95njfz7OtzqyMcdzC4HqM5MjzPYMROV3i48mRj7RGa9nAPhJv6wDHYlL4AicYEkc7TjNLkoy+QJXbYyTNhyTqIcW69EV1QfX/RSg90VeTYoC/cu7FtZJkogu529GXx5YgFJKLI0UdHUztDzJoU1Q8/irk6u0p35A+++yJlQB2uaRK+Qc2y+sqz3rTbfxio11xoX87ppPtmqPwpZXTWg7M6xEtKpsyuYVGd5pxZDXlTxz3Zgs99TbVmvFyzZ8tRHDtn4rGoF3WePgoWDg9yY5HfofLq/u365+yd4hZDEjnl7GX4/1ZLh7xGVxhTDqB7tcPPD1SZY0Ub1HA89MAJgqmYW+ipFU1Clw305l+dwP8p0aJK5cIxkM0in++p6gxbg2K0gWNRZGuh80n4HOHT31DsBqU8LhwxQMeUvWGfxYdZomi71fuCq97Lq9+jeebQ4WyEzP/6sMRmCJ+AkqT4+uEml3saFHx0I53Ya/Mm96CHzEyIew7ivtwBL8RoabK26JHOh8jAL8JCV93zyauk90wNYsGnPOl76CmrsxiSnwY8N0sfG1XGUDMv4degXreER1RPKz3JiOhw/AbHGRHBVwMe4Te9+RCSZgKbeXHoVgV3O1IIdCyICwgnvVxq+QqYGKv+lI6MHhQ5ETt0g4RPBGhngFkNml81BCGKFqhX8y1PNt4sJ+y3vUTWLTKSsBAVTgqYz5/67DiZ4jmwojpZYjv6y5veMq4W/ecNxIqjjGJ7LEzWG7TYqIGJ/YywEouELHqlcbGkRxYY3qMWAJxYXhbxHQtddx6XXl+ZVmsHBKRo0gJS6RsjmqgyGEesSKjedeHCGEeeCbnInSUA1F6VsyOL3Wc3pXl8VVpEnO+Iq2krBx/widJDA4tuHIKPwEmCyEbmiHki9uDl8URav4AOEN1ky0bfytYPdrcJCvjZTrvm9TBkdGVt+NVBkUs06pLmUwgWukLFCtDxxSWgjLW/4ZU/7nYWbm1rEH9NnwFM9HvLO5yWv3362RyWl+L1hN0f/ikQC7D04hfaszb4npqKMLbox5JG1XgcMzix3hYAkff/ov/4TJR8NyzbxPobAk6SIErB8xK2lHMRTgO8GOMx9w3wSZoWMzn8RMezoNE/NLWDJ7vTm2uAUf5XVTSSpyUfvUg+u5utyEpLa1Ul083JKxO5I5hcvQiT7HggosqKyXRyRpqoBMnOr76sqni41d4+0WJuTH1jSvj9d9Dc8viPHOm/G+1+pXvOMrJ9Zqmhh1sHKnB2+XaBngwNuuC12tIA3WPyYUmWOGgCJlcBVnA8z3QyhMTq1KfOFfN/oTgiBWb5Hf02NwEro2fhqJgrfYi2LnDjhA6Jq5vGd89WXU7x6DBZr9+BBuZIO1WK20OtiYmRSSxjAxZiFzwDiTjLB9GPzdoIxfCpmdCbTuKAuMu1aILr/wzlwP418G2lnQbn21+oce6ZQXOFQgzeOFhjp1m7DzZzpFS9duh2oobBxEu0+cUkmuM1H8Lp+GeD1Dpwa/qSxJXAYfJMi9HNYmsvpDHvgRTZjBXKLYsgK9qOweiJ9376QT5xmSz4AStveYYvb475ZfXKvOKxyZPIZJeFd2fzEpcsDl+w2KM8SMB0A/rBoQVQHy5IIiU4VM1y3Gm5h729VrUvA5lXRMxRDMBPhT7ZJqEHadlux6WHenhdKUjYi/TnbK6nR1ORCxb+V4fpyZbR+ZQ8tanxU4WPfMPdaBbXNymJTlechHbI4PRfMhyoNpQ2SRgJJsdEHJ9PeGRXyjhpQD4QSaebyaX8NSQGNrfSkf5gHL1rZ7V0Mw0gINGr7XfHAwSX35GAXAENOVU3CCFZTuGgiBETWJIBDxBI3MlDrFvWSoOttYFOT0dUr3eo92RkSJP/hG7CSJ10hLAQKXwB4Qy4/bHeuJSM4aFfxsjb/c9+NQjThhjSfHws9tINmTpNisFl94n1iWndC4qBlZZz32joogFwC/92KamHvqdbjW+1O2WjcN+SfgnPuXUHWJ9dGXaIzdVs/eH/ZFv+OP+KueaYF75EY3HhR1uqDUNfflPAl34b+6YmJw7/C8W9TUQGZcyVIsPybZMw06zNbzAXMS4k+IMrsafRk9yu/7TBBPUUfVslkeMxtOw8skd+UEWzPHZsTScbzoNAVSkw4yyV8eCDIvn3YZGgbtVHJCorH4XzA5LitvJbUnGZ6wbNqYhb1Sq/N/+ZkgR2jjBKV2gjoEUBHfvZoyDEiGvdgM/itn0ec9FE6nvhg9WbhnnwBmX4Yc0StL123uy6usWaBuwT1+UWhz8Qx8Ve5vmwr5/2bDkK5oDAnfIMja7pgGFzL7yAxPBPRZ2uF58mvRnatsIp7Nijd2AJUUF6aUFiaQKjNBWQgaD59n3xIMl8VEYb8WvGY+6ABzWjK6K1DCacYaqQcZFNXIUzq4VGXv5y3rPav53SGpvzur9TW8WTIHzvm0EHvkUuLQGGZlAxZ8td2hfkekze2XnwehN0uxFrVfeGPTsDC6zlU0DtaOLT1Nts/Y/Po8V9Fyj6VVdhqijT6ri76o3keI7oRU/kvckMHxKbbdCP3JAUhUP3z38+CCSH/tc6nGEMlszvvralCwLGyzXOZlb+LKF5atSW84aN13Mff+LITzgL1XJQRGN6vE9mQKVHJOrK3evXktZUf57Og2aHRUKSxhaeFXs6Vb1g8c595OBmMzmti3w5f25tTYDpIyC9p6bAlTyXgB6AyltkQhdBHb3u81dccdkeZT2xaG4J/Iwyz/wZLfg5rAkI3cxZi3jFtbxoIYiYtH5RvljZyLHIVWwiQlmEg8XB+tRE4NCRWloZ1J1Yha+UEXOOwepAD5UYFmeddOqSRun8LKgYQPWlVuhYKFomFiRlLlZ+f1314hwKbAKNECvgPbgdCVVZgkyYddgBIlwp4QSIXqEeBVTW+FTff79VUCe0GGsgxsIoIrbNWidbWTSE3mzYw4G/3U2B470TTBUP3M0Q/6OggqH3fVIvII5J3uR2X0+jeEctziHfxtA+Dd3xZiSt92zycHzSMKft+03i8/55i+ZFdcWifU8A3p/tSufK37Ux64XCcpEtz8U9ZqpRY1IJPHJDqAoeOClDNwWvuMx0vT0T7t5ruOJ0Y56pVVN1rWZ4jT04uz6ZnwMD93KSlQGWVbosN0JuiK+nAzRjBPfm5z6ZWX0znfa7dDDfNANw7xghtlM3j15w6dPKKvMYvZ5lfOzjjWJEU3eSEjFNInf+KpvUfGB+ZriC4d2aB+HW2hM1Rp82mwnbcALE3s+pNVB6eHvOSA+6D5CrWam4DJWOhLRT8CpgpQ2CTErd1MZ70HHNze9erONIckVKWp1Xv7Kn0iStgXwRC516ttkWHdkaItdAgvY1I++8UUO9UfE2hbG5fVcwRmv+MZy+WXwUeiuDmH3S9U9YxM6i54uY5pnPpzOHXwrVuaU5Tz8q5HKiLgmZ3i5kzYshV1WWkRIfv1dBw80e/fwkk0xBUFDeKeQnbitJE2OcezY8H6BLMsLLtI9uAPnkJ/JarLZKXSqVFY4tiIpEnegvvcXsAZT94mrA66BMTZ550fzpX4+OSIibr8eOFz+j7LMBU933ysU7TYJv+HgcuRNXpZDfhbQrtxZa1/CFEuXkDhC7WQlJvv2b208d0YOcfY4A+OvYfSpxZ+OxipAn8KOC0jIHc782/uAn2VyGSb5iYXDsQfOzWTCpFZwSJ3jwf4YfDt/KaBDPpyG7K59+me/0aBFMbwCwdeoZ3F7dTeiw/zxhG7jhuOztzRQjlqymHzlPclNzQWe/WAfnGLEXPV4N/3jvCsl/opZ4SPaqVnMCYu+rC12Vd3pQaT7J5vk4j2uCrjdbl6uRtkD7p7IzQiTlDGQoAI7Z2NcVlGl0Na+rTtkIE2e5dzBz7x+JIq/Rou4suqzLspl40ofabSJyJiKGzxXNnjUd9NRMKtqHx/14gBpmGpSF/jGvsNxhJxT4jo6dTL4ZN/0/hOm9Z2b4ub2K4LMmj63W0WO5Sy1krIyNtq9e6Yx9YAAJOBAArS9IHCmK3Mv8quC65Quy9eRWzI1JDANdGYhgIsxGqjHdE7qUUocpjOkRluaW+fN1OvMnHwLpoLzU5pG93ZzUeiSZJs3wEB5DnXE30JQF9p4PlTgQOooN+X8dGrDhIbrAGqAngYIZY/bLvpkKLmIinbMfOfyyCHk5ppIuarrnnMiuu+aXsin5u9x3weH2UTiYhimv0pR2o1BPLRITPe4Jgxt5so8bhnr85DvbHypQ5o3+ooTCUrzMl4UrKxM+aXpCl6gpQ/7umLfe3AJG6gKyo5DrKY8Nl4pzZbDI6twEGkHE2YeWMB1yvvRSXE6qdt/LQo60pu0Ad1r7cZ7t3hMrMKtaJAcuJMmcA6ljn2R3lKFT92ft0aVt8vjRewKrT7coEOdh5aY8w7P3eNptrJvF070L89YaT0Y4nSzWfrdNUDhvzjgbReFZBh1/Kec1zaFkNC5X/v/YJcpLaGnzVu+crGt2LMlJVQF1owG7TIVtqRx9tUNhwmQQPgpFeEYYEk9QnsYh9f9qx59TLrw36qZtL5eBuxRYL/d1aUceqlNM+mr5uHaN7pbeSnoCGUovw3NKQPsGnwCXwbaKt2ggewl8yJtfu01k1jGICaZd+FZ7A5bf/vHgVRDSr2NR1kxjSXjt1p1PfOfv+RocQgTpBmZMLURciADSDHglo/mmjvMuwCUM90tCPft1g2vuvfIzRxu6cEO/fgrT516iCYGmvbqaEivi5YDHAtOxwD6F1IAAA+6WG4FsoPvYYC7/qqEfZItCXLOroVcYSzFXOjicXvRZiGPxk1ScTM/rjTQkQABkbl3+6k1VIufnnWe4xWjLjyPoI3VblM1qby38+lQA9m4DM0OCkzaSdomW5Smtg+U9eFcklfGiewCRl70VSj0Fihmtp8KxPCya77Uk+XFhkIYhSzqw6jn3oH7QxnuzllMVWrx86RDI2JOf8fifKzjUuhX9ptV0s1mBf/+WJqN2Asxlg+JuIqP/YPjLMiPGKNDaKaAaToI9tgq5C6lzNwJNCZuk5t2Pnlkyt/swdKH3EhAVWGsAyeqYJ5b4ZtHNtBu97HCa+NlWbPVuXw+XgROa0oCNdrwoIMDr9tEUnqw4hBx+rsXj5UMAoBM3xULQZRvP+gwRIe04FHNWwipYhP02aUS/ZbzIC/pDKYeO3OgeKLpc+bOQ98D1xvccVTRbmKvnFsn8xoWVq0w7CtMEgBVusIToAK2O5VZve06333fOz9ynuhoHTGZIBEoi1D9W6JD1W9s7XjKs/XR8sABp3HLfQEHO9EZFTMPlzI2CrnMzS71lSExDgEdzwAAAw4//HLJl7rEi1tYQbdIjeVp/eXxVSK9p3rTLt/dkpEncxpbbQTNzN40tV7boOPcjw4AMVY40sHDc3NlXE0ORGWU1UClwmpXOO6yXxU/nFluGM6R/fVNFPFlZSKMvSM4WitMB5G4NlGS1qlNYIKAA0IMEq9H/eyiub5FDbqt7U8gaffVcGKKmkfBD+86OjIp9DRqXAvT6DLbAWaZJgFmyOGSnESdbhjnNEOFBVSpJeybvjYU5QpYlKom+YfyYGnfacbpbSoZBoQceCmzt8z4hlWbt+4AuK9faMSSsNrWubZA7CkdXv3sxQHVwb4/JPTvlP9BxKg4t5d+uMMMnuccQYdvn44Yj9FPQqwiVAJB8gWsqrFKbkqKhE0CgYSPPPpxVw+R0IhTOpLbh7+f0pZY+bzPFE+X9ZPehi54gKZRYDJKJ15pqcWv+covcHxhinaHJq/0zP8eIZDLWeZtFqdeRrxvUaBMlo+I9f7WF/z7+e1z/FoBcsY+WxHOyq6qlTGgpHc6HO/k/KMhEqTKvTHbVUPj7NVUXHjiAArJMI30vWLeyPk7i0DH9ALQTZxe3lVUXobD6Vf9p/Xv/T4Jc/tipNS3sNy8b/KvBsCy7AbluGs4yJhcQzn4TzKIWO8CJ37HgStvidn++y9Wfz7sEqV18CKJHwTUP/9bM4PrlxuiYFrPp+oz/462+BsSpL+RensUssE/7p1yDfuv/5Giun7Y9WGdvGf9I8SLKeJN7fj/w3T46GoyvEXLOUoLUd0uJvYbbPbkMdMPysQPcqdGxK1zTlia3eV95djKdOz5rDgT1Eev8l40ABly9pj6WVa3dx93VviutvxXrJg+Nmj8FLghKvADVBzp8pkWJhbzh6wdvs1OtCmNT7PjUXeK9T5MJpZtk0vge38KvdvNy+5fjP68szBb7A76RzwIMRVYufaF/nEs7P+54RiXMHEc8e2Vcb1j6Ffn+nco+iiQ051xZh66Y50tgbHb+KUzwCTTCBNdDw4zCbsjh3djJlxqEk1S2lW9iWOBkhgxaUO+Rw+f+TaLZgZW3pQx3Eg5H/onAB/4IH/OgvXdvyGdVktt8Y//G4kMb1OiFc8/7FBKjX7GMSld8FqYoDd/uMFq1gO/yIpUuxNR09d71hHRcq3GMdhnOf/1siWxCb2Pw20HJ5tO55t7LXNvY7RsOzt1f8D9yG9K6fc3b79pMBkenW6dELcq150q0yDL5LZA89KE3nDKARF6WufcZj5SlnghOjeH/GE1taIHw+7ql45/0PAfHsVi1/hiTfLJlZkts7hrjPUdWQgXp8ecrDAe5h0t8nSfeshwXzVVgBcxpaVcB/hpqma+Asb4W+EqH/6i89YcWeNXr3YcMzrNofjhm1+V6qJBg2atkb9DFPlpz8W1Ol+B5f9XGJFgUFEVzB26StgfCmn4SOWG1Lt+xzd3TwefO19Arn73Ioo5tlTsWn6ESuqLIpOksHk1/D9Ni8Ga//Ah3tgal3P83/79kXtXjdkC5uV4v2mV2cuw2chTwBsWkMHom+l+VOtNzmWCIAy1QkGaLf2DeMOFoAAAAAA==",label:"Spider-Man 2"},
  {id:"avatar-11",src:"data:image/webp;base64,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",label:"Avatar 11"}
 ];
}
function resolveAvatarId(value){
 const raw=String(value||"");
 if(avatarOptions().some(a=>a.id===raw)) return raw;
 const legacy={A:"avatar-1",U:"avatar-2"};
 return legacy[raw]||"avatar-1";
}
function getAvatar(value){
 const id=resolveAvatarId(value);
 return avatarOptions().find(a=>a.id===id)||avatarOptions()[0];
}
function avatarMarkup(value,name){
 const found=getAvatar(value);
 return found?.src
  ? `<img src="${found.src}" alt="Avatar de ${esc(name||'perfil')}">`
  : `<span>${esc(initials(name||value||'P'))}</span>`;
}
function renderProfiles(){
 const profiles=Array.isArray(session.profiles)?session.profiles:[];
 document.getElementById("app").innerHTML=`<div class="profile-page">
  <div class="profile-page-head">
   <button class="btn btn-dark" id="profilesBack">← Voltar</button>
   <button class="logo" id="siteLogo" type="button" aria-label="Ir para a Home">STREAMDRIVE</button>
   <button class="small-btn" id="profilesLogout">Sair</button>
  </div>
  <div class="profile-page-body">
   <h1>Perfis</h1>
   <p class="profile-subtitle">Escolha um perfil ou adicione outro usuário ao seu acesso.</p>
   <div class="profile-grid" id="profiles"></div>
   <div class="profile-actions"><button class="btn btn-red" id="addProfileBtn">＋ Adicionar perfil</button></div>
   <div id="profileEditor" class="profile-editor hidden"></div>
  </div>
 </div>`;
 document.getElementById("profilesBack").onclick=renderApp;
 document.getElementById("profilesLogout").onclick=logout;
 document.getElementById("addProfileBtn").onclick=()=>showProfileEditor();
 drawProfiles();
}
function drawProfiles(){
 const box=document.getElementById("profiles");if(!box)return;
 const profiles=Array.isArray(session.profiles)?session.profiles:[];
 box.innerHTML="";
 profiles.forEach(p=>{
  const d=document.createElement("div");d.className="profile profile-manage";
  d.innerHTML=`<div class="profile-avatar">${avatarMarkup(p.avatar,p.name)}</div><b>${esc(p.name)}</b><div class="profile-card-actions"><button class="small-btn use-profile">Entrar</button><button class="small-btn edit-profile">Editar</button>${profiles.length>1?`<button class="small-btn danger-btn delete-profile">Excluir</button>`:""}</div>`;
  d.querySelector(".use-profile").onclick=()=>{currentProfile=p;renderApp()};
  d.querySelector(".edit-profile").onclick=()=>showProfileEditor(p.id);
  d.querySelector(".delete-profile")?.addEventListener("click",()=>deleteProfile(p.id));
  box.appendChild(d);
 });
}
function showProfileEditor(profileId=null){
 const editor=document.getElementById("profileEditor");if(!editor)return;
 const p=profileId?(session.profiles||[]).find(x=>x.id===profileId):null;
 const selected=resolveAvatarId(p?.avatar||"avatar-1");
 editor.classList.remove("hidden");
 editor.innerHTML=`<div class="profile-editor-head"><button class="editor-back" type="button">← Voltar</button><h2>${p?"Editar perfil":"Adicionar perfil"}</h2><span></span></div>
 <div class="profile-preview-large" id="profilePreview">${avatarMarkup(selected,p?.name||"Perfil")}</div>
 <div class="field"><label>Nome do perfil</label><input id="profileName" maxlength="30" value="${esc(p?.name||"")}" placeholder="Ex.: João"></div>
 <label class="avatar-label">Escolha um avatar</label><div class="avatar-picker" id="avatarPicker">${avatarOptions().map(a=>`<button type="button" class="avatar-option ${a.id===selected?"selected":""}" data-avatar="${esc(a.id)}"><img src="${a.src}" alt="${esc(a.label)}" title="${esc(a.label)}"></button>`).join("")}</div>
 <div class="profile-editor-actions"><button class="btn btn-red" id="saveProfileBtn">Salvar perfil</button></div>`;
 let chosen=selected;
 const preview=editor.querySelector("#profilePreview");
 const updatePreview=()=>{const a=getAvatar(chosen);preview.innerHTML=avatarMarkup(a.id,editor.querySelector("#profileName")?.value||"Perfil")};
 editor.querySelectorAll(".avatar-option").forEach(btn=>btn.onclick=()=>{
   chosen=btn.dataset.avatar;
   editor.querySelectorAll(".avatar-option").forEach(x=>x.classList.remove("selected"));
   btn.classList.add("selected");
   updatePreview();
 });
 editor.querySelector("#profileName").addEventListener("input",updatePreview);
 editor.querySelector(".editor-back").onclick=()=>{editor.classList.add("hidden");window.scrollTo({top:0,behavior:"smooth"})};
 editor.querySelector("#saveProfileBtn").onclick=()=>saveProfile(profileId,chosen);
 editor.scrollIntoView({behavior:"smooth",block:"center"});
}
function saveProfile(profileId,avatar){
 const name=document.getElementById("profileName")?.value.trim();
 if(!name)return toast("Digite um nome para o perfil.");
 session.profiles=Array.isArray(session.profiles)?session.profiles:[];
 if(profileId){const p=session.profiles.find(x=>x.id===profileId);if(p){p.name=name;p.avatar=resolveAvatarId(avatar)}}
 else {if(session.profiles.length>=8)return toast("Você pode ter até 8 perfis.");session.profiles.push({id:"p"+Date.now(),name,avatar})}
 const idx=db.accounts.findIndex(a=>a.id===session.id);if(idx>=0)db.accounts[idx]=session;
 save();toast(profileId?"Perfil atualizado.":"Perfil adicionado.");drawProfiles();document.getElementById("profileEditor").classList.add("hidden");
}

function deleteProfile(profileId){
 if((session.profiles||[]).length<=1)return toast("Mantenha pelo menos um perfil.");
 const p=session.profiles.find(x=>x.id===profileId);if(!p)return;
 if(!confirm(`Excluir o perfil "${p.name}"?`))return;
 session.profiles=session.profiles.filter(x=>x.id!==profileId);
 if(currentProfile?.id===profileId)currentProfile=session.profiles[0];
 const idx=db.accounts.findIndex(a=>a.id===session.id);if(idx>=0)db.accounts[idx]=session;
 save();drawProfiles();toast("Perfil excluído.");
}

function getUserNotifications(){
 if(!session)return [];
 const account=db.accounts.find(a=>a.id===session.id);
 return account&&Array.isArray(account.notifications)?account.notifications:[];
}
function syncCurrentAccount(){
 if(!session)return;
 const account=db.accounts.find(a=>a.id===session.id);
 if(account)session=account;
}
function openNotifications(){
 syncCurrentAccount();
 const list=getUserNotifications();
 const html=`<div class="sd-notification-panel" role="dialog" aria-modal="true" aria-label="Notificações">
   <div class="sd-notification-head"><h2>Notificações</h2><button type="button" class="sd-notification-close" onclick="closeNotifications()" aria-label="Fechar">×</button></div>
   <div class="sd-notification-list">${list.length?list.map(n=>`<article class="sd-notification-item"><div class="sd-notification-item-head"><strong>${esc(n.title||"Mensagem")}</strong><button type="button" class="sd-notification-delete" onclick="deleteUserNotification('${esc(n.id)}')" aria-label="Excluir notificação" title="Excluir">×</button></div><p>${esc(n.message||"")}</p><small>${n.createdAt?new Date(n.createdAt).toLocaleString("pt-BR"):""}</small></article>`).join(""):`<div class="sd-notification-empty">Você não tem notificações.</div>`}</div>
 </div><button class="sd-notification-overlay" type="button" onclick="closeNotifications()" aria-label="Fechar notificações"></button>`;
 const root=document.getElementById("modal");
 if(!root)return;
 root.classList.remove("hidden","modal-player-mode","detail-drawer-mode");
 root.classList.add("notification-panel-mode");
 root.innerHTML=html;
 document.body.classList.add("sd-notification-open");
}
function closeNotifications(){
 const root=document.getElementById("modal");
 root?.classList.add("hidden");
 root?.classList.remove("notification-panel-mode");
 if(root)root.innerHTML="";
 document.body.classList.remove("sd-notification-open");
}
function deleteUserNotification(id){
 syncCurrentAccount();
 const account=db.accounts.find(a=>a.id===session?.id); if(!account)return;
 account.notifications=Array.isArray(account.notifications)?account.notifications:[];
 account.notifications=account.notifications.filter(n=>n.id!==id);
 db.accounts=db.accounts.map(a=>a.id===account.id?account:a);
 session=account;
 save();
 openNotifications();
 updateNotificationBadge();
}
function updateNotificationBadge(){
 const badge=document.querySelector(".notification-btn b"); if(!badge)return;
 const count=getUserNotifications().length;
 badge.textContent=count>99?"99+":String(count);
 badge.classList.toggle("empty",count===0);
}

function renderApp(){
 if(!session){renderLogin();return}
 const selectedAvatar=avatarMarkup(currentProfile?.avatar,currentProfile?.name||session.name);
 document.getElementById("app").innerHTML=`
 <header class="topbar">
  <button class="logo" id="siteLogo" type="button" aria-label="Ir para a Home">STREAMDRIVE</button>
  <nav class="nav main-nav" aria-label="Navegação principal">
   <button type="button" id="navHomeTop" class="top-nav-link active" data-nav-home-top="1" aria-label="Ir para o início">Início</button>
   <div class="nav-menu nav-menu-categories" data-menu-type="series">
    <button class="nav-menu-trigger top-nav-link" type="button" data-f="series" aria-haspopup="true" aria-expanded="false">Séries</button>
    <div class="nav-dropdown" data-dropdown-type="series"></div>
   </div>
   <div class="nav-menu nav-menu-categories" data-menu-type="movie">
    <button class="nav-menu-trigger top-nav-link" type="button" data-f="movie" aria-haspopup="true" aria-expanded="false">Filmes</button>
    <div class="nav-dropdown" data-dropdown-type="movie"></div>
   </div>
   <button type="button" class="top-nav-link" data-f="recent">Mais recentes</button>
   <button type="button" class="top-nav-link" data-f="favorite">Minha lista</button>
  </nav>
  <div class="top-actions">
   <button class="top-search-btn" id="searchToggle" type="button" title="Buscar" aria-label="Abrir busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="M16 16l5 5"></path></svg></button>
   <input id="search" class="search" placeholder="Buscar..." aria-label="Buscar títulos">
   <button class="top-icon-btn notification-btn" type="button" title="Notificações" aria-label="Notificações"><svg class="bell-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg><b>${getUserNotifications().length>99?"99+":getUserNotifications().length}</b></button>
   <button class="top-profile profile-trigger" id="topProfile" title="Perfil atual" aria-label="Abrir opções de perfil">${selectedAvatar}<span class="profile-chevron">▾</span></button>
   <button class="options-btn" id="optionsBtn" title="Opções" aria-label="Opções"><span></span><span></span><span></span></button>
  </div>
 </header>
 <div id="optionsOverlay" class="options-overlay hidden"></div>
 <aside id="optionsDrawer" class="options-drawer" aria-hidden="true">
   <div class="options-drawer-head"><h2>Opções</h2><button id="closeOptions" class="drawer-close" aria-label="Voltar e fechar">← Voltar</button></div>
   <div class="drawer-profile">${selectedAvatar}<div><strong>${esc(currentProfile?.name||session.name)}</strong><small>Perfil atual</small></div></div>
   <button class="drawer-option" id="drawerProfile"><span>👤</span> Perfil</button>
   <button class="drawer-option drawer-logout" id="drawerLogout"><span>↪</span> Sair</button>
   <button class="drawer-option drawer-back" id="drawerBack"><span>←</span> Voltar</button>
 </aside>
 <section class="hero" id="hero"></section><main class="container"><div id="catalog"></div></main><footer class="footer">StreamDrive • catálogo local para GitHub Pages <span class="image-credit">• imagens de séries: TVmaze</span></footer><div id="modal" class="modal hidden"></div>`;
 renderCategoryMenus();

 document.getElementById("siteLogo").onclick=()=>goHome();
 document.getElementById("navHomeTop").onclick=(e)=>{e.preventDefault();e.stopPropagation();goHome();};
 const searchInput=document.getElementById("search");
 const searchToggle=document.getElementById("searchToggle");
 document.querySelector(".notification-btn")?.addEventListener("click",openNotifications);
 updateNotificationBadge();
 searchToggle?.addEventListener("click",()=>{
   const open=searchInput.classList.toggle("search-open");
   searchToggle.classList.toggle("active",open);
   if(open){searchInput.focus();}else{searchInput.value="";searchText="";renderCatalog();}
 });
 document.querySelectorAll("[data-f]").forEach(b=>b.onclick=(e)=>{
  if(b.classList.contains("nav-menu-trigger")){
   e.preventDefault(); e.stopPropagation();
   if(b.dataset.f === "series"){
    window.location.href = "series.html";
    return;
   }
   if(b.dataset.f === "movie"){
    window.location.href = "movies.html";
    return;
   }
   const menu=b.closest(".nav-menu");
   document.querySelectorAll(".nav-menu.open").forEach(m=>{if(m!==menu)m.classList.remove("open")});
   menu?.classList.toggle("open");
   b.setAttribute("aria-expanded",menu?.classList.contains("open")?"true":"false");
   return;
  }
  if(b.dataset.navHomeTop==="1"){
   e.preventDefault();
   document.querySelectorAll(".nav-menu.open").forEach(m=>m.classList.remove("open"));
   goHome();
   return;
  }
  currentFilter=b.dataset.f;
  currentCategory="all";
  heroPreviewPool=[]; heroPreviewPoolType="";
  document.querySelectorAll(".top-nav-link").forEach(n=>n.classList.toggle("active",n===b));
  if(currentFilter==="recent"){
    document.querySelectorAll(".nav-menu.open").forEach(m=>m.classList.remove("open"));
  }
  if(location.search)history.replaceState(null,"","index.html");
  document.querySelector(".category-page-container")?.classList.remove("category-page-container");
  document.getElementById("hero")?.classList.remove("category-mode-hidden");
  renderHero();renderCatalog();
 });
 document.addEventListener("click",e=>{
  const catBtn=e.target.closest("[data-nav-category]");
  if(catBtn){
    e.preventDefault(); e.stopPropagation();
    openCategoryPage(catBtn.dataset.navCategory,catBtn.dataset.navType);
    return;
  }
  const homeBtn=e.target.closest("[data-nav-home]");
  if(homeBtn){
    e.preventDefault(); e.stopPropagation(); goHome(); return;
  }
  if(!e.target.closest(".nav-menu")) document.querySelectorAll(".nav-menu.open").forEach(m=>{m.classList.remove("open");m.querySelector(".nav-menu-trigger")?.setAttribute("aria-expanded","false")});
 });
 const searchBox=document.getElementById("search");
 const runSearch=()=>{
   searchText=normalizeSearch(searchBox?.value||"");
   if(searchBox && searchText && !searchBox.classList.contains("search-open")){
     searchBox.classList.add("search-open");
     searchToggle?.classList.add("active");
   }
   renderCatalog();
 };
 searchBox.oninput=runSearch;
 searchBox.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();runSearch();}};
 document.getElementById("topProfile").onclick=()=>openOptions();
 document.getElementById("optionsBtn").onclick=()=>openOptions();
 document.getElementById("optionsOverlay").onclick=()=>closeOptions();
 document.getElementById("closeOptions").onclick=()=>closeOptions();
 document.getElementById("drawerBack").onclick=()=>closeOptions();
 document.getElementById("drawerProfile").onclick=()=>{closeOptions();renderProfiles()};
 document.getElementById("drawerLogout").onclick=logout;
 renderHero();renderCatalog();
 if(location.pathname.endsWith("/movies.html") || location.pathname.endsWith("movies.html")) renderMoviesLanding();
 const catalog=document.getElementById("catalog");
 catalog.addEventListener("click",e=>{
   const btn=e.target.closest("[data-category-more]");
   if(!btn)return;
   e.preventDefault();
   openCategoryPage(btn.dataset.categoryMore,btn.dataset.categoryType);
 });
}
function openOptions(){
 const drawer=document.getElementById("optionsDrawer"),overlay=document.getElementById("optionsOverlay");
 if(!drawer||!overlay)return;
 drawer.classList.add("open");overlay.classList.remove("hidden");drawer.setAttribute("aria-hidden","false");document.body.classList.add("drawer-open");
}
function closeOptions(){
 const drawer=document.getElementById("optionsDrawer"),overlay=document.getElementById("optionsOverlay");
 if(!drawer||!overlay)return;
 drawer.classList.remove("open");overlay.classList.add("hidden");drawer.setAttribute("aria-hidden","true");document.body.classList.remove("drawer-open");
}
function getCategoriesByType(type){
 const map=new Map();
 db.contents.filter(c=>c.type===type).forEach(c=>{
  const name=String(c.category||"").trim().replace(/\\s+/g," ");
  if(name){
   const key=normalizeCategoryName(name);
   if(!map.has(key))map.set(key,name);
  }
 });
 /*
  * Mantém o mesmo menu/visual, mas garante que as subcategorias previstas
  * também apareçam no menu mesmo quando determinada categoria estiver
  * temporariamente sem títulos. Cada item continua abrindo category.html
  * com a categoria correspondente, evitando duplicar a mecânica do catálogo.
  */
 const configuredMovies=[
  "Ação","Animação","Aventura","Comédia","Crime","Documentário","Drama",
  "Fantasia","Ficção científica","Horror","Mistério","Musical","Policial",
  "Romance","Suspense","Terror","Thriller","Guerra","Western","Nacional","Faroeste"
 ];
 const configuredSeries=[
  "Animação","Aventura","Ação","Comédia","Crime","Documentário","Drama",
  "Espionagem","Fantasia","Ficção científica","Mistério","Médico","Policial",
  "Reality","Super-heróis","Terror"
 ];
 const configured=type==="series"?configuredSeries:configuredMovies;
 configured.forEach(name=>{
   const key=normalizeCategoryName(name);
   if(!map.has(key))map.set(key,name);
 });
 return [...map.values()].sort((a,b)=>a.localeCompare(b,"pt-BR",{sensitivity:"base"}));
}

function renderCategoryMenus(){
 document.querySelectorAll(".nav-dropdown").forEach(drop=>{
  const type=drop.dataset.dropdownType;
  const categories=getCategoriesByType(type);
  drop.innerHTML=`<button type="button" class="nav-category-item nav-category-home" data-nav-home="1">⌂ Início</button>` + (categories.length
   ? categories.map(cat=>`<button type="button" class="nav-category-item" data-nav-category="${esc(cat)}" data-nav-type="${esc(type)}">${esc(cat)}</button>`).join("")
   : `<span class="nav-category-empty">Nenhuma categoria cadastrada</span>`);
 });
}


function renderSeriesLanding(){
 currentFilter="series";
 currentCategory="all";
 searchText="";
 heroPreviewPool=[];
 heroPreviewPoolType="";
 heroPreviewIndex=0;
 document.querySelectorAll(".top-nav-link").forEach(n=>n.classList.toggle("active",n.dataset.f==="series"));
 const hero=document.getElementById("hero");
 if(hero)hero.className="hero";
 const container=document.querySelector(".container");
 container?.classList.remove("category-page-container");
 renderHero();
 renderCatalog();
 renderCategoryMenus();
}

function selectTypePage(type){
 currentFilter=type;
 currentCategory="all";
 if(location.search)history.replaceState(null,"","index.html");
 document.querySelector(".category-page-container")?.classList.remove("category-page-container");
 renderHero();renderCatalog();
}

function filtered(){
 const baseFilter=currentFilter==="recent"?"all":currentFilter;
 let arr=db.contents.filter(c=>((baseFilter==="all"&&(c.type==="movie"||c.type==="series"))||(baseFilter==="movie"&&c.type==="movie")||(baseFilter==="series"&&c.type==="series")||(baseFilter==="favorite"&&c.type==="movie"&&db.favorites.includes(c.id)))&&(currentCategory==="all"||c.category===currentCategory));
 if(searchText){
   const needle=String(searchText).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
   arr=arr.filter(c=>normalizeSearch(`${c.title||""} ${c.category||""} ${c.synopsis||""}`).includes(needle));
 }
 // Proteção final contra títulos de séries repetidos na exibição.
 if(baseFilter==="series" || baseFilter==="all") {
   const unique=new Map();
   const seriesKey=(title)=>String(title||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s*\(\d{4}\)\s*$/g,"").replace(/\s+\d{4}\s*$/g,"").replace(/\s*\[l\]\s*$/g,"").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
   for(const item of arr){
     if(item.type!=="series"){ continue; }
     const key=seriesKey(item.title);
     if(!key) continue;
     const prev=unique.get(key);
     if(!prev){ unique.set(key,item); continue; }
     const epCount=(x)=>(x?.seasons||[]).reduce((n,se)=>n+(se?.episodes?.length||0),0);
     if(epCount(item)>epCount(prev)) unique.set(key,item);
   }
   const seen=new Set();
   arr=arr.filter(item=>{
     if(item.type!=="series") return true;
     const key=seriesKey(item.title);
     if(!key) return true;
     const keep=unique.get(key);
     if(keep!==item || seen.has(key)) return false;
     seen.add(key);
     return true;
   });
 }
 if(currentFilter==="recent") arr.sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0));
 return arr;
}
function getHomePreviewMedia(url){
 if(!url)return null;
 let raw=String(url).trim();
 if(/^http:\/\//i.test(raw)) raw="https://"+raw.slice(7);
 // Vídeos diretos: elemento <video>, com autoplay, muted, loop e playsinline.
 if(/\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(raw)) return {type:"video",src:raw};
 // Google Drive: o endpoint /preview deve ser aberto em iframe; /uc?export=download não é uma URL de vídeo confiável para <video>.
 let m=raw.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
 if(m) return {type:"iframe",src:`https://drive.google.com/file/d/${m[1]}/preview?autoplay=1&mute=0`};
 m=raw.match(/[?&]id=([A-Za-z0-9_-]+)/);
 if(/drive\.google\.com/i.test(raw) && m) return {type:"iframe",src:`https://drive.google.com/file/d/${m[1]}/preview?autoplay=1&mute=0`};
 return null;
}
function getHomePreviewVideo(url){
 const media=getHomePreviewMedia(url);
 return media?.type==="video"?media.src:"";
}
function getHeroPreviews(){
 const wantedType=currentFilter==="all"?"home":(currentFilter==="series"?"series":"movie");
 if(heroPreviewPoolType!==wantedType || !heroPreviewPool.length){
  if(wantedType==="home"){
   const movies=db.contents.filter(c=>c.type==="movie");
   const series=db.contents.filter(c=>c.type==="series");
   const shuffle=(arr)=>[...arr].sort(()=>Math.random()-0.5);
   const moviePick=shuffle(movies).slice(0,Math.min(5,movies.length));
   const seriesPick=shuffle(series).slice(0,Math.min(5,series.length));
   heroPreviewPool=shuffle([...moviePick,...seriesPick]);
  }else{
   const pool=db.contents.filter(c=>c.type===wantedType);
   heroPreviewPool=[...pool].sort(()=>Math.random()-0.5).slice(0,Math.min(8,pool.length));
  }
  heroPreviewPoolType=wantedType;
  heroPreviewIndex=0;
 }
 return heroPreviewPool;
}
function changeHeroPreview(direction){
 const list=getHeroPreviews();
 if(!list.length)return;
 heroPreviewIndex=(heroPreviewIndex+direction+list.length)%list.length;
 renderHero();
}
function renderHero(){
 const list=getHeroPreviews();
 if(!list.length){document.getElementById("hero").innerHTML="";return}
 heroPreviewIndex=Math.max(0,Math.min(heroPreviewIndex,list.length-1));
 const c=list[heroPreviewIndex];
 const poster=c.poster||"https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1800&q=85";
 const typeLabel=c.type==="series"?"Série":"Filme";
 const previewMedia=getHomePreviewMedia(c.drive);
 const previewSrc=previewMedia?.src||"";
 const media=previewMedia?.type==="video"
   ? `<video class="hero-preview-video" src="${esc(previewMedia.src)}" poster="${esc(poster)}" autoplay muted loop playsinline preload="auto" aria-label="Prévia de ${esc(c.title)}"></video>`
   : previewMedia?.type==="iframe"
     ? `<iframe class="hero-preview-video hero-preview-frame" src="${esc(previewMedia.src)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="Prévia de ${esc(c.title)}"></iframe>`
     : "";
 const dots=list.map((x,i)=>`<button type="button" class="hero-dot ${i===heroPreviewIndex?"active":""}" onclick="setHeroPreview(${i})" aria-label="Prévia ${i+1}"></button>`).join("");
 document.getElementById("hero").innerHTML=`
 <div class="hero-preview" style="background-image:url('${esc(c.backdrop||poster)}')">
   ${media}
   <div class="hero-preview-overlay"></div>
   <button class="hero-preview-arrow hero-preview-prev" type="button" onclick="changeHeroPreview(-1)" aria-label="Prévia anterior">‹</button>
   <button class="hero-preview-arrow hero-preview-next" type="button" onclick="changeHeroPreview(1)" aria-label="Próxima prévia">›</button>
   <div class="hero-content">
     <div class="preview-label"><span class="preview-dot"></span> PRÉVIA • ${heroPreviewIndex+1} DE ${list.length}</div>
     <div class="kicker">${esc(typeLabel)} • ${esc(c.category)}</div>
     <h1>${esc(c.title)}</h1>
     <p>${esc(c.synopsis)}</p>
     <div class="actions"><button class="btn btn-light" onclick="openContent('${esc(c.id)}')">▶ Assistir</button>${c.type==="movie"?`<button class="btn btn-dark" onclick="toggleFav('${esc(c.id)}')">${db.favorites.includes(c.id)?"✓ Na minha lista":"＋ Minha lista"}</button>`:""}</div>
   </div>
   <div class="preview-badge"><span>PRÉVIA ${previewSrc?"• SEM SOM":""}</span><strong>${esc(c.title)}</strong></div>
   <div class="hero-dots" aria-label="Escolher prévia">${dots}</div>
 </div>`;
 // Alguns navegadores podem adiar o autoplay mesmo com muted/playsinline.
 // Tentamos iniciar o vídeo novamente depois que ele entra no DOM.
 const heroVideo=document.querySelector("#hero .hero-preview-video");
 if(heroVideo && heroVideo.tagName==="VIDEO"){
   heroVideo.muted=true; heroVideo.defaultMuted=true; heroVideo.playsInline=true;
   const start=()=>{const p=heroVideo.play(); if(p&&p.catch)p.catch(()=>{});};
   if(heroVideo.readyState>=2) start(); else heroVideo.addEventListener("canplay",start,{once:true});
   setTimeout(start,120);
 }
 // Todas as prévias locais são obrigatoriamente silenciosas.
 document.querySelectorAll(".hero-preview video, .category-page-preview video, .card-preview-video").forEach(v=>{
   v.muted=true; v.defaultMuted=true; v.volume=0; v.setAttribute("muted","");
 });
}
function setHeroPreview(index){
 const list=getHeroPreviews();
 if(!list.length)return;
 heroPreviewIndex=Math.max(0,Math.min(Number(index)||0,list.length-1));
 renderHero();
}
function getRecentlyWatched(type="movie"){
 const seen=new Set();
 const out=[];
 const history=Array.isArray(db.history)?[...db.history].sort((a,b)=>(Number(b.time)||0)-(Number(a.time)||0)):[];
 for(const entry of history){
   const c=db.contents.find(x=>x.id===entry.id);
   if(!c || c.type!==type || seen.has(c.id)) continue;
   seen.add(c.id);
   out.push(c);
   if(out.length>=18) break;
 }
 return out;
}

const lazyCategoryStores = Object.create(null);
const lazyCategoryRenderers = Object.create(null);
function registerLazyCategory(id, items, renderer=cardMarkup){
  lazyCategoryStores[id] = Array.isArray(items) ? items.slice() : [];
  lazyCategoryRenderers[id] = renderer;
}
function renderLazyCategoryPage(id, page){
  const carousel=document.getElementById(id);
  const items=lazyCategoryStores[id]||[];
  if(!carousel) return;
  const totalPages=Math.max(1,Math.ceil(items.length/6));
  const next=Math.max(0,Math.min(totalPages-1,Number(page)||0));
  const chunk=items.slice(next*6,next*6+6);
  const renderer=lazyCategoryRenderers[id]||cardMarkup;
  carousel.dataset.page=String(next);
  carousel.dataset.pages=String(totalPages);
  carousel.innerHTML=`<div class="carousel-page">${chunk.map(c=>renderer(c)).join("")}</div>`;
  const row=carousel.closest('.category-row');
  const buttons=row?.querySelectorAll('.carousel-arrow');
  if(buttons?.length===2){ buttons[0].disabled=next<=0; buttons[1].disabled=next>=totalPages-1; }
}
function lazyCategoryMarkup(id, items, renderer=cardMarkup){
  registerLazyCategory(id, items, renderer);
  const totalPages=Math.max(1,Math.ceil(items.length/6));
  return `<div class="cards category-carousel" id="${id}" data-page="0" data-pages="${totalPages}"><div class="carousel-page">${items.slice(0,6).map(c=>cardMarkup(c)).join("")}</div></div>`;
}

function recentRowMarkup(items){
 if(!items.length)return "";
 const carouselId="recently-watched-carousel";
 return `<section class="category-row recently-watched-row" data-category="recently-watched">
   <div class="section-heading">
     <h2 class="section-title">Visto recentemente</h2>
     <div class="category-arrows" aria-label="Navegar em Visto recentemente">
       <button class="carousel-arrow" type="button" onclick="moveCategoryCarousel('${carouselId}',-1)" aria-label="Anterior">‹</button>
       <button class="carousel-arrow" type="button" onclick="moveCategoryCarousel('${carouselId}',1)" aria-label="Próximo">›</button>
     </div>
   </div>
   <div class="category-viewport">
     ${lazyCategoryMarkup(carouselId, items)}
   </div>
 </section>`;
}

function latestAdded(type,limit=10){
 const arr=db.contents.filter(c=>c.type===type);
 return arr.slice(-limit).reverse();
}
function homeReleaseItems(){
 return (Array.isArray(db.releases)?db.releases:[]).slice().sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0)).slice(0,10);
}
function homeCarouselMarkup(items,title,id,typeLabel=""){
 if(!items.length) return `<section class="category-row home-empty-row"><div class="section-heading"><h2 class="section-title">${esc(title)}</h2></div><div class="empty">Nenhum item disponível.</div></section>`;
 const pages=Math.ceil(items.length/6);
 return `<section class="category-row home-special-row" data-category="${esc(title)}">
   <div class="section-heading"><h2 class="section-title">${esc(title)}</h2><div class="category-arrows"><button class="carousel-arrow" type="button" onclick="moveCategoryCarousel('${id}',-1)">‹</button><button class="carousel-arrow" type="button" onclick="moveCategoryCarousel('${id}',1)">›</button></div></div>
   <div class="category-viewport">${lazyCategoryMarkup(id, items)}</div>
 </section>`;
}
function releaseCardMarkup(r){
 const poster=r.poster||posterFallback();
 return `<article class="card release-card"><div class="card-media"><img class="poster" src="${esc(poster)}" onerror="this.onerror=null;this.src=posterFallback()" alt="${esc(r.title)}"><div class="release-badge">EM BREVE</div></div><div class="card-body"><div class="card-title">${esc(r.title)}</div><div class="meta">${esc(r.category||"Lançamento recente")}${r.releaseDate?` • ${esc(r.releaseDate)}`:""}</div><div class="release-synopsis">${esc(r.synopsis||"Confira em breve.")}</div></div></article>`;
}
function lazyReleaseMarkup(id, items){
  registerLazyCategory(id, items, releaseCardMarkup);
  const totalPages=Math.max(1,Math.ceil(items.length/6));
  return `<div class="cards category-carousel" id="${id}" data-page="0" data-pages="${totalPages}"><div class="carousel-page">${items.slice(0,6).map(releaseCardMarkup).join("")}</div></div>`;
}
function homeReleasesMarkup(items){
 if(!items.length)return `<section class="category-row home-empty-row"><div class="section-heading"><h2 class="section-title">Lançamentos em breve</h2></div><div class="empty">Nenhum lançamento cadastrado.</div></section>`;
 const id="upcoming-releases-carousel";
 return `<section class="category-row home-special-row"><div class="section-heading"><h2 class="section-title">Lançamentos em breve</h2><div class="category-arrows"><button class="carousel-arrow" type="button" onclick="moveCategoryCarousel('${id}',-1)">‹</button><button class="carousel-arrow" type="button" onclick="moveCategoryCarousel('${id}',1)">›</button></div></div><div class="category-viewport">${lazyReleaseMarkup(id, items)}</div></section>`;
}
function renderHomeCatalog(){
 const box=document.getElementById("catalog");
 const recentMovies=getRecentlyWatched("movie").slice(0,10);
 const recentSeries=getRecentlyWatched("series").slice(0,10);
 const newestMovies=latestAdded("movie",10);
 const newestSeries=latestAdded("series",10);
 const releases=homeReleaseItems();
 box.innerHTML=[
   recentRowMarkup(recentMovies),
   homeCarouselMarkup(recentSeries,"Visto por último — Séries","recent-series-home"),
   homeCarouselMarkup(newestMovies,"10 últimos filmes adicionados","latest-movies-home"),
   homeCarouselMarkup(newestSeries,"10 últimas séries adicionadas","latest-series-home"),
   homeReleasesMarkup(releases)
 ].join("");
 updateAllCategoryCarousels();
}
function renderMoviesLanding(){
 currentFilter="movie"; currentCategory="all"; searchText=""; heroPreviewPool=[];heroPreviewPoolType="";
 document.title="StreamDrive • Filmes";
 // A página Filmes reúne todas as categorias em carrosséis independentes.
 // Mantém o hero, os cards, os controles e o estilo já existentes.
 const hero=document.getElementById("hero");
 if(hero){
   hero.classList.remove("category-mode-hidden");
   renderHero();
 }
 const box=document.getElementById("catalog");
 const movies=db.contents.filter(c=>c.type==="movie");
 const groups={};
 movies.forEach(c=>{const category=String(c.category||"Outros").trim()||"Outros";(groups[category]??=[]).push(c)});
 const categoryRows=Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0],"pt-BR",{sensitivity:"base"}));
 box.innerHTML=`<div class="movies-page"><div class="movies-page-head"><div><div class="netflix-kicker">STREAMDRIVE • FILMES</div><h1>Filmes</h1><p>${movies.length} título(s) disponíveis</p></div></div>${categoryRows.map(([cat,items],i)=>{
   const id=`movies-page-${i}`;
   const type=items[0]?.type||"movie";
   return `<section class="category-row" data-category="${esc(cat)}">
     <div class="section-heading">
       <h2 class="section-title">${esc(cat)}</h2>
       <div class="category-arrows" aria-label="Navegar em ${esc(cat)}">
         <button class="carousel-arrow" type="button" onclick="moveCategoryCarousel('${id}',-1)" aria-label="Anterior">‹</button>
         <button class="carousel-arrow" type="button" onclick="moveCategoryCarousel('${id}',1)" aria-label="Próximo">›</button>
       </div>
     </div>
     <div class="category-viewport">${lazyCategoryMarkup(id,items)}</div>
     <div class="category-more-wrap"><button class="category-more" type="button" data-category-more="${esc(cat)}" data-category-type="${esc(type)}">Ver todos de ${esc(cat)} ›</button></div>
   </section>`;
 }).join("")||'<div class="empty">Nenhum filme cadastrado.</div>'}</div>`;
 updateAllCategoryCarousels();
 renderCategoryMenus();
}
function renderCatalog(){
 const box=document.getElementById("catalog");
 if(currentFilter==="all" && currentCategory==="all" && !searchText){ renderHomeCatalog(); return; }
 const arr=filtered();
 if(!arr.length){box.innerHTML='<div class="empty">Nenhum título encontrado.</div>';return}
 const groups={};arr.forEach(c=>(groups[c.category]??=[]).push(c));

 // Na home, cada categoria funciona como uma fileira/carrossel de 9 títulos.
 // Ao pesquisar ou filtrar, a mesma apresentação continua sendo usada para
 // manter a interface consistente.
 box.innerHTML=Object.entries(groups).map(([cat,items],index)=>{
   const carouselId=`category-carousel-${index}`;
   return `<section class="category-row" data-category="${esc(cat)}">
     <div class="section-heading">
       <h2 class="section-title">${esc(cat)}</h2>
       <div class="category-arrows" aria-label="Navegar em ${esc(cat)}">
         <button class="carousel-arrow" type="button" onclick="moveCategoryCarousel('${carouselId}',-1)" aria-label="Anterior">‹</button>
         <button class="carousel-arrow" type="button" onclick="moveCategoryCarousel('${carouselId}',1)" aria-label="Próximo">›</button>
       </div>
     </div>
     <div class="category-viewport">
       ${lazyCategoryMarkup(carouselId, items)}
     </div>
     <div class="category-more-wrap">
       <button class="category-more" type="button" data-category-more="${esc(cat)}" data-category-type="${esc(items[0]?.type||"movie")}">Mais...</button>
     </div>
   </section>`;
 }).join("");

 updateAllCategoryCarousels();
}

function posterFallback(){
 return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><rect width="400" height="600" fill="#171717"/><text x="200" y="285" text-anchor="middle" fill="#777" font-family="Arial" font-size="22">CAPA INDISPONÍVEL</text><text x="200" y="320" text-anchor="middle" fill="#555" font-family="Arial" font-size="14">STREAMDRIVE</text></svg>`);
}
function getCardPreviewVideo(c){
 // As séries usam somente a miniatura no catálogo. Não criamos um <video>
 // para cada série a partir do primeiro episódio, pois o catálogo importado
 // pode conter milhares de links externos e isso deixa a página pesada.
 if(c?.type==="series") return "";
 if(c?.drive) return getHomePreviewVideo(c.drive);
 return "";
}
function cardMarkup(c){
 const poster=c.poster||posterFallback();
 const preview=getCardPreviewVideo(c);
 const video=preview?`<video class="card-preview-video" src="${esc(preview)}" poster="${esc(poster)}" muted loop playsinline preload="none" aria-hidden="true"></video>`:"";
 return `<article class="card category-preview-card" data-content-id="${esc(c.id)}" onmouseenter="startCardPreview(this)" onmouseleave="stopCardPreview(this)">
   <div class="card-media" onclick="openContentInfo('${esc(c.id)}')">
     <img class="poster poster-clickable" src="${esc(poster)}" onerror="this.onerror=null;this.src=posterFallback()" alt="${esc(c.title)}" title="Clique para assistir">
     ${video}
     <div class="card-preview-shade"></div>
     <div class="card-preview-info"><span>${esc(c.type==="series"?"SÉRIE":"FILME")}</span><strong>${esc(c.title)}</strong><small>${esc(c.category||"")} • ${esc(c.year||"")}</small></div>
   </div>
   <div class="card-body">
     <div class="card-hover-actions">
       <button class="hover-circle play-action" onclick="openContent('${esc(c.id)}')" title="Assistir" aria-label="Assistir">▶</button>
       ${c.type==="movie"?`<button class="hover-circle" onclick="toggleFav('${c.id}')" title="Minha lista" aria-label="Minha lista">${db.favorites.includes(c.id)?"✓":"＋"}</button>`:""}
       <button class="hover-circle reaction-like" type="button" title="Gostei" aria-label="Gostei">👍</button>
       <button class="hover-circle reaction-dislike" type="button" title="Não gostei" aria-label="Não gostei">👎</button>
       <button class="hover-circle hover-more" onclick="openContentInfo('${esc(c.id)}')" title="Mais informações" aria-label="Mais informações">⌄</button>
     </div>
     <div class="card-title">${esc(c.title)}</div>
     <div class="meta">${c.type==="series"?`Série • ${esc(c.category||"")}`:`Filme • ${esc(c.year)} • ${esc(c.rating||"")}`}</div>
     <div class="card-actions"><button class="small-btn" onclick="openContent('${esc(c.id)}')">Detalhes</button></div>
   </div>
 </article>`;
}
function startCardPreview(card){
 const video=card.querySelector('.card-preview-video');
 if(!video)return;
 video.currentTime=0;
 const p=video.play();
 if(p?.catch)p.catch(()=>{});
}
function stopCardPreview(card){
 const video=card.querySelector('.card-preview-video');
 if(!video)return;
 video.pause();
 try{video.currentTime=0}catch(e){}
}

function updateAllCategoryCarousels(){
 document.querySelectorAll(".category-carousel").forEach(carousel=>{
   const pages=Math.max(1,Number(carousel.dataset.pages)||carousel.children.length||1);
   const page=Math.min(Number(carousel.dataset.page)||0,pages-1);
   carousel.dataset.page=page;
   const row=carousel.closest(".category-row");
   const buttons=row?.querySelectorAll(".carousel-arrow");
   if(buttons?.length===2){ buttons[0].disabled=page<=0; buttons[1].disabled=page>=pages-1; }
 });
}

function moveCategoryCarousel(id,direction){
 const carousel=document.getElementById(id);
 if(!carousel)return;
 const pages=Math.max(1,Number(carousel.dataset.pages)||1);
 let page=Number(carousel.dataset.page)||0;
 page=Math.max(0,Math.min(pages-1,page+direction));
 if(lazyCategoryStores[id]){
   renderLazyCategoryPage(id,page);
 }else{
   carousel.dataset.page=page;
 }
 carousel.closest(".category-row")?.classList.add("carousel-active");
}

function normalizeCategoryName(value){
 return String(value||"").trim().replace(/\s+/g," ").toLocaleLowerCase("pt-BR");
}
function findCategoryContents(category,type=""){
 const key=normalizeCategoryName(category);
 return db.contents.filter(c=>
  normalizeCategoryName(c.category)===key &&
  (!type || c.type===type)
 );
}
function getCanonicalCategory(category,items){
 return items.find(c=>String(c.category||"").trim())?.category || String(category||"").trim();
}
function openCategoryPage(category,type=""){
 const target=String(category||"").trim();
 if(!target)return;
 const contentType=type==="series"?"series":"movie";
 const query=`categoria=${encodeURIComponent(target)}&tipo=${encodeURIComponent(contentType)}`;

 // Se a Home já estiver carregada, navega sem recarregar a aplicação.
 // Isso evita o clique "morto" do menu e mantém sessão/perfil/estado.
 if(document.getElementById("catalog") && (location.pathname.endsWith("/index.html") || location.pathname.endsWith("/"))){
   history.pushState(null,"",`index.html?${query}`);
   document.querySelectorAll(".nav-menu.open").forEach(m=>m.classList.remove("open"));
   document.querySelectorAll(".nav-menu-trigger").forEach(b=>b.setAttribute("aria-expanded","false"));
   renderCategoryPage(target,contentType);
   return;
 }

 // Fallback para páginas abertas diretamente.
 location.href=`category.html?${query}`;
}

function renderCategoryPage(category,type=""){
 const box=document.getElementById("catalog");
 const normalizedType=type==="series"?"series":"movie";
 const items=findCategoryContents(category,normalizedType);
 const canonical=getCanonicalCategory(category,items);
 const hero=document.getElementById("hero");
 if(hero){hero.innerHTML="";hero.classList.add("category-mode-hidden");}
 document.querySelector(".container")?.classList.add("category-page-container");
 document.title=canonical?`StreamDrive • ${canonical}`:"StreamDrive • Categoria";
 if(!items.length){
   box.innerHTML=`<div class="category-page"><div class="empty"><h2>Categoria não encontrada</h2><p>A categoria <b>${esc(category)}</b> ainda não possui conteúdos.</p></div></div>`;
   return;
 }
 const previewItem=items.find(c=>getCardPreviewVideo(c))||items[0];
 const previewSrc=getCardPreviewVideo(previewItem);
 const previewMedia=previewSrc
  ? `<video class="category-page-preview-video" src="${esc(previewSrc)}" poster="${esc(previewItem.poster||posterFallback())}" autoplay muted loop playsinline preload="metadata" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"></video><img class="category-page-preview-fallback" src="${esc(previewItem.poster||posterFallback())}" alt="Prévia de ${esc(previewItem.title)}">`
  : `<img class="category-page-preview-fallback" style="display:block" src="${esc(previewItem.poster||posterFallback())}" alt="Prévia de ${esc(previewItem.title)}">`;
 box.innerHTML=`<div class="category-page">
   <div class="category-page-preview">
     <div class="category-page-preview-media">${previewMedia}<div class="category-page-preview-shade"></div><div class="category-page-preview-copy"><span>PRÉVIA</span><h2>${esc(previewItem.title)}</h2><p>${esc(previewItem.synopsis||"Confira uma prévia desta categoria.")}</p><button class="btn btn-red" onclick="openContent('${esc(previewItem.id)}')">▶ Assistir</button></div></div>
   </div>
   <div class="category-page-head">
     <div><div class="netflix-kicker">STREAMDRIVE • ${normalizedType==="series"?"SÉRIES":"FILMES"}</div><h1>${esc(canonical)}</h1><p>Todos os ${normalizedType==="series"?"episódios e séries":"filmes"} desta categoria • ${items.length} título(s)</p></div>
   </div>
   <div class="category-all-grid">${items.map(c=>cardMarkup(c)).join("")}</div>
 </div>`;
}

function goHome(){
 const target="index.html";
 // Sempre retorna para a Home real, removendo categoria/tipo da URL.
 if(location.pathname.endsWith("/index.html") || location.pathname==="/" || location.pathname===""){
   history.replaceState(null,"",target);
   currentFilter="all"; currentCategory="all"; searchText=""; heroPreviewIndex=0; heroPreviewPool=[]; heroPreviewPoolType="";
   const search=document.getElementById("search"); if(search)search.value="";
   document.querySelectorAll(".nav-menu.open").forEach(m=>m.classList.remove("open"));
   document.querySelector(".category-page-container")?.classList.remove("category-page-container");
   document.getElementById("hero")?.classList.remove("category-mode-hidden");
   renderHero(); renderCatalog();
   return;
 }
 location.href=target;
}
function addHistory(contentId,episodeId=null){
 db.history=[{id:contentId,episodeId:episodeId||null,time:Date.now()},...db.history.filter(x=>!(x.id===contentId&&x.episodeId===episodeId))].slice(0,50);save();
}
function playbackMarkup(url){
 const raw=String(url||'').trim();
 if(!raw)return `<div class="sd-empty"><h2>Vídeo indisponível</h2><p>Este título ainda não possui link de reprodução.</p></div>`;
 return isDirectVideo(raw)
  ? `<video class="sd-video" src="${esc(raw)}" controls autoplay playsinline preload="metadata" volume="0.6"></video>`
  : `<iframe class="sd-drive-frame" src="${esc(drivePreview(raw))}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>`;
}
function closeInlineContentInfo(){
 document.querySelectorAll('.inline-content-info').forEach(el=>el.remove());
 document.querySelectorAll('.card.inline-info-open').forEach(el=>el.classList.remove('inline-info-open'));
 document.querySelectorAll('.card.inline-info-collapsed').forEach(el=>el.classList.remove('inline-info-collapsed'));
}
function inlineSeriesSeasons(c,openSeason=null){
 const seasons=Array.isArray(c.seasons)?c.seasons:[];
 return `<div class="inline-series-seasons">
   <div class="inline-series-seasons-head"><strong>Temporadas</strong><span>${seasons.length}</span></div>
   ${seasons.map(s=>{
     const isOpen=Number(openSeason)===Number(s.number);
     const eps=(s.episodes||[]).map(e=>`<button type="button" class="inline-episode-link" onclick="openEpisodePlayer('${esc(c.id)}',${Number(s.number)},'${esc(e.id)}')"><span class="inline-episode-number">${e.number}</span><span class="inline-episode-name">${esc(e.title||`Episódio ${e.number}`)}</span><span class="inline-episode-play">▶</span></button>`).join('');
     return `<div class="inline-season-block ${isOpen?'open':''}" data-season="${Number(s.number)}">
       <button type="button" class="inline-season-toggle" aria-expanded="${isOpen?'true':'false'}" onclick="toggleInlineSeason('${esc(c.id)}',${Number(s.number)})"><span>Temporada ${Number(s.number)}</span><span class="inline-season-chevron" aria-hidden="true">${isOpen?'⌃':'⌄'}</span></button>
       <div class="inline-season-episodes" aria-hidden="${isOpen?'false':'true'}">${eps||'<div class="inline-episode-empty">Nenhum episódio disponível.</div>'}</div>
     </div>`;
   }).join('')}
 </div>`;
}
function toggleInlineSeason(id,seasonNumber){
 const panel=document.querySelector(`.inline-content-info[data-content-info-id="${CSS.escape(String(id))}"]`); if(!panel)return;
 const box=panel.querySelector('.inline-series-seasons'); if(!box)return;
 const current=box.querySelector(`.inline-season-block.open`);
 const target=current&&Number(current.dataset.season)===Number(seasonNumber)?null:Number(seasonNumber);
 const c=db.contents.find(x=>x.id===id); if(!c)return;
 const wrap=document.createElement('div'); wrap.innerHTML=inlineSeriesSeasons(c,target);
 box.replaceWith(wrap.firstElementChild);
}

const OMDB_API_KEY = "661e4226";
const OMDB_CACHE_KEY = "streamdrive_omdb_synopsis_v1";
function readOmdbCache(){
  try{return JSON.parse(localStorage.getItem(OMDB_CACHE_KEY)||"{}")}catch(e){return {}}
}
function writeOmdbCache(cache){
  try{localStorage.setItem(OMDB_CACHE_KEY,JSON.stringify(cache))}catch(e){}
}
async function loadOmdbSynopsis(c, panel){
  if(!c || c.type === 'series' || c.synopsis && !/^Filme da categoria/i.test(String(c.synopsis))) return;
  const title=String(c.title||'').trim();
  if(!title) return;
  const cache=readOmdbCache();
  const cacheKey=`${title.toLowerCase()}|${c.year||''}`;
  if(cache[cacheKey]){
    c.synopsis=cache[cacheKey];
    const el=panel?.querySelector('.inline-info-synopsis');
    if(el) el.textContent=c.synopsis;
    return;
  }
  const el=panel?.querySelector('.inline-info-synopsis');
  if(el) el.textContent='Consultando informações do filme...';
  try{
    const params=new URLSearchParams({apikey:OMDB_API_KEY,t:title,plot:'full'});
    if(c.year) params.set('y',String(c.year));
    const res=await fetch(`https://www.omdbapi.com/?${params.toString()}`,{cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    if(data.Response==='True' && data.Plot && data.Plot!=='N/A'){
      c.synopsis=data.Plot;
      cache[cacheKey]=data.Plot;
      writeOmdbCache(cache);
      try{save()}catch(e){}
      const current=panel?.querySelector('.inline-info-synopsis');
      if(current) current.textContent=data.Plot;
    }else if(el){
      el.textContent=c.synopsis && !/^Filme da categoria/i.test(String(c.synopsis)) ? c.synopsis : 'Sinopse não encontrada.';
    }
  }catch(err){
    console.warn('StreamDrive: OMDb indisponível para',title,err);
    if(el) el.textContent=c.synopsis && !/^Filme da categoria/i.test(String(c.synopsis)) ? c.synopsis : 'Não foi possível carregar a sinopse agora.';
  }
}

function openContentInfo(id){
 const c=db.contents.find(x=>x.id===id);
 if(!c)return toast('Conteúdo não encontrado.');
 const card=document.querySelector(`.card[data-content-id="${CSS.escape(String(id))}"]`);
 if(!card)return toast('Cartão do conteúdo não encontrado.');
 const current=document.querySelector(`.inline-content-info[data-content-info-id="${CSS.escape(String(id))}"]`);
 if(current){ closeInlineContentInfo(); return; }
 closeInlineContentInfo();
 const isSeries=c.type==='series';
 const poster=c.poster||posterFallback();
 const meta=isSeries?`Série • ${c.category||''}`:[`Filme`,c.year,c.rating?`Classificação ${c.rating}`:'',c.category||''].filter(Boolean).join('  •  ');
 const panel=document.createElement('section');
 panel.className='inline-content-info'; panel.dataset.contentInfoId=String(id);
 panel.innerHTML=`
   <div class="inline-info-body">
     <button class="inline-info-close" type="button" onclick="closeInlineContentInfo()" aria-label="Fechar informações">×</button>
     <div class="inline-info-main">
       <div class="inline-info-kicker">${isSeries?'SÉRIE':'FILME'}</div>
       <h2>${esc(c.title)}</h2>
       <div class="inline-info-meta">${isSeries?esc(c.category||""):esc(meta)}</div>
       ${isSeries?`<p class="inline-info-synopsis">${esc(c.synopsis||'Sem descrição disponível.')}</p>`:`<p class="inline-info-synopsis">${esc(c.synopsis||'Sem descrição disponível.')}</p>`}
       <div class="inline-info-actions">
         <button class="btn btn-light inline-info-play" type="button" onclick="openContent('${esc(c.id)}')">▶ Assistir</button>
         ${!isSeries?`<button class="btn btn-dark inline-info-list" type="button" onclick="toggleFav('${esc(c.id)}');openContentInfo('${esc(c.id)}')">${db.favorites.includes(c.id)?'✓ Na minha lista':'＋ Minha lista'}</button>`:''}
       </div>
       ${isSeries?inlineSeriesSeasons(c):''}
     </div>
   </div>
   <div class="inline-info-media">
     ${getCardPreviewVideo(c)
       ? `<video class="inline-info-preview" src="${esc(getCardPreviewVideo(c))}" poster="${esc(poster)}" muted loop playsinline autoplay preload="metadata" aria-label="Prévia de ${esc(c.title)}"></video>`
       : `<img class="inline-info-preview" src="${esc(poster)}" alt="${esc(c.title)}" onerror="this.onerror=null;this.src=posterFallback()">`}
     <div class="inline-info-media-shade"></div>
     <button class="inline-info-preview-play" type="button" onclick="openContent('${esc(c.id)}')" aria-label="Assistir ${esc(c.title)}">▶</button>
   </div>`;
 card.after(panel);
 card.classList.add('inline-info-open','inline-info-collapsed');
 requestAnimationFrame(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}));
 if(!isSeries) loadOmdbSynopsis(c,panel);
}

async function ensureSeriesEpisodes(id){
 const current=getSeries(id);
 if(current?.seasons?.length) return current;
 try{
  const full=await window.StreamDriveSeriesLazy?.ensure(id);
  if(full){
   const target=db.contents.find(x=>String(x.id)===String(id));
   if(target) Object.assign(target,full);
   return target||full;
  }
 }catch(err){ console.warn('StreamDrive: falha ao carregar episódios sob demanda',err); }
 return getSeries(id);
}
async function openContent(id){
 let c=db.contents.find(x=>x.id===id);
 if(!c)return toast('Conteúdo não encontrado.');
 if(c.type==='series'){
  c=await ensureSeriesEpisodes(c.id);
  const season=c?.seasons?.[0],ep=season?.episodes?.[0];
  if(!ep)return toast('Esta série ainda não possui episódios disponíveis.');
  return openEpisodePlayer(c.id,season.number,ep.id);
 }
 addHistory(c.id);
 playerReturnUrl=getPlayerReturnUrl();
 try{ showModal(playerMarkup(c,false)); }catch(err){ console.error('Erro ao abrir o player:',err); toast('Não foi possível abrir o player.'); }
}
async function openEpisodePlayer(seriesId,seasonNumber,episodeId){
 let c=await ensureSeriesEpisodes(seriesId),ep=getEpisode(c,seasonNumber,episodeId);
 if(!c||!ep)return toast('Episódio não encontrado.');
 selectedSeriesId=seriesId;selectedSeasonNumber=Number(seasonNumber);selectedEpisodeId=episodeId;addHistory(c.id,ep.id);playerReturnUrl=getPlayerReturnUrl();
 const item={...ep,id:c.id,title:`EP ${ep.number} — ${ep.title}`,synopsis:ep.synopsis||'Sem sinopse para este episódio.',poster:c.poster,drive:ep.drive};
 try{ showModal(playerMarkup(item,true)); }catch(err){ console.error('Erro ao abrir o episódio:',err); toast('Não foi possível abrir o episódio.'); }
}
async function openSeries(id,seasonNumber=null,episodeId=null){
 let c=getSeries(id);if(!c)return;
 selectedSeriesId=id;
 c=await ensureSeriesEpisodes(id);
 if(!c)return;
 if(!c.seasons?.length){
  showModal(`<div class="modal-head"><h2>${esc(c.title)}</h2><button class="close" onclick="closeModal()">×</button></div><div class="detail"><img src="${esc(c.poster)}"><div><p class="meta">Série • ${esc(c.category)}</p><p style="line-height:1.6;color:#ddd">${esc(c.synopsis)}</p><div class="notice">Esta série ainda não possui temporadas ou episódios disponíveis.</div></div></div>`);
  return;
 }
 const season=getSeason(c,seasonNumber??c.seasons[0].number)||c.seasons[0];
 selectedSeasonNumber=season.number;
 const ep=episodeId?getEpisode(c,season.number,episodeId):season.episodes[0];
 selectedEpisodeId=ep?.id||null;
 renderSeriesModal();
}
function renderSeriesModal(){
 const c=getSeries(selectedSeriesId);if(!c)return;
 const season=getSeason(c,selectedSeasonNumber)||c.seasons[0];if(!season){return openSeries(c.id)}
 const ep=selectedEpisodeId?getEpisode(c,season.number,selectedEpisodeId):season.episodes[0];selectedEpisodeId=ep?.id||null;
 const video=ep?drivePreview(ep.drive):"";
 const episodeList=season.episodes.length?season.episodes.map(e=>`<button class="episode-item ${e.id===selectedEpisodeId?"active":""}" onclick="openEpisodePlayer('${c.id}',${season.number},'${e.id}')"><span class="episode-number">▶ EP ${e.number}</span><span class="episode-name">${esc(e.title)}</span></button>`).join(""):'<div class="empty">Esta temporada ainda não possui episódios.</div>';
 showModal(`<div class="modal-head"><div><h2>${esc(c.title)}</h2><div class="meta">Série • ${esc(c.category)}</div></div><button class="close" onclick="closeModal()">×</button></div>
 <div class="series-detail"><div><img class="series-poster" src="${esc(c.poster)}" alt=""><p class="series-synopsis">${esc(c.synopsis)}</p></div>
 <div><div class="series-controls"><label>Temporada <select onchange="selectSeason('${c.id}',this.value)">${c.seasons.map(s=>`<option value="${s.number}" ${Number(s.number)===Number(season.number)?"selected":""}>Temporada ${s.number}</option>`).join("")}</select></label></div>
 <div class="episode-list">${episodeList}</div>${ep?`<div class="episode-selected"><h3>EP ${ep.number} — ${esc(ep.title)}</h3><p>${esc(ep.synopsis||"Sem sinopse para este episódio.")}</p><button class="btn btn-light" onclick="openEpisodePlayer('${c.id}',${season.number},'${ep.id}')">▶ Assistir episódio</button></div>`:""}</div></div>`);
 if(ep)addHistory(c.id,ep.id);
}
function selectSeason(id,number){const c=getSeries(id);if(!c)return;selectedSeriesId=id;selectedSeasonNumber=Number(number);selectedEpisodeId=null;renderSeriesModal()}
function selectEpisode(id,seasonNumber,episodeId){selectedSeriesId=id;selectedSeasonNumber=Number(seasonNumber);selectedEpisodeId=episodeId;renderSeriesModal()}
function toggleFav(id){const c=db.contents.find(x=>x.id===id);if(c?.type==="series")return; if(db.favorites.includes(id))db.favorites=db.favorites.filter(x=>x!==id);else db.favorites.push(id);save();renderCatalog();renderHero();if(selectedSeriesId)renderSeriesModal()}
function logout(){session=null;currentProfile=null;localStorage.removeItem("sd_session");location.href="login.html"}
window.addEventListener("popstate",()=>{
 if(!session||session.role!=="user")return;
 const params=new URLSearchParams(location.search);
 const categoryParam=params.get("categoria");
 const typeParam=params.get("tipo")||"movie";
 if(categoryParam) renderCategoryPage(categoryParam,typeParam);
 else {document.querySelector(".container")?.classList.remove("category-page-container");document.getElementById("hero")?.classList.remove("category-mode-hidden");renderHero();renderCatalog();}
});

// Atalho rápido: Alt+C abre diretamente a categoria Comédia no menu Filmes.
document.addEventListener("keydown",e=>{
 if(e.altKey && !e.ctrlKey && !e.shiftKey && String(e.key).toLowerCase()==="c"){
  e.preventDefault();
  if(typeof openCategoryPage==="function") openCategoryPage("Comédia","movie");
 }
});

load();restoreSession();
if(session&&session.role==="user"){
 currentProfile=session.profiles?.[0];
 renderApp();
 if(location.pathname.endsWith("/series.html") || location.pathname.endsWith("\\series.html") || location.pathname.endsWith("series.html")){
  renderSeriesLanding();
 }else{
  const params=new URLSearchParams(location.search);
  const categoryParam=params.get("categoria");
  const typeParam=params.get("tipo")||"movie";
  if(categoryParam)renderCategoryPage(categoryParam,typeParam);
 }
 // Libera a interface assim que a aplicação principal estiver montada.
 // A hidratação das capas acontece depois, sem bloquear a primeira pintura.
 setTimeout(()=>{document.body.classList.add('sd-ready');},50);
 setTimeout(()=>{hydrateSeriesImages().catch(()=>{});},0);
}else{
 renderLogin();
 setTimeout(()=>document.body.classList.add('sd-ready'),50);
}
