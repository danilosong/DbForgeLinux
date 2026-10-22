# TuxSQL v2 — Direção Visual e Experiência do Usuário (Design Spec)

> **Documento Estratégico de UX/UI — Fase de Redesign Visual**  
> **Arquivo:** `document/ux/00-direcao-visual-v2.md`  
> **Data de Emissão:** 22 de outubro de 2026  
> **Autor:** Prisma (Designer UX/UI Antigravity)  
> **Diretriz do Dono do Produto:** Redesenhar integralmente a identidade visual e a experiência do usuário do TuxSQL para criar uma ferramenta **moderna, elegante, ergonômica e com identidade própria**, que **NÃO se pareça com uma cópia do dbForge Studio for MySQL**.  
> **Regra Fundamental de Engenharia:** Modificar exclusivamente o design visual, o layout estrutural e a experiência de uso (UI/UX). Todas as funcionalidades, fluxos de negócio, atalhos de teclado e contratos i18n consolidados na Fase 1 permanecem **100% preservados e funcionais**.

---

## 1. Diagnóstico Objetivo do Visual Atual (v1)

A análise do acervo atual de capturas do TuxSQL (`document/evidence/ui/sql-editor-light.png`, `document/evidence/ui/sql-editor-dark.png`, `document/evidence/ui/er-diagram-dark.png`, `document/evidence/ui/schema-compare-light.png`, `document/evidence/ui/table-data-grid-edit-dark.png` e `document/evidence/ui/shell-dark.png`) evidencia uma aderência excessiva aos padrões de interface legados do ecossistema Windows dos anos 2000 (WinForms, DevExpress e Visual Studio 2010–2019).

### 1.1. O que no TuxSQL v1 parece "dbForge / WinForms"
1. **Layout Estrutural Pesado e Fragmentado:**
   - Barra de menus tradicional no topo com 9 menus suspensos verticais (`File`, `Edit`, `View`, `Database`, `Comparison`, `Debug`, `Tools`, `Window`, `Help`).
   - Duas ou três fileiras de barras de ferramentas (toolbars) horizontais em cascata, repletas de botões de 16x16px divididos por separadores cinzas verticais (`|`).
   - O conjunto menu + toolbars consome entre **85px e 115px verticais** antes mesmo da primeira linha de código ou dado ser visível na tela.
2. **Cores e Identidade Visual Derivada:**
   - Uso predominante de tons de azul corporativo genérico (`#2f6fde` no tema claro e `#4c8dff` no escuro), diretamente evocativos da skin *"Visual Studio Blue"* do dbForge e do SQL Server Management Studio (SSMS).
   - Ausência de uma linguagem cromática própria que identifique o TuxSQL como uma ferramenta inovadora do ecossistema Linux moderno.
3. **Densidade Claustrofóbica de Bordas:**
   - Quase todos os painéis, seções, abas e grades são delimitados por bordas rígidas de 1px em cinza neutro (`#d1d5db` / `#3f4247`). Isso gera "ruído de grade" (grid noise) e fadiga visual durante jornadas prolongadas de trabalho.
4. **Abas com Visual de Fichário Físico:**
   - Abas de documentos retangulares com cantos vivos ou chanfrados, linhas de separação duras e ícones minúsculos colados ao texto, imitando fichários dos anos 1990.
5. **Hierarquia Tipográfica Plana:**
   - Quase todos os rótulos, botões, itens de árvore e cabeçalhos compartilham o mesmo tamanho (12px–13px) e peso (regular 400), gerando monotonia visual e dificultando a leitura escaneável da interface.

### 1.2. O que Prejudica a Usabilidade no v1
- **Perda de Área Útil (Vertical Real Estate):** Em notebooks e monitores Full HD (1920x1080), mais de 25% da altura útil é engolida por barras estáticas e molduras, sobrando pouco espaço para o editor SQL e a grade de resultados simultâneos.
- **Navegação em Menus Profundos:** Para executar comandos essenciais (como formatar SQL, perfilar ou abrir o assistente de exportação), o usuário precisa navegar por 2 a 3 níveis de menus em cascata com o mouse.
- **Badges de Ambiente com Pouca Proeminência:** As etiquetas de categoria de conexão (`Dev`, `Test`, `Prod`) no v1 são chips de texto discretos no rodapé ou na árvore. O risco de executar instruções destrutivas (`DROP`, `TRUNCATE`) em Produção por engano permanece elevado.
- **Falta de uma Entrada Universal por Teclado:** Não há uma Command Palette moderna no padrão de mercado (estilo VS Code, Linear, Zed ou JetBrains Search Everywhere).

---

## 2. Princípios de Design do TuxSQL v2

O novo design do TuxSQL é norteado por 8 princípios inegociáveis:

1. **Foco Radical no Editor e nos Dados (Content-First):**
   - O código SQL e as tabelas de dados são os protagonistas absolutos. Todo o "chrome" (moldura da janela, barras e menus) deve ser sutil, recolhível e visualmente calmo.
2. **Command Palette (`Ctrl+K` / `Ctrl+Shift+P`) como Centro Operacional:**
   - Acesso instantâneo a qualquer comando, documento, tabela, histórico, snippet ou conexão através de busca difusa (fuzzy search) universal, sem depender de caça com o mouse em menus.
3. **Barra de Atividades Vertical Moderna (Activity Bar):**
   - Substituição das toolbars caóticas por uma barra vertical minimalista na lateral esquerda (48px de largura), categorizando claramente os contextos de trabalho: *Explorer*, *Queries*, *VCS / Git*, *Comparisons*, *Tools*, *AI Assistant* e *Settings*.
