# Bates Motel — integração de séries

- Categoria verificada na Netflix: **Drama**; a Netflix também lista os gêneros de séries dramáticas, séries baseadas em livros e séries de terror.
- Fonte de referência: https://www.netflix.com/br/title/70272479
- Imagem do catálogo: URL de poster hospedada no Fanart.tv, mantida no código para não depender de um caminho local.
- A série fica somente no fluxo de **Séries**, não no catálogo da Home.
- O player usado ao clicar em episódio é o player exclusivo de séries já existente no projeto.
- O arquivo `Motel Bates.txt` foi limpo para não carregar o nome/ano da série no `tvg-id`; permanecem apenas temporada/episódio para identificação técnica.
- Ano e classificação foram removidos dos metadados da série no código; a quantidade de temporadas continua sendo derivada da estrutura de episódios, necessária para o player.
