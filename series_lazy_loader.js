/* StreamDrive • carregamento sob demanda das temporadas/episódios */
(()=>{
 const cache=new Set(), pending=new Map();
 function loadChunk(n){
   if(window.StreamDriveSeriesChunks?.[n]) return Promise.resolve();
   if(pending.has(n)) return pending.get(n);
   const p=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='series_chunks/chunk_'+String(n).padStart(3,'0')+'.js';s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('Não foi possível carregar a parte '+n));document.head.appendChild(s);});
   pending.set(n,p); return p;
 }
 window.StreamDriveSeriesLazy={
   async ensure(id){
     const meta=(window.importedSeriesCatalog||[]).find(x=>String(x.id)===String(id));
     if(!meta) return null;
     const n=Number(meta.__chunk); await loadChunk(n);
     const full=(window.StreamDriveSeriesChunks?.[n]||[]).find(x=>String(x.id)===String(id));
     if(full && window.db && Array.isArray(window.db.contents)){
       const target=window.db.contents.find(x=>String(x.id)===String(id));
       if(target){Object.assign(target,full); target.type='series';}
     }
     return full||null;
   },
   async preload(ids){return Promise.all((ids||[]).map(id=>this.ensure(id)));}
 };
})();