4. **Densidade Visual Ajustável:**
   - Três modos de exibição selecionáveis pelo usuário a qualquer momento:
     - **Compact:** Para telas menores e cientistas/analistas de dados que precisam visualizar 40+ linhas no grid simultaneamente.
     - **Comfortable (Padrão):** Equilíbrio perfeito entre espaçamento respirável, legibilidade e produtividade.
     - **Spacious:** Ideal para apresentações, pareamento e monitores 4K de alta densidade (HiDPI).
5. **Teclado em Primeiro Lugar (Keyboard-First):**
   - 100% das operações devem ser acionáveis via teclado sem tirar as mãos da digitação. O mapa de atalhos consolidado na Fase 1 é mantido integralmente intacto.
6. **Estados Vazios Úteis e Proativos (Actionable Empty States):**
   - Nenhuma tela ou aba vazia exibe apenas cinza desértico. Toda área sem dados traz orientação contextual clara e atalhos diretos para a primeira ação (ex.: *"Nenhuma consulta aberta — Pressione Ctrl+N ou arraste uma tabela do Explorer"*).
7. **Feedback Seguro e Semântica de Produção:**
   - Conexões de ambiente de **Produção (PROD)** aplicam um alerta visual inconfundível (borda de status carmesim sutil e chip vibrante), prevenindo acidentes operacionais.
8. **Acessibilidade WCAG 2.1 Nível AA:**
   - Relação de contraste mínima de **4.5:1** para texto normal e **3:1** para elementos gráficos essenciais.
   - Suporte nativo a `@media (prefers-reduced-motion: reduce)` desativando animações supérfluas.
   - Indicador de foco visual com anel duplo em todos os controles interativos.

---

## 3. Sistema de Design do TuxSQL v2

### 3.1. Identidade Visual Própria — "Tux Teal & Amber"

A identidade do TuxSQL v2 abandona totalmente o azul genérico do dbForge e adota uma paleta autoral inspirada na elegância do ecossistema Linux moderno (Cosmic Desktop, Elementary OS, Nord e JetBrains Fleet):

- **Tom Primário (Brand Accent):** **Tux Petrol Teal / Cyan** — No tema claro, utiliza-se o tom profundo `#0e7490` (Teal 700) para garantir leitura de texto branco e contraste conforme WCAG AA (5.36:1); no tema escuro, utiliza-se `#38bdf8` (Cyan 400) com texto escuro `#0b0f17` (8.95:1 AAA).
- **Tom Secundário (Warm Accent):** **Tux Amber** — Homenagem sutil à cor dourada do bico do Tux mascote do Linux. Quando usado como texto sobre branco, aplica-se `#92400e` (Amber 800, razão 7.09:1 AAA); no escuro, aplica-se `#fbbf24` (Amber 400, razão 10.55:1 AAA).
- **Base Neutra (Slate / Zinc):** Tons de cinza ardósia equilibrados, sem o fundo amarelado de apps Windows antigos e sem o preto puro OLED que cansa a vista.

```
+---------------------------------------------------------------------------------------+
| TuxSQL v2 Brand Colors & Validated Roles:                                             |
|                                                                                       |
| [ #0e7490 ] Tux Teal Deep (Primary Light Button & Text) -> 5.36:1 (AA) sobre branco  |
| [ #38bdf8 ] Tux Cyan Vivid (Primary Dark Button)        -> 8.95:1 (AAA) com #0b0f17   |
| [ #92400e ] Tux Amber Deep (Light Warning / Warm Text)   -> 7.09:1 (AAA) sobre branco  |
| [ #fbbf24 ] Tux Amber Vivid (Dark Warning / Warm Text)   -> 10.55:1 (AAA) sobre base   |
| [ #0f172a ] Deep Slate (Text Light / Canvas Dark)        -> 17.85:1 (AAA) sobre branco |
+---------------------------------------------------------------------------------------+
```

### 3.2. Tokens de Design e Tabela de Verificação Rigorosa WCAG 2.1

Todos os tokens e pares de cor foram validados matematicamente pela fórmula oficial de **Luminância Relativa W3C** através do script autoral `document/ux/check-contrast.py`. O arquivo `document/ux/tokens-v2.css` reúne a declaração CSS pronta para uso.

#### Tabela Oficial de Pares e Razão de Contraste Calculada

