# Aviso Legal e Posicionamento de Propriedade Intelectual / Legal Notice

> Este documento descreve a posição do projeto **dbForgeLinux** sobre propriedade intelectual.
> Não é parecer jurídico nem substitui a consulta a um advogado.
> *This document states the project's intellectual-property position. It is not legal advice.*

## 1. O que o projeto é (e não é)

- **É** um software livre, de código aberto (MIT), de **desenvolvimento independente**, escrito por **Danilo Song** e contribuidores, que oferece a usuários de Linux um cliente de banco de dados MySQL/MariaDB com **funcionalidades equivalentes** às de ferramentas comerciais da categoria (editor SQL, designer de tabelas, comparação de schemas etc.).
- **Não é** um clone, cópia, fork, redistribuição, versão modificada nem porte do código do *dbForge Studio for MySQL* (Devart). Todo o código-fonte foi escrito do zero, em TypeScript/React/Electron, sobre bibliotecas de código aberto.
- **Não é** afiliado, patrocinado, endossado ou autorizado pela **Devart** ou por qualquer empresa citada neste repositório.
- **Não** pretende ser confundido com o produto da Devart e **não** o substitui como produto oficial nem usa sua marca para promover ou vender o software.

*English:* dbForgeLinux is an independent open-source (MIT) database client for Linux. It is not a copy, fork, port or derivative of dbForge Studio. It has no affiliation with, and is not endorsed by, Devart.

## 2. Marcas

- *dbForge*, *dbForge Studio* e *Devart* são marcas de seus respectivos titulares. Nenhum direito sobre elas é reivindicado.
- Essas marcas aparecem neste repositório apenas de forma **nominativa e descritiva** (para dizer, com verdade, que o projeto oferece funcionalidade equivalente à de outro produto e que não tem relação com ele), sem logotipo, sem identidade visual e sem sugerir origem comum. Base legal brasileira de referência: Lei nº 9.279/1996 (Lei da Propriedade Industrial), art. 132, I e IV (uso de sinal alheio para referência/identificação e citação da marca em publicação sem conotação comercial).
- **Risco reconhecido:** o nome do projeto contém o elemento "dbForge". Se o titular da marca solicitar, o projeto se compromete a **renomear o repositório, o pacote, o executável e a documentação** em prazo razoável (ver seção 7).

## 3. Software: o que a lei brasileira protege

A base é a **Lei nº 9.609/1998 (Lei do Software)** e a **Lei nº 9.610/1998 (Direitos Autorais)**:

- Protege-se a **expressão** do programa (código-fonte e objeto, arquitetura de código, textos, imagens, ícones) — **não** as ideias, funcionalidades, métodos, algoritmos, regras ou conceitos (Lei 9.609, art. 2º e art. 6º, III; Lei 9.610, art. 8º, I e II).
- Não constitui ofensa ao titular a **similaridade de funcionamento** entre programas, usando ideias, regras, algoritmos e métodos preexistentes, desde que **não caracterizada a cópia da expressão** (Lei 9.609, art. 6º, III).
- Por isso, oferecer "um editor SQL com autocompletar, designer de tabelas e comparador de schemas" é lícito: são funcionalidades, não expressão protegida. O que **não** é lícito: copiar código, binários, ícones, imagens, textos de ajuda, documentação ou layout gráfico exato.
- Concorrência desleal (Lei 9.279/1996, art. 195) exige confusão/desvio de clientela ou aproveitamento parasitário. O projeto evita isso: não usa a marca para vender, não imita logotipo/identidade visual e declara expressamente a ausência de vínculo.

## 4. Práticas adotadas para evitar cópia (compromissos)

1. **Código próprio.** Nenhum código-fonte, biblioteca fechada, binário, ícone, imagem, fonte, texto de ajuda ou documentação da Devart é copiado ou distribuído neste repositório.
2. **Sem material extraído versionado.** Instaladores, binários, recursos e listagens extraídas do produto de referência ficam **fora do Git** (`re/extracted/`, `re/ui-strings/`, `re/original-observation/` e arquivos em `re/evidence/` são ignorados via `.gitignore`).
3. **Sem decompilação de lógica.** O comportamento foi estudado por **observação do produto em uso** e por especificações escritas pelo próprio projeto; a decompilação de lógica interna foi evitada (ver `document/01-rea-inventario.md`). Nenhuma proteção ou licenciamento foi contornado.
4. **Especificação separada da implementação.** As especificações em `document/ux/` descrevem comportamento esperado em linguagem própria; o código é escrito a partir delas, não a partir do código do original.
5. **Identidade visual própria.** O ícone, as cores, o tema e os textos de documentação são do projeto. Capturas de tela do repositório mostram **somente o dbForgeLinux**.
6. **Compatibilidade, não equivalência de marca.** Referências a "dbForge" em atalhos de teclado ou documentos têm finalidade de compatibilidade/interoperabilidade descritiva.
7. **Contribuições.** Colaboradores declaram que não incluem código, strings ou assets de terceiros sem licença compatível (ver `CONTRIBUTING.md`).

## 5. Pontos de atenção reconhecidos (transparência)

- Parte do estudo do produto de referência envolveu **inspeção de metadados do instalador** (nomes de assemblies/namespaces). Essas listagens foram **removidas do versionamento atual**; o histórico antigo do Git ainda pode conter alguns arquivos de evidência (`DefaultLayout.xml`, `members-mysql.json`, `namespaces.txt`). Eles não são distribuídos nos pacotes do software.
- O contrato de licença (EULA) do produto de referência pode conter cláusulas contra engenharia reversa. A lei brasileira não tem uma exceção expressa e ampla para decompilação como a diretiva europeia; por isso o projeto limitou-se a observação de comportamento e metadados públicos, e não distribui o material observado.
- Rótulos curtos de interface (ex.: "New Connection") são vocabulário comum de bancos de dados e não constituem expressão protegida isoladamente, mas o projeto mantém um catálogo próprio e **revisa** textos que reproduzam frases longas ou específicas do produto de referência.

## 6. Bibliotecas de terceiros

O software usa bibliotecas de código aberto (Electron, React, Monaco Editor, mysql2, entre outras), cada uma sob sua própria licença (MIT, Apache-2.0, BSD, ISC etc.). A lista completa e as licenças estão no `app/pnpm-lock.yaml` e nos pacotes instalados. O `.deb` distribuído inclui os avisos de licença exigidos pelas dependências.

## 7. Contato e retirada de conteúdo (notice & takedown)

Se você é titular de direitos e entende que algum conteúdo deste repositório viola seus direitos, abra uma issue no repositório ou escreva ao mantenedor (**Danilo Song**) indicando: (a) o arquivo/trecho; (b) o direito alegado; (c) seus dados de contato. O projeto se compromete a **analisar prontamente e, havendo fundamento, remover ou substituir o conteúdo** e, se for o caso, **renomear o projeto**.

## 8. Isenção de garantia

O software é fornecido "no estado em que se encontra", sem garantias, conforme a licença MIT (arquivo `LICENSE`).
