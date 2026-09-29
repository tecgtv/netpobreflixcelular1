# StreamDrive V2.24 — Administração separada

O painel administrativo continua separado do site principal, mas agora o administrador entra pela **mesma tela de login do StreamDrive**.

## Acesso administrativo
- Usuário: `paineladmin`
- Senha: `Admin@2026`

Usuários comuns continuam entrando com seus e-mails e senhas. O administrador, ao usar as credenciais acima na mesma tela, é encaminhado diretamente para `admin.html`.

O painel administrativo permanece separado dos arquivos visuais e da navegação do site. Para sair do painel, o administrador volta à tela de login do site.

> Observação: esta versão usa autenticação local no navegador, adequada para protótipo/GitHub Pages. Para segurança real em produção, use um backend com autenticação.

## Gerenciamento de contas — V2.25

O painel administrativo agora possui a seção **Usuários e administradores**, sem alterar o layout visual existente do painel:
- criar, editar e excluir usuários;
- visualizar e alterar usuário e senha;
- criar, editar e excluir administradores;
- alterar usuário e senha do administrador;
- impede a exclusão do último administrador;
- a mesma tela de login aceita e-mail ou usuário;
- a tela de login mostra, na parte inferior, as credenciais atuais de teste de um usuário e de um administrador.

As contas desta versão são armazenadas no `localStorage` do navegador. Isso é adequado para demonstração/teste local, mas não é um sistema de autenticação seguro para produção sem backend.


## V2.26 — Preview de detalhes
- Clique na miniatura para abrir uma janela no estilo de streaming.
- Informações do título ficam à esquerda e a prévia de vídeo à direita.
- Botão central de Play abre o player existente.
- Minha Lista, Gostei e Não gostei foram adicionados à janela.
- A mecânica existente do player principal, administração, usuários, séries e episódios foi preservada.

## Atualização — Séries
- Séries ficam fora da Home e aparecem somente em Séries.
- Categorias de séries são geradas automaticamente no menu; Bates Motel foi classificada como Drama com base na página oficial da Netflix.
- Bates Motel foi importada do arquivo M3U fornecido, com 5 temporadas de 10 episódios e os respectivos links.
- Mais informações de uma série abre inline abaixo da fileira e recolhe a miniatura selecionada.
- Temporadas podem ser expandidas para mostrar os episódios; cada episódio abre o player de séries.
- Séries não exibem botão de favoritos.


ATUALIZAÇÃO: os links de capas foram retirados de series_imported.js e centralizados em series_images.js. O app.js usa essa configuração e consulta TVMaze para séries que não possuam uma capa fixa configurada. Nenhum M3U foi adicionado ao projeto.


## Atualização — páginas e subcategorias
- O menu superior mantém **Filmes** e **Séries** como entradas para suas respectivas páginas.
- A página **Filmes** preserva a prévia e os carrosséis existentes.
- A página **Séries** exibe as categorias de séries mantendo o mesmo visual.
- Cada subcategoria do menu abre sua própria visualização de categoria através de `category.html` com a categoria correspondente, sem duplicar nem alterar a mecânica do catálogo.
- O tema visual, player, perfil, notificações e painel administrativo permanecem preservados.