| Par Avaliado (Elemento / Fundo) | Hexadecimal | Razão Calculada | Limiar WCAG | Nível Atingido |
|---|---|:---:|:---:|:---:|
| **Light: Texto Primário s/ Superfície Base** | `#0f172a` sobre `#ffffff` | **17.85:1** | $\ge 4.5:1$ | **AAA** |
| **Light: Texto Primário s/ Canvas da Aplicação** | `#0f172a` sobre `#f1f5f9` | **16.30:1** | $\ge 4.5:1$ | **AAA** |
| **Light: Texto Secundário s/ Superfície Base** | `#334155` sobre `#ffffff` | **10.35:1** | $\ge 4.5:1$ | **AAA** |
| **Light: Texto Secundário s/ Canvas** | `#334155` sobre `#f1f5f9` | **9.45:1** | $\ge 4.5:1$ | **AAA** |
| **Light: Texto Terciário s/ Superfície Base** | `#475569` sobre `#ffffff` | **7.58:1** | $\ge 4.5:1$ | **AAA** |
| **Light: Texto Terciário s/ Canvas** | `#475569` sobre `#f1f5f9` | **6.92:1** | $\ge 4.5:1$ | **AA** |
| **Light: Texto Terciário s/ Hover de Linha** | `#475569` sobre `#e2e8f0` | **6.15:1** | $\ge 4.5:1$ | **AA** |
| **Light: Texto Branco s/ Botão Primário Teal** | `#ffffff` sobre `#0e7490` | **5.36:1** | $\ge 4.5:1$ | **AA** |
| **Light: Acento Teal como Texto s/ Branco** | `#0e7490` sobre `#ffffff` | **5.36:1** | $\ge 4.5:1$ | **AA** |
| **Light: Acento Âmbar como Texto s/ Branco** | `#92400e` sobre `#ffffff` | **7.09:1** | $\ge 4.5:1$ | **AAA** |
| **Light: Borda de Controles/Inputs s/ Superfície** | `#718096` sobre `#ffffff` | **4.02:1** | $\ge 3.0:1$ | **UI AA** |
| **Light: Borda de Controles/Inputs s/ Canvas** | `#718096` sobre `#f1f5f9` | **3.67:1** | $\ge 3.0:1$ | **UI AA** |
| **Light: Anel de Foco (Focus Ring) s/ Superfície** | `#0284c7` sobre `#ffffff` | **4.10:1** | $\ge 3.0:1$ | **UI AA** |
| **Light Badge Dev: Texto s/ Fundo Tintado** | `#5b21b6` sobre `#f5f3ff` | **8.19:1** | $\ge 4.5:1$ | **AAA** |
| **Light Badge Test: Texto s/ Fundo Tintado** | `#0369a1` sobre `#f0f9ff` | **5.57:1** | $\ge 4.5:1$ | **AA** |
| **Light Badge Sandbox: Texto s/ Fundo Tintado** | `#065f46` sobre `#ecfdf5` | **7.29:1** | $\ge 4.5:1$ | **AAA** |
| **Light Badge Prod: Texto s/ Fundo Tintado** | `#991b1b` sobre `#fef2f2` | **7.60:1** | $\ge 4.5:1$ | **AAA** |
| **Light Badge Dev: Borda s/ Canvas** | `#8b5cf6` sobre `#f1f5f9` | **3.87:1** | $\ge 3.0:1$ | **UI AA** |
| **Light Badge Test: Borda s/ Canvas** | `#0284c7` sobre `#f1f5f9` | **3.74:1** | $\ge 3.0:1$ | **UI AA** |
| **Light Badge Sandbox: Borda s/ Canvas** | `#059669` sobre `#f1f5f9` | **3.44:1** | $\ge 3.0:1$ | **UI AA** |
| **Light Badge Prod: Borda s/ Canvas** | `#dc2626` sobre `#f1f5f9` | **4.41:1** | $\ge 3.0:1$ | **UI AA** |
| **Dark: Texto Primário s/ Superfície Base** | `#f8fafc` sobre `#131924` | **16.84:1** | $\ge 4.5:1$ | **AAA** |
| **Dark: Texto Primário s/ Canvas da Aplicação** | `#f8fafc` sobre `#0b0f17` | **18.33:1** | $\ge 4.5:1$ | **AAA** |
| **Dark: Texto Secundário s/ Superfície Base** | `#cbd5e1` sobre `#131924` | **11.86:1** | $\ge 4.5:1$ | **AAA** |
| **Dark: Texto Secundário s/ Painel Elevado** | `#cbd5e1` sobre `#1a2234` | **10.70:1** | $\ge 4.5:1$ | **AAA** |
| **Dark: Texto Terciário s/ Superfície Base** | `#94a3b8` sobre `#131924` | **6.87:1** | $\ge 4.5:1$ | **AA** |
| **Dark: Texto Terciário s/ Painel Elevado** | `#94a3b8` sobre `#1a2234` | **6.19:1** | $\ge 4.5:1$ | **AA** |
| **Dark: Texto Terciário s/ Hover de Linha** | `#94a3b8` sobre `#232d42` | **5.37:1** | $\ge 4.5:1$ | **AA** |
| **Dark: Texto Escuro s/ Botão Primário Cyan** | `#0b0f17` sobre `#38bdf8` | **8.95:1** | $\ge 4.5:1$ | **AAA** |
| **Dark: Acento Cyan como Texto s/ Base** | `#38bdf8` sobre `#131924` | **8.22:1** | $\ge 4.5:1$ | **AAA** |
| **Dark: Acento Âmbar como Texto s/ Base** | `#fbbf24` sobre `#131924` | **10.55:1** | $\ge 4.5:1$ | **AAA** |
| **Dark: Borda de Controles/Inputs s/ Superfície** | `#64748b` sobre `#131924` | **3.70:1** | $\ge 3.0:1$ | **UI AA** |
| **Dark: Borda de Controles/Inputs s/ Painel Elevado** | `#64748b` sobre `#1a2234` | **3.34:1** | $\ge 3.0:1$ | **UI AA** |
| **Dark: Anel de Foco (Focus Ring) s/ Superfície** | `#38bdf8` sobre `#131924` | **8.22:1** | $\ge 3.0:1$ | **AAA** |
| **Dark Badge Dev: Texto s/ Fundo Tintado** | `#ddd6fe` sobre `#2e1065` | **10.97:1** | $\ge 4.5:1$ | **AAA** |
| **Dark Badge Test: Texto s/ Fundo Tintado** | `#bae6fd` sobre `#082f49` | **10.46:1** | $\ge 4.5:1$ | **AAA** |
| **Dark Badge Sandbox: Texto s/ Fundo Tintado** | `#a7f3d0` sobre `#022c22` | **11.81:1** | $\ge 4.5:1$ | **AAA** |
| **Dark Badge Prod: Texto s/ Fundo Tintado** | `#fecaca` sobre `#450a0a` | **11.16:1** | $\ge 4.5:1$ | **AAA** |
| **Dark Badge Dev: Borda s/ Superfície Base** | `#7c3aed` sobre `#131924` | **3.09:1** | $\ge 3.0:1$ | **UI AA** |
| **Dark Badge Test: Borda s/ Superfície Base** | `#0284c7` sobre `#131924` | **4.30:1** | $\ge 3.0:1$ | **UI AA** |
| **Dark Badge Sandbox: Borda s/ Superfície Base** | `#059669` sobre `#131924` | **4.67:1** | $\ge 3.0:1$ | **AA** |
| **Dark Badge Prod: Borda s/ Superfície Base** | `#dc2626` sobre `#131924` | **3.65:1** | $\ge 3.0:1$ | **UI AA** |

