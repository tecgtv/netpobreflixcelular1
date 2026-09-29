# Versão compactada
Os arquivos grandes possuem versões `.js.gz`. O mobile-loader descompacta no navegador
quando `DecompressionStream` está disponível e usa o `.js` original como fallback.
O catálogo de séries continua sendo carregado em segundo plano.
