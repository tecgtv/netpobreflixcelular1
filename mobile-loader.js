(function(){
  const core=[
    'acao.js','animacao.js','comedia.js',
    'series_bates_motel.js','series_dr_house.js',
    'series_images.js','series_imported.js','series_lazy_loader.js','catalog_category_patch.js'
  ];
  function load(src){
    return new Promise((resolve,reject)=>{
      const el=document.createElement('script');
      el.src=src; el.async=false; el.onload=resolve; el.onerror=reject;
      document.head.appendChild(el);
    });
  }
  async function start(){
    try{
      for(const f of core){
        try{ await load(f); }catch(e){ console.warn('Arquivo opcional não carregado:',f,e); }
      }
      const app=document.createElement('script');
      app.src='app.js'; app.async=false; document.head.appendChild(app);
    }catch(e){
      console.error('Falha ao iniciar o site:',e);
      document.documentElement.classList.add('boot-error');
    }
  }
  start();
})();