> **Resultado do Teste Automatizado:** **58 de 58 pares APROVADOS (0 falhas)** no script executável `document/ux/check-contrast.py` (cobrindo tokens base e todos os estados de botões, inputs, abas, grade, badges e alertas de produção).

#### Resumo dos Ajustes Técnicos de Contraste
1. **Botão Primário:**
   - *Light Mode:* O fundo adota o tom profundo petrol teal `#0e7490` com texto branco `#ffffff` (**5.36:1**, supera o mínimo de 4.5:1). Hover em `#155e75` (**7.27:1 AAA**).
   - *Dark Mode:* O fundo adota o ciano vibrante `#38bdf8` com tipografia escura `--text-on-accent: #0b0f17` (**8.95:1 AAA**), eliminando a perda de contraste de texto branco sobre tons claros.
2. **Badges de Ambiente com Fundo Tintado:**
   - Em vez de texto isolado sobre fundo branco, os badges aplicam a técnica moderna de fundo tintado com texto saturado contrastante:
     - `Dev`: Fundo `#f5f3ff` com texto `#5b21b6` (**8.19:1 AAA**) e borda `#8b5cf6` (**3.87:1 UI AA**).
     - `Test`: Fundo `#f0f9ff` com texto `#0369a1` (**5.57:1 AA**) e borda `#0284c7` (**3.74:1 UI AA**).
     - `Sandbox`: Fundo `#ecfdf5` com texto `#065f46` (**7.29:1 AAA**) e borda `#059669` (**3.44:1 UI AA**).
     - `Prod`: Fundo `#fef2f2` com texto `#991b1b` (**7.60:1 AAA**) e borda `#dc2626` (**4.41:1 UI AA**).
3. **Bordas de Controles (Inputs, Selects e Botões):**
   - Introduzido o token explícito `--border-control`: `#718096` no claro (**4.02:1**, superando o critério WCAG de 3.0:1 para limites de controles de interface) e `#64748b` no escuro (**3.70:1** sobre a base e **3.34:1** sobre painéis elevados). Divisores puramente decorativos mantêm `--border-subtle: #e2e8f0` / `#1e2738`.
4. **Anel de Foco Acessível (Focus Ring):**
   - `--border-focus` regulado para `#0284c7` no claro (**4.10:1**) e `#38bdf8` no escuro (**8.22:1**), garantindo visibilidade clara para navegação via teclado.
5. **Texto Terciário e Âmbar Calibrados:**
   - `--text-tertiary` atualizado para `#475569` no claro (**7.58:1** no branco, **6.92:1** no canvas e **6.15:1** no hover de tabela, todos $\ge 4.5:1$) e `#94a3b8` no escuro (**6.87:1** na base e **6.19:1** no painel elevado).
   - `--color-amber-text` ajustado para `#92400e` no claro (**7.09:1 AAA**) e `#fbbf24` no escuro (**10.55:1 AAA**).

#### Tipografia
- **Família Sans-serif (Interface):** `Inter, system-ui, -apple-system, 'Segoe UI', Cantarell, 'Noto Sans', Ubuntu, sans-serif`
  - Pesos: Regular (400), Medium (500), Semi-Bold (600).
- **Família Monospace (Editor e Resultados):** `'JetBrains Mono', 'Fira Code', 'Ubuntu Mono', Consolas, monospace`
  - Suporte a ligaduras desativável por opção do usuário.

#### Escala de Espaçamento e Raios
- **Espaçamento (Grid de 4px):**
  - `--space-1`: 4px | `--space-2`: 8px | `--space-3`: 12px | `--space-4`: 16px | `--space-6`: 24px | `--space-8`: 32px
- **Raios de Borda (Border Radius):**
  - `--radius-xs`: 3px (badges e chips pequenos)
  - `--radius-sm`: 6px (botões e caixas de texto)
  - `--radius-md`: 8px (cartões, popovers e diálogos modais)
  - `--radius-lg`: 12px (janelas principais e diálogos amplos)
  - `--radius-full`: 9999px (pílulas de status e tags circulares)

---

## 4. O Novo Shell do TuxSQL v2

### 4.1. Análise de Alternativas de Estrutura de Tela

Avaliamos 3 modelos de arquitetura de janelas para superar o visual clássico do dbForge:

