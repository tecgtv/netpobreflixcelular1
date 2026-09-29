/* StreamDrive • correções e menus de categorias (adição, sem substituir o catálogo original) */
(() => {
  "use strict";

  const movieCategories = [
    "Ação", "Animação", "Aventura", "Comédia", "Crime", "Documentário",
    "Drama", "Fantasia", "Ficção científica", "Horror", "Mistério", "Musical",
    "Policial", "Romance", "Suspense", "Terror", "Thriller", "Guerra", "Western"
  ];

  /* Correções de categorias identificadas no lote novo. As categorias seguem uma
     taxonomia de gêneros de séries/filmes; o catálogo original não é apagado. */
  const seriesFixes = {
    "American Horror Stories [L] (2021)":"Terror",
    "Chaves (1973)":"Comédia",
    "Chuteira Preta":"Esporte",
    "Cidade de Fantasmas":"Animação",
    "Como Se Tornar um Tirano (2021)":"Documentário",
    "Como Vender Drogas Online (Rápido) (2019)":"Comédia",
    "DAVE (2020)":"Comédia",
    "Eureka (2006)":"Ficção científica",
    "Elize Matsunaga: Era uma Vez um Crime (2021)":"Documentário",
    "Falling Skies":"Ficção científica",
    "Família em Concerto":"Comédia",
    "Férias em Família":"Comédia",
    "Godzilla Singular Point":"Animação",
    "Guerra de Vizinhos (2021)":"Comédia",
    "High School Musical: A Série: O Musical (2019)":"Musical",
    "Hora de Aventura":"Animação",
    "Hora de Aventura: Terras Distantes (2020)":"Animação",
    "IneXplicável América Latina com John Leguizamo (2021)":"Documentário",
    "Invasão (2005)":"Ficção científica",
    "Jojo Nove e Meia (2021)":"Talk Show",
    "Just a Little Game: Os Bastidores da LOUD":"Documentário",
    "Krypton (2018)":"Ficção científica",
    "Loki":"Fantasia",
    "Lois & Clark: As Novas Aventuras do Superman (1993)":"Super-heróis",
    "Love in the Time of Corona (2020)":"Comédia",
    "Lupin":"Crime",
    "MacGyver - Profissão: Perigo (1985)":"Ação",
    "Made for Love (2021)":"Comédia",
    "Mestres do Universo: Salvando Eternia (2021)":"Animação",
    "Monstros no Trabalho (2021)":"Animação",
    "Mr. Corman (2021)":"Comédia",
    "O Incrível Mundo de Gumball (2011)":"Animação",
    "O Mito de Sísifo":"Ficção científica",
    "Os Padrinhos Mágicos (2001)":"Animação",
    "Outer Banks (2020)":"Aventura",
    "Panico (2021)":"Terror",
    "Pestinha e Feroz (1996)":"Animação",
    "Physical (2021)":"Comédia",
    "Post Mortem: Ninguém Morre em Skarnes (2021)":"Comédia",
    "Resident Evil: No Escuro Absoluto (2021)":"Animação",
    "Ridley Jones (2021)":"Animação",
    "Samurai X (1996)":"Animação",
    "Schmigadoon! (2021)":"Musical",
    "Sentouin, Hakenshimasu! (2021)":"Animação",
    "Sítio do Picapau Amarelo (1977)":"Infantil",
    "South Park (1997)":"Animação",
    "Stargate Atlantis":"Ficção científica",
    "Superman e Lois (2021)":"Super-heróis",
    "Sweet Tooth":"Fantasia",
    "The Hidden Dungeon Only I Can Enter":"Animação",
    "The North Water [L] (2021)":"Aventura",
    "Toquio 2020 No Sportv Cerimonia de Abertura Toquio":"Esporte",
    "Transformers: War for Cybertron: O Cerco (2020)":"Animação",
    "Transformers: War for Cybertron: O Nascer da Terra (2020)":"Animação",
    "Transformers: War for Cybertron: O Reino (2021)":"Animação",
    "Trese":"Animação",
    "Tribos da Europa":"Ficção científica",
    "Turner e Hooch (2021)":"Comédia",
    "UFO (2021)":"Ficção científica",
    "Ugly Americans [L] (2010)":"Animação",
    "Veep (2012)":"Comédia",
    "Vingança Sabor Cereja (2021)":"Drama",
    "What If...? (2021)":"Animação",
    "Xena: A Princesa Guerreira (1995)":"Ação"
  };

  const applySeriesFixes = () => {
    if (typeof importedSeriesCatalog === "undefined" || !Array.isArray(importedSeriesCatalog)) return;
    importedSeriesCatalog.forEach(item => {
      const fixed = seriesFixes[String(item.title || "").trim()];
      if (fixed) item.category = fixed;
    });
  };

  const fixMovieRecords = () => {
    try {
      if (typeof db !== 'undefined' && Array.isArray(db.contents)) {
        db.contents.forEach(item => {
          if (item && item.type === 'movie' && item.title === 'Aventura Espacial' && item.category === 'Ficção') item.category = 'Ficção científica';
        });
      }
    } catch (_) {}
  };

  const addPublicMenuItems = () => {
    document.querySelectorAll('.nav-dropdown[data-dropdown-type="movie"]').forEach(drop => {
      const existing = new Set([...drop.querySelectorAll('[data-nav-category]')].map(b => b.dataset.navCategory));
      movieCategories.forEach(cat => {
        if (existing.has(cat)) return;
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'nav-category-item';
        b.dataset.navCategory = cat; b.dataset.navType = 'movie'; b.textContent = cat;
        drop.appendChild(b);
      });
    });
  };

  // O menu administrativo por categoria foi removido conforme solicitado.

  applySeriesFixes();
  fixMovieRecords();
  window.streamDriveMovieCategories = movieCategories.slice();
  window.streamDriveSeriesCategoryFixes = {...seriesFixes};

  // app.js é carregado pelo mobile-loader depois dos catálogos; aguarda a interface.
  let tries = 0;
  const publicTimer = setInterval(() => {
    tries++;
    applySeriesFixes();
    fixMovieRecords();
    addPublicMenuItems();
    if (document.querySelector('.nav-dropdown[data-dropdown-type="movie"]') || tries > 100) clearInterval(publicTimer);
  }, 100);

  // O painel administrativo não precisa de um temporizador de categorias.
  // A chamada antiga para addAdminCategoryMenu() apontava para uma função
  // inexistente e gerava ReferenceError continuamente no admin.
})();