#### Alternativa A: Modern Unified Workbench (RECOMENDADA)
- **Integração com Moldura Nativa de Janela (Linux Titlebar):** No Linux (GNOME / Mutter, KDE / KWin, Pop!_OS / Cosmic), o TuxSQL adota a moldura nativa do gerenciador de janelas do sistema operacional. O uso de janelas sem bordas nativas (*frameless* / CSD personalizado com botões emulados `[ _ □ ✕ ]`) quebra com frequência atalhos de gerenciamento de janela (`Super + Setas`), perda de auto-tiling do Pop Shell / i3 / Sway, comportamentos do compositor de sombras/cantos e gestos táteis. Dessa forma, os botões minimizar/maximizar/fechar pertencem exclusivamente ao sistema operacional.
- **Application Command Bar / Header Unificado (38px):** Posicionado como a **primeira linha da área de cliente da aplicação** (logo abaixo da titlebar nativa do SO). Contém o seletor de conexões, a barra de busca e Command Palette centralizada (`Ctrl+K`), o Badge de Ambiente ativo (`[🔴 PROD: aws-rds-main]`), botão de execução primário (`Run F5`), ações de commit/rollback e atalho de configurações. Elimina 70px de toolbars empilhadas e poluídas do dbForge sem conflitar com o desktop Linux.
- **Barra de Atividades Vertical Esquerda (48px):** Ícones limpos com separador inferior para Settings e Perfil.
- **Sidebar Recolhível com Acordeão Leve (240px a 360px):** Abriga o Database Explorer, Projetos, Histórico ou Branches dependendo da atividade selecionada.
- **Área Central Flexível:** Editor Monaco e Grade de Resultados em split ajustável com abas modernas no topo.
- **Barra de Status Inferior Ergonômica (24px):** Mostra conexão ativa, host, codificação, linhas retornadas, tempo de execução e seletor rápido de densidade visual.

#### Alternativa B: Floating HUD / Canvas Livre
- Painéis flutuantes sobrepostos sem barras fixas (estilo Figma ou Blender).
- *Rejeitada:* Embora muito moderna, gera perda de produtividade em edição pesada de banco de dados onde os desenvolvedores dependem de ancoragem estável e alinhamento milimétrico de tabelas.

#### Alternativa C: Top Navigation Tabs (Browser Style)
- Abas no topo extremo da janela estilo Google Chrome / Arc Browser.
- *Rejeitada:* Sacrifica o espaço horizontal para abas quando há múltiplos documentos SQL abertos em paralelo.

### 4.2. Wireframe em ASCII do Novo Shell (Alternativa A — Recomendada)

```
[ Moldura Nativa do SO (GNOME / KDE / Pop!_OS) ────────── TuxSQL ────────── [ _ □ ✕ ] ]
+--------------------------------------------------------------------------------------------------------------------------+
| [TuxSQL] [📁 Conexões ▾]  [ 🔍 Localizar ou Executar Comando... (Ctrl+K) ]  [🔴 PROD: aws-rds-main]  [▶ Run (F5)] [⚙️ Config]|
+----+-----------------------+-------------------------------------------------------------------------------+-------------+
| 🗄️ | DATABASE EXPLORER     | [customers.sql *] [orders_report.sql] [schema-diff-stg] [+]                 | ⚡ AI Assist |
|    | 🔍 Filtrar (Regex)... | +-----------------------------------------------------------------------------+-------------+
|    +-----------------------+ | 1  SELECT c.id, c.name, SUM(o.total_amount) as total_spent                     | Contexto:   |
| ⚡ | ▾ 🔴 aws-rds-main     | 2  FROM customers c                                                           | [aws-rds]   |
|    |   ▾ 📁 shop_prod      | 3  JOIN orders o ON o.customer_id = c.id                                      |             |
|    |     ▾ 📁 Tables (14)  | 4  WHERE o.status = 'COMPLETED'                                               | Pergunte ao |
| 🔀 |       📄 customers    | 5  GROUP BY c.id, c.name                                                      | assistente: |
|    |       📄 orders       | 6  ORDER BY total_spent DESC                                                  | [Gerar SQL] |
|    |       📄 products     | 7  LIMIT 100;                                                                 |             |
| ⚖️ |     📁 Views (3)      | +-----------------------------------------------------------------------------+             |
|    |     📁 Routines (8)   | Results: 100 rows in 42ms | [Table View] [Card View] [Pivot] [Chart] [Export] |             |
|    |   📁 analytics_db     | +----+----------------------+-------------------+-----------------------------+             |
| ⚙️ |                       | | id | name                 | total_spent       | status                      |             |
|    |                       | +----+----------------------+-------------------+-----------------------------+             |
|    |                       | | 1  | Alice Henderson      | 14.850,00         | active                      |             |
|    |                       | | 2  | Bruno Silva          | 9.420,50          | active                      |             |
+----+-----------------------+----+----------------------+-------------------+-----------------------------+-------------+
| 🟢 Conectado: aws-rds-main (MySQL 8.4.2) | utf8mb4 | SSL Ativo | Transação: AutoCommit | Densidade: [Normal ▾] | UTF-8     |
+--------------------------------------------------------------------------------------------------------------------------+
```

---

## 5. Componentes Base Redesenhados

Todos os componentes do TuxSQL v2 são especificados com base estrita nos tokens definidos em `tokens-v2.css`, validados contra critérios WCAG 2.1 Nível AA e AAA pelo script executável `check-contrast.py`. Nenhum componente utiliza cores literais arbitrárias.

### 5.1. Botões (Buttons)
- **Primary:**
  - *Estado Normal:* Fundo `--color-accent` (`#0e7490` claro / `#38bdf8` escuro), texto `--text-on-accent` (`#ffffff` claro com 5.36:1 AA / `#0b0f17` escuro com 8.95:1 AAA), raio `--radius-sm` (6px), elevação `--shadow-sm`, borda `1px solid transparent`.
  - *Hover:* Fundo `--color-accent-hover` (`#155e75` claro / `#0284c7` escuro) com transição `--transition-fast` (120ms).
  - *Active:* Fundo `--color-surface-active` (`#cbd5e1` claro / `#2d3a54` escuro).
  - *Disabled:* Fundo `--color-surface-hover` (`#e2e8f0` claro / `#232d42` escuro), texto `--text-disabled` (`#64748b` claro / `#475569` escuro), cursor `not-allowed`.
  - *Focus:* `outline: 2px solid var(--border-focus); outline-offset: 2px` (`#0284c7` claro / `#38bdf8` escuro).
- **Secondary:**
  - *Estado Normal:* Fundo `--color-surface-raised` (`#f8fafc` claro / `#1a2234` escuro), borda `1px solid var(--border-control)` (`#718096` claro com 4.02:1 / `#64748b` escuro com 3.70:1 e 3.34:1, aprovado $\ge 3.0:1$), texto `--text-primary` (`#0f172a` claro / `#f8fafc` escuro).
  - *Hover:* Fundo `--color-surface-hover`, borda `1px solid var(--border-control)`, texto `--text-primary`.
  - *Active:* Fundo `--color-surface-active`.
  - *Disabled:* Fundo `--color-surface-raised`, borda `1px solid var(--border-subtle)`, texto `--text-disabled`.
  - *Focus:* Anel de foco `outline: 2px solid var(--border-focus); outline-offset: 2px`.
- **Ghost / ToolButton:**
  - *Estado Normal:* Fundo transparente, borda `1px solid transparent`, texto `--text-secondary` (`#334155` claro / `#cbd5e1` escuro).
  - *Hover:* Fundo `--color-surface-hover` (`#e2e8f0` claro / `#232d42` escuro), texto `--text-primary`.
  - *Active:* Fundo `--color-surface-active`.
  - *Disabled:* Fundo transparente, texto `--text-disabled`.
  - *Focus:* Anel de foco `var(--border-focus)`.
- **Destructive / Danger:**
  - *Estado Normal:* Ações irreversíveis (`Drop`, `Truncate`). Fundo `--status-error` (`#b91c1c` claro / `#f87171` escuro), texto `--text-on-accent` (`#ffffff` claro com 6.47:1 AA / `#0b0f17` escuro com 6.93:1 AA), raio `--radius-sm`, borda `1px solid transparent`.
  - *Hover:* No claro, tom aprofundado (`#991b1b`); no escuro, tom com transição `--transition-fast`.
  - *Active:* Fundo `--color-surface-active`.
  - *Disabled:* Fundo `--color-surface-hover`, texto `--text-disabled`.
  - *Focus:* Anel de foco `outline: 2px solid var(--border-focus); outline-offset: 2px`.

### 5.2. Command Palette (`Ctrl+K` ou `Ctrl+Shift+P`)
Uma janela flutuante modal centralizada no terço superior da tela:
- **Overlay (Backdrop):** Fundo translúcido `rgba(0, 0, 0, 0.45)` cobrindo a tela.
- **Container Modal:** Fundo `--color-surface-overlay` (`#ffffff` claro / `#1e2738` escuro), borda `1px solid var(--border-control)` (`#718096` claro / `#64748b` escuro), raio `--radius-md` (8px), sombra profunda `--shadow-overlay`.
- **Campo de Busca (Input):**
  - Fundo `--color-surface-base` (`#ffffff` claro / `#131924` escuro).
  - Borda `1px solid var(--border-control)`.
  - Foco: anel visível `2px solid var(--border-focus)`.
  - Texto digitado: `--text-primary` (`#0f172a` claro / `#f8fafc` escuro, contraste $\ge 16:1$ AAA).
  - Placeholder: `--text-tertiary` (`#475569` claro com 7.58:1 AAA / `#94a3b8` escuro com 6.87:1 AA).
- **Lista de Resultados e Categorias:**
  - Cabeçalhos de Categoria (*Ações*, *Conexões*, *Objetos do Banco*, *Navegação*): Texto `--text-tertiary`, tipografia 11px uppercase weight 600.
  - Item em Repouso: Texto `--text-primary`, ícones auxiliares `--text-secondary`.
  - Item em Hover ou Selecionado por Teclado (`↑`/`↓`): Fundo `--color-surface-hover` (`#e2e8f0` claro / `#232d42` escuro), borda lateral esquerda de destaque `3px solid var(--color-accent)` (`#0e7490` claro / `#38bdf8` escuro), texto `--text-primary`.
  - Badge de Atalho Teclado: Fundo `--color-surface-raised`, borda `1px solid var(--border-subtle)`, texto `--text-secondary`.
  - Divisores Internos: `1px solid var(--border-subtle)`.

### 5.3. Grade de Dados e Resultados (ResultGrid v2)
A grade de dados é o coração analítico do TuxSQL:
- **Container da Grade:** Fundo `--color-surface-base`, borda perimetral `1px solid var(--border-default)`.
- **Cabeçalhos de Coluna (Headers):**
  - Altura 32px, fundo `--color-surface-raised` (`#f8fafc` claro / `#1a2234` escuro), borda inferior `1px solid var(--border-default)`, divisores verticais `1px solid var(--border-subtle)`.
  - Tipografia: Texto `--text-secondary` (`#334155` claro com 9.90:1 AAA / `#cbd5e1` escuro com 10.70:1 AAA) em peso medium (500).
  - Ícones de Tipos (`# int`, `Abc varchar`, `📅 date`) e setas de ordenação (`▲`/`▼`) em `--text-tertiary`.
- **Células e Linhas de Dados:**
  - *Linha Normal:* Fundo `--color-surface-base`, texto `--text-primary`.
  - *Zebra Striping (Opcional):* Linhas alternadas com fundo `--color-canvas-app` ultra-suave.
  - *Linha em Hover:* Fundo `--color-surface-hover` (`#e2e8f0` claro / `#232d42` escuro), texto `--text-primary` (contraste verificado de 6.15:1 AA claro e 5.37:1 AA escuro).
  - *Linha Selecionada:* Fundo `--color-surface-active` (`#cbd5e1` claro / `#2d3a54` escuro), texto `--text-primary` (`#0f172a` sobre `#cbd5e1` = 12.02:1 AAA claro; `#f8fafc` sobre `#2d3a54` = 10.88:1 AAA escuro).
  - *Célula em Edição (Inline Cell Editing):* Fundo `--color-surface-base`, borda interna ativa `2px solid var(--border-focus)` (`#0284c7` claro / `#38bdf8` escuro), texto `--text-primary`.
  - *Valores NULL:* Renderizados em itálico com texto `--text-tertiary` (`#475569` claro / `#94a3b8` escuro) sobre fundo `--color-surface-hover` com raio `--radius-xs`: `(null)`.
- **Barra de Ferramentas de Grade Embutida:**
  - Barra inferior de 28px com fundo `--color-surface-raised`, borda superior `1px solid var(--border-subtle)`.
  - Paginação (`◀ 1 de 45 ▶`) e contadores com texto `--text-secondary`.
  - Botões de alternância de visualização (`Grade`, `Card View`, `Pivot`, `Gráfico`) e botão `Exportar` no padrão ToolButton/Ghost.

### 5.4. Abas de Documentos (Document Tabs v2)
- **Container da Barra de Abas:** Altura 34px, fundo `--color-surface-raised` (`#f8fafc` claro / `#1a2234` escuro), borda inferior `1px solid var(--border-default)`.
- **Aba Inativa:** Fundo `--color-surface-raised`, borda lateral `1px solid var(--border-subtle)`, texto `--text-secondary` (`#334155` claro com 9.90:1 AAA / `#cbd5e1` escuro com 10.70:1 AAA). Em hover, fundo `--color-surface-hover` com texto `--text-primary`.
- **Aba Ativa:** Fundo `--color-surface-base` (`#ffffff` claro / `#131924` escuro), em continuidade direta sem linha divisória inferior com o editor. Borda superior de 2px em destaque com `--color-accent` (`#0e7490` claro / `#38bdf8` escuro). Texto `--text-primary` (`#0f172a` claro com 17.85:1 AAA / `#f8fafc` escuro com 16.84:1 AAA) em peso medium (500).
- **Indicador de Modificação (Dirty State):** Círculo preenchido `●` com o token `--color-amber-accent` (`#d97706` claro / `#fbbf24` escuro) posicionado à esquerda do botão fechar.
- **Botão Fechar (`×`):** Raio `--radius-xs`, texto `--text-tertiary`, transição com fundo `--color-surface-hover` e texto `--text-primary` ao passar o mouse.

### 5.5. Badges de Ambiente e Production Guard (Ambience Badges & Production Guard)
- **Badges Semânticos de Ambiente (Header da Aplicação e Database Explorer):**
  - **Dev:** Fundo `--env-dev-bg` (`#f5f3ff` claro / `#2e1065` escuro), texto `--env-dev-text` (`#5b21b6` claro com 8.19:1 AAA / `#ddd6fe` escuro com 10.97:1 AAA), borda `1px solid var(--env-dev-border)` (`#8b5cf6` claro com 3.87:1 UI AA / `#7c3aed` escuro com 3.09:1 UI AA), raio `--radius-xs` (3px).
  - **Test:** Fundo `--env-test-bg` (`#f0f9ff` claro / `#082f49` escuro), texto `--env-test-text` (`#0369a1` claro com 5.57:1 AA / `#bae6fd` escuro com 10.46:1 AAA), borda `1px solid var(--env-test-border)` (`#0284c7` claro com 3.74:1 UI AA / `#0284c7` escuro com 4.30:1 UI AA), raio `--radius-xs`.
  - **Sandbox:** Fundo `--env-sandbox-bg` (`#ecfdf5` claro / `#022c22` escuro), texto `--env-sandbox-text` (`#065f46` claro com 7.29:1 AAA / `#a7f3d0` escuro com 11.81:1 AAA), borda `1px solid var(--env-sandbox-border)` (`#059669` claro com 3.44:1 UI AA / `#059669` escuro com 4.67:1 AA), raio `--radius-xs`.
  - **Prod:** Fundo `--env-prod-bg` (`#fef2f2` claro / `#450a0a` escuro), texto `--env-prod-text` (`#991b1b` claro com 7.60:1 AAA / `#fecaca` escuro com 11.16:1 AAA), borda `1px solid var(--env-prod-border)` (`#dc2626` claro com 4.41:1 UI AA / `#dc2626` escuro com 3.65:1 UI AA), raio `--radius-xs`.
- **Production Guard (Proteção de Ambiente Produtivo):**
  Quando a conexão ativa pertencer à categoria **Production**:
  - **Linha de Alerta Contínua:** Uma linha destacada de 2px com a cor semântica `--env-prod-border` (`#dc2626`, com contraste verificado de 4.62:1 claro e 3.29:1 escuro sobre o cabeçalho `--color-surface-raised`) é renderizada na borda inferior do Header da aplicação (Application Command Bar) e na borda superior da Status Bar.
  - **Badge de Alerta no Header:** Exibe `🔴 PROD: [nome da conexão]`.
  - **Banner de Proteção:** Avisos e diálogos de confirmação usam fundo `--env-prod-bg`, borda `1px solid var(--env-prod-border)` e texto `--env-prod-text`, alertando explicitamente: *"Atenção: Você está operando em uma base de dados de Produção. Comandos destrutivos exigirão confirmação explícita."*

---

## 6. Plano de Migração em Ondas Independentes

Para permitir que a equipe de engenharia (Codex / Forja / Bigorna / Martelo) execute o redesign sem quebrar testes automatizados existentes nem paralisar entregas, o trabalho deve ser fatiado em **4 ondas independentes e progressivas**:

```
+─────────────────────────────────────────────────────────────────────────────+
| ONDA 1: Fundações & Tokens de Estilo                                        |
| -> Criação das variáveis CSS v2 em styles.css sem alterar tags HTML         |
+─────────────────────────────────────────────────────────────────────────────+
                                      ↓
+─────────────────────────────────────────────────────────────────────────────+
| ONDA 2: Componentes Base & Átomos de Interface                              |
| -> Botões, inputs, abas, badges e modais modernizados mantendo IDs e roles |
+─────────────────────────────────────────────────────────────────────────────+
                                      ↓
+─────────────────────────────────────────────────────────────────────────────+
| ONDA 3: Novo Shell & Header Unificado (Workbench Layout)                    |
| -> Activity Bar vertical, Command Palette e eliminação das toolbars densas |
+─────────────────────────────────────────────────────────────────────────────+
                                      ↓
+─────────────────────────────────────────────────────────────────────────────+
| ONDA 4: Módulos Especializados & Acabamento Final                           |
| -> Redesign temático de Query Builder, Schema Compare, ER Diagram e Wizards |
+─────────────────────────────────────────────────────────────────────────────+
```

### Onda 1 — Fundações e Variáveis Globais (Zero Risco)
- **Escopo:** Substituir o bloco `:root` e `:root[data-theme='dark']` em `app/src/renderer/src/ui/styles.css` pelos novos tokens de cores, tipografia, espaçamento e sombras do TuxSQL v2.
- **Impacto em Testes:** **Zero**. Nenhuma tag, classe funcional ou estrutura de DOM é alterada; o aplicativo ganha imediatamente a nova paleta *Tux Teal* e contraste revisado.

### Onda 2 — Componentes Base (Botões, Inputs, Abas, Badges)
- **Escopo:** Modernizar a estilização de botões, barras de abas, campos de busca, menus contextuais e badges de ambiente.
- **Regra de Não-Regressão para Testes e2e:**
  - Manter rigorosamente os atributos de acessibilidade e busca dos testes: `role="button"`, `role="tab"`, `aria-label`, `data-testid` e textos dos botões.
  - Exemplo: O botão de execução continua contendo o texto ou label `"Execute"` / `"Executar"`, permitindo que os scripts Playwright/Puppeteer continuem localizando o elemento sem falhas.

### Onda 3 — Novo Shell e Header Unificado
- **Escopo:** Implementação da Activity Bar vertical (48px), agrupamento do header em 38px, introdução da Command Palette (`Ctrl+K`) e modernização da Status Bar.
- **Compatibilidade:** Os comandos de menu clássicos continuam existindo sob o menu de aplicação global e na Command Palette; atalhos como `Ctrl+Shift+P`, `Ctrl+N`, `Ctrl+O` e `F5` continuam acionando os mesmos disparadores IPC.

### Onda 4 — Modernização dos Módulos Especializados
- **Escopo:** Aplicação do novo padrão visual nas ferramentas complexas:
  - *Query Builder:* Cartões de tabela translúcidos com conexões de chave estrangeira em curvas suaves de Bézier.
  - *Schema / Data Compare:* Abas de diferenças com contadores em pílulas coloridas modernas e diffs limpos sem bordas duras.
  - *ER Diagram:* Paleta refinada com nós de tabela arredondados e sombras suaves de profundidade.
  - *Chart Designer:* Implementação conforme o spec `document/ux/20-chart-designer.md`.

---

## 7. O que NÃO Muda (Garantias de Continuidade e Regras do Produto)

Para manter a estabilidade total e a confiança dos usuários e testes automatizados:

1. **Fluxos de Negócio e Funcionalidades:**
   - Nenhum fluxo é removido, simplificado ou escondido. Conexão, execução de queries, exportação, backup, restore, debugger, comparadores e documentador funcionam com a mesma lógica já homologada.
2. **Mapa de Atalhos de Teclado:**
   - 100% dos atalhos já testados permanecem vinculados às mesmas ações (`F5` para executar, `F8` para executar instrução sob o cursor, `Ctrl+K, D` para formatar, `Ctrl+F` para localizar, `Ctrl+D, Q` para Security Manager, etc.).
3. **Internacionalização e Textos (i18n):**
   - Todas as chaves e mensagens dos dicionários em português (`pt-BR`) e inglês (`en-US`) continuam exatamente as mesmas; apenas o invólucro visual ao redor delas é modernizado.
4. **Política de Segurança Linux do Dono do Produto:**
   - Permissões estritas de arquivo (`chmod 0700`), uso de `libsecret`/`safeStorage` no Linux, elevação transparente com `pkexec` e confirmação por frase digitada para operações perigosas permanecem ativas e intocadas.

---

## 8. Conclusão

Com a especificação da **Direção Visual v2**, o TuxSQL abandona em definitivo a estética de "clone do dbForge" e assume a postura de um **ambiente de banco de dados moderno, elegante e de primeira classe para Linux**, rivalizando com os melhores ambientes de desenvolvimento do mercado contemporâneo.
