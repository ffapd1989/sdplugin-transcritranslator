# Roadmap

O que ficou para as próximas rodadas, com contexto suficiente para retomar sem reconstruir o
raciocínio. Ordem = prioridade sugerida, não obrigação.

Ao mexer em qualquer item: subir [version.json](../version.json) antes de commitar
(ver [CLAUDE.md](../CLAUDE.md), *REGRA: toda alteração sobe a versão*).

---

## 0. Teste com voz — ✅ caminho principal FUNCIONANDO

**Validado em 25/07/2026, v1.0.1.1.** O plugin transcreve fala real e entrega o texto: gravar →
transcrever → colar funciona de ponta a ponta. Era o item que bloqueava todos os outros, e não
bloqueia mais.

Faltam os **casos de borda**, que não se exercitam usando normalmente — cada um existe para uma
situação que só aparece quando dá errado:

- [x] Ditar e colar (caminho principal)
- [ ] Modo `ptt` (segurar para gravar)
- [ ] Auto-parar: falar e ficar 3 s calado
- [ ] Segurar durante a gravação → `SOLTE P/ CANCELAR`, nada é enviado
- [ ] **Trocar de janela durante o processamento** → não cola, avisa "copiado"
- [ ] **Trocar de página no XL durante a gravação** → entrega mesmo assim
- [ ] **Apertar e parar sem falar** → "sem fala", nada colado (blindagem anti-eco)
- [ ] Dicionário: cadastrar sigla, ditar, conferir a grafia canônica
- [ ] Comandos falados: "vírgula", "novo parágrafo"
- [ ] Guardrail: ditar algo que a política recuse → deve colar o **texto cru**, não perder a fala
- [x] Atalho de teclado: acionar e encerrar (validado com voz em 27/07/2026)
- [ ] Atalho com a tecla em **outra página/perfil** → o visor emprestado assume, e tocar nele
      encerra o ditado alheio
- [ ] Atalho com **nenhuma** tecla do plugin à vista → roda no escuro, só com os bipes
- [ ] Atalho com **jogo em tela cheia** → não grava, não bipa, não gasta nada

> Os três em negrito são os que envolvem lógica que ninguém testou ainda e que falha em
> silêncio — se o anti-eco não funcionar, um toque acidental cola a sua lista de siglas dentro
> do documento. Roteiro completo em [PLANO-ORIGINAL.md](PLANO-ORIGINAL.md), seção *Verificação*.
>
> Anotar aqui o que sair torto, em vez de corrigir de imediato — o padrão de falha é mais
> informativo que o primeiro sintoma.

---

## 1. Discovery

Duas perguntas que não se resolvem discutindo — precisam de experimento.

### 1.1 O prompt de transcrição serve para alguma coisa?

**Questão em aberto que nunca foi medida.** Mantivemos o `prompt` na etapa 1 por raciocínio,
não por evidência: a doc diz que ele existe, e os modelos GPT-4o "seguem instrução" ao
contrário do whisper. Mas ninguém verificou se, no `gpt-4o-mini-transcribe`, ele **melhora
alguma coisa que a correção por regex já não resolva**.

O que se sabe hoje:

- A doc da OpenAI diz apenas que o prompt "guia o estilo" e "deve estar no idioma do áudio".
  Não promete ganho de acurácia em vocabulário.
- O FALA TU **tirou** o prompt de transcrição em produção — o modelo alucinava a lista inteira
  em áudio curto ou silencioso. Nós mantivemos com três blindagens, mas nunca testamos se o
  benefício compensa o risco que estamos administrando.
- A regex do dicionário corrige a **grafia** (`cpc` → `CPC`) e não corrige o **som**
  (`cê-pê-cê` → `CPC`). O prompt só se justifica se resolver esse segundo caso.
- Ele **custa**: entra como tokens de entrada e pode pesar na latência, que numa tecla de
  ditado é o que mais se sente.

#### Protocolo

- [ ] Gravar um conjunto fixo de ~10 áudios curtos com **siglas ditas por extenso**
      (`cê-pê-cê`, `és-érre-vê-dê-érre-u`), nomes próprios e jargão técnico. Guardar os `.wav`
      como material de teste versionado
- [ ] Transcrever cada um em **quatro condições**: sem prompt · só dicionário · só contexto ·
      dicionário + contexto
- [ ] Medir, por condição: acerto das siglas-alvo, erro geral (WER aproximado), **latência** e
      tokens de entrada
- [ ] Rodar também o caminho completo com a regex ligada, para separar o que é mérito do prompt
      do que a regex já corrigia sozinha
- [ ] Testar o **eco** de propósito: áudio de 0,5 s, áudio só com respiração, áudio mudo — as
      blindagens pegam? Com que frequência?

#### O que decidir com o resultado

| Se… | Então |
|---|---|
| O prompt não muda o acerto de sigla falada | **Tirar da etapa 1.** Fica só a regex, e some o risco de eco |
| Ajuda só com o dicionário, não com o contexto | Manter o dicionário, tornar o contexto opt-in explícito |
| Ajuda, mas custa latência sensível | Manter, com um interruptor no painel e a medição documentada |
| Ajuda pouco e o eco é frequente | Tirar — a regex é determinística e não tem contrapartida |

> Escrever o resultado aqui, com os números. A decisão atual é uma **aposta**; o que fixa uma
> aposta é medição, não mais discussão.

### 1.2 Mostrar a tradução num popup, sem colar

**Ideia:** em vez de entregar o texto no campo em foco, exibir numa janelinha na tela. Serve
para o caso "quero só **ler** o que isso quer dizer" — legenda de um trecho estrangeiro,
conferir a tradução antes de usar, entender um áudio sem escrever nada em lugar nenhum.

O Stream Deck **não tem** API para desenhar fora da tecla: `showOk`, `showAlert` e `setImage`
param nos 72×72. A janela teria de vir do sistema operacional, e é isso que precisa ser
investigado antes de prometer.

#### Caminhos a testar (do mais provável ao menos)

- [ ] **WinForms via PowerShell**, que é a infra que o projeto já usa em
      [deliver.ts](../src/lib/deliver.ts). Janela sem borda, `TopMost`, semitransparente, que
      fecha por clique/ESC ou sozinha após N segundos. O plugin da VPN já faz janela desse jeito
      (`Vpn-Settings.ps1` no SRVDRU), então há precedente funcionando na mesma máquina
- [ ] **Toast do Windows** (notificação nativa). Mais elegante e não rouba foco, mas o texto é
      curto e some rápido — talvez sirva só para frases, não para parágrafos
- [ ] **Janela HTML** (`chrome --app` ou similar): dá o visual bonito, mas é peso grande para
      exibir um parágrafo, e sobe um processo inteiro
- [ ] Descartar de saída: usar o Property Inspector como visor. Ele só existe enquanto a tecla
      está **selecionada no app** Stream Deck — não serve para uso normal

#### O que precisa ser verdade para valer a pena

- [ ] **Não roubar o foco.** Se a janela ativar, quebra o Ctrl+V das outras teclas e atrapalha o
      que a pessoa estava fazendo. Precisa de `WS_EX_NOACTIVATE` / `ShowWithoutActivation` —
      **este é o ponto que decide a viabilidade**, testar primeiro
- [ ] Aparecer rápido. Subir um PowerShell custa ~200 ms; medir se some no tempo da API ou se
      incomoda
- [ ] Texto selecionável, para copiar manualmente se der vontade
- [ ] Fechar sem esforço: ESC, clique fora, ou tempo proporcional ao tamanho do texto
- [ ] Posição previsível — perto do cursor ou num canto fixo? Decidir depois de ver funcionando

#### Como isso entraria na configuração

Seria um terceiro destino de saída, ao lado de *copiar* e *colar*: **mostrar**. Combinável —
"mostrar e copiar" cobre o caso de ler primeiro e usar depois. O modelo de configuração já
suporta (a seção *Saída* do painel), então o trabalho é a janela em si, não o encaixe.

> Fazer um protótipo descartável do PowerShell **antes** de mexer no plugin: uma janela topmost
> sem foco com texto. Se ela roubar foco ou piscar, a ideia morre aí e não se gasta mais.

---

## 2. A tecla: fundo preto e mais elegância — ✅ feito (v1.2.0.0)

O fundo inteiro era a cor do estado, com barras e texto brancos por cima: saturado e "de
protótipo". Agora o fundo é quase-preto (`#0C0C10`) e **a cor só aparece no que informa**.

Foram desenhadas **oito** propostas e comparadas lado a lado antes de escrever qualquer código
definitivo — as folhas estão em [docs/estilos/](estilos/). Sobraram três, e a decisão foi
**não eleger uma**: viraram opção por tecla (`keyStyle`), porque as três servem a gostos
diferentes e o custo de manter as três é quase zero — o desenho dos ícones é um só.

| Direção | O que é |
|---|---|
| `neon` (padrão) | contorno aceso com halo de cor — a que mais salta num deck cheio |
| `aurora` | ícone branco sobre uma névoa de cor — a mais discreta |
| `ring` | arco-medidor na cor em volta do ícone — cara de instrumento |

Tudo em [src/lib/icons.ts](../src/lib/icons.ts) — SVG gerado em runtime, sem dependência.

### 2.1 Barras de voz — ✅ feito

- [x] Fundo quase-preto, a cor do estado migrou para as **barras**
- [x] Barras com gradiente vertical
- [x] **`<filter>` foi descartado, não testado — de propósito.** Todo brilho do projeto é
      `radialGradient`/`linearGradient`, o mesmo mecanismo que a tecla já usava e que sabemos
      que o renderizador do Stream Deck aceita. O halo do `neon` é feito com três passadas do
      mesmo contorno (larga e apagada, média na cor, filete branco no miolo) — dá a impressão
      de luz sem depender de um recurso que não temos como validar sem o aparelho na mão
- [x] Mantidas as 9 barras rolantes
- [ ] Centrais mais altas por construção, como um VU de verdade — não feito, e talvez não deva
      ser: a altura hoje é o nível REAL, e enfeitar isso é mentir sobre o que a barra mede

### 2.2 Estado de processamento (hoje "enviando" / "escrevendo") — **o que sobrou do item 2**

É a única parte do item 2 que não entrou na v1.2.0.0, e ficou barata: o `key-text.ts` já existe,
então acrescentar palavra é acrescentar três linhas em três blocos.

- [ ] Trocar os três pontinhos por algo que sugira trabalho contínuo — barra indeterminada,
      linhas de texto surgindo, ou um traço que varre a tecla. **Cuidado:** os pontinhos são
      redesenhados a 8 fps pelo `tick()`; qualquer coisa mais pesada passa a custar a cada quadro
- [ ] **Repensar a palavra.** "Escrevendo" é vago. Melhor seria contextual, porque o plugin
      já sabe o que está fazendo: `traduzindo` quando `styleMode === "translate"`,
      `revisando` quando só há limpeza, `reescrevendo` quando há instrução livre.
      Precisa das três traduções — agora em [key-text.ts](../src/lib/key-text.ts), não no i18n

### 2.3 Confirmação final — ✅ feito (v1.1.0.0)

```
   ✓            ✓
 142      →    142
palavras     palavras
```

- [x] Número e palavra em linhas separadas, número grande (22 px) e palavra pequena (10 px)
- [x] `keyImage` ganhou `fontSizes` — corpo de fonte **por linha**. Com corpos iguais o
      espaçamento continua idêntico ao de antes, então nenhuma tecla existente mudou
- [x] Singular certo: "1 palavra", "142 palavras"
- [x] `words` / `palabras` nas outras línguas

**Efeito colateral que valeu a pena:** para traduzir "palavras" foi preciso levar o idioma do
painel até o desenho da tecla. Com o caminho aberto, **todo** o texto da tecla foi traduzido —
`abrindo`, `enviando`, `escrevendo`, `SOLTE P/ CANCELAR`, `sem fala`, `copiado`, as mensagens de
erro. Vive agora em [key-text.ts](../src/lib/key-text.ts), o terceiro lugar de texto do projeto
(painel · prompt · **tecla**). Era uma violação da regra trilíngue que bloquearia a publicação
na loja.

> **Cuidado:** o teste `ícone e texto não se sobrepõem` trava a geometria, não a estética.
> Ao mexer, renderize e olhe — há um harness pronto descrito no CLAUDE.md (*Como testar*).

### 2.4 Biblioteca de ícones — ✅ feito (v1.2.0.0)

Eram **cinco** (`mic`, `globe`, `bubble`, `pen`, `none`). Agora são **18 + `none`**, cobrindo
os quatro grupos que faltavam. Os cinco antigos continuam existindo com o mesmo id — settings
já gravadas nas teclas não quebram, e há teste travando isso.

| Grupo | Ícones |
|---|---|
| Captura | `mic` `micOff` `waves` `headset` |
| Idioma | `globe` `translate` `bubble` `quote` |
| Texto | `doc` `list` `keyboard` `code` |
| Ação | `pen` `wand` `bolt` `check` |
| Contexto | `mail` `calendar` |

#### O que se aprendeu desenhando

- [x] **Contorno vs. sólido virou uma pergunta errada.** Cada ícone é descrito UMA vez, como
      lista de formas com papéis (corpo · traço · vazado). O `neon` renderiza essa lista como
      contorno; a `aurora` e o `ring`, como silhueta cheia. Desenhar 18 ícones duas vezes seria
      garantir que um dia os dois conjuntos divergissem
- [x] **Traço que sobrevive ao encolhimento — MEDIDO, e a resposta não era a esperada.** Com o
      rótulo em 3 linhas o glifo cai para `k ≈ 0,4` e um traço de 3,1 px vira 1,2 px e some.
      Mas compensar por inteiro (`1/k` — que é exatamente o que `vector-effect="non-scaling-stroke"`
      faria) devolve os 3,1 px, e num glifo a 40% isso fica proporcionalmente enorme: o
      microfone vira uma mancha. **A raiz fica no meio: `3,1/√k`**, ~2,0 px efetivos. Ou seja,
      `non-scaling-stroke` não só era desnecessário como estaria errado
- [x] Grade comum de 32×32 centrada em (36,28), com teste automatizado que reprova qualquer
      coordenada fora dela — foi o que pegou o primeiro lápis, que vazava do desenho
- [x] Contraste resolvido por construção: o glifo é sempre branco levemente frio (`#EFF2F7`),
      então não depende da cor que a pessoa escolher

#### Cuidados — todos endereçados

- [x] O `<select>` de ícone **virou grade visual de miniaturas**, e a de estilo também. As
      miniaturas são geradas pelo próprio plugin, no estilo e na cor da tecla — a grade mostra
      o que a tecla vai mostrar, não uma ilustração feita à parte. Os `<select>` continuam lá,
      escondidos: a grade escreve neles e dispara `change`, então gravação, prévia e preset
      seguem passando por um caminho só
- [x] O `switch` de `glyph()` virou a tabela `GLYPHS` (`nome → formas`), como previsto
- [ ] Ícone é identidade e o plugin vai para a loja: revisitar o conjunto quando houver uso
      real, para ver quais sobram sem uso e o que falta

---

## 3. Painel mais high-tech

### 3.0 Colar a chave dentro do próprio modal de ajuda — ✅ feito (v1.1.0.0)

O modal "Como obter uma chave da OpenAI" terminava no passo 4 dizendo "cole no campo do
painel" — e aí a pessoa precisava fechar o modal, achar *Configuração da máquina*, abrir a
seção e só então colar. Ela acabou de copiar a chave, com ela ainda no clipboard: o campo
tinha de estar **ali**.

- [x] Campo de senha + botão *Salvar* no rodapé do modal, antes do *Fechar*
- [x] Reusa o comando `setKey` que já existia — nenhum caminho novo para o cofre DPAPI
- [x] Ao salvar com sucesso: fecha o modal, some o banner de aviso e os **dois** indicadores
      se atualizam (`refreshKeyStatus()` agora escreve nos dois)
- [x] Erro visível ali mesmo, sem fechar: campo vazio e chave que não começa com `sk-`
- [x] Um caminho só (`submitKey()`) para os dois campos — a validação nasceu compartilhada, e
      com ela o campo da *Configuração da máquina* também passou a validar
- [x] Enter no campo salva, já que a mão está no teclado logo depois de colar

> Verificado com o painel renderizado fora do Stream Deck: campo vazio e chave malformada
> mostram o erro sem fechar; chave válida mostra "guardando no cofre…", e a resposta de
> sucesso fecha o modal, limpa o campo e some com o banner.

### 3.1 Revisão completa dos textos da interface

Os textos foram escritos junto com o código, um de cada vez, e nunca lidos como conjunto.
Aparecem jargão, inconsistência e pelo menos um rótulo que **não se entende** — o que só
descobrimos porque o usuário disse "nem entendi isso direito".

Tudo em [ui/i18n.js](../com.felipe.transcritranslator.sdPlugin/ui/i18n.js), nos três blocos.
Reescrever pt e depois traduzir; não traduzir texto ruim.

#### Casos já identificados

- [ ] **"Segue o idioma falado da tecla"** — opção automática do seletor *Presets e prompts*.
      Ninguém entende, e é culpa do rótulo, não de quem lê. O que ela faz: os prompts saem no
      idioma que você declarou em *Eu vou falar em*; se aquilo estiver em *Detectar*, cai para o
      idioma do painel. Existe porque a limpeza usa exemplos da língua falada ("vírgula", "né").
      Algo como **"Automático — acompanha o que eu falo"** já diria mais
- [ ] **Placeholder do dicionário canônico.** Hoje: `SRVDRU, EdgeRouter, WireGuard, Grafana,
      n8n, PostgreSQL, Kubernetes`. `SRVDRU` é o servidor de **uma** pessoa — não significa nada
      para mais ninguém, e o plugin é para a loja. Trocar por exemplos que qualquer um
      reconheça e que ilustrem o *tipo* de termo (nome de produto com grafia particular, sigla,
      jargão): `GitHub, JavaScript, PostgreSQL, PDF, API, e-mail`. Adaptar por idioma, já que
      siglas comuns variam
- [ ] Revisar **todos** os outros placeholders pelo mesmo critério: exemplo ilustra, não
      dá instrução nem assume o contexto de ninguém
- [ ] **"Prompt" é jargão.** Aparece em *Presets e prompts*, *Ver o que será enviado*, *prompt
      de transcrição*. Quem nunca usou API não sabe o que é. Ver se dá para dizer "instruções"
      sem perder precisão — e onde a precisão importa, manter e explicar uma vez
- [x] **Seletor de idioma do painel — feito (v1.1.0.1).** O topo agora traz `🌐 UI` ao lado do
      seletor, e as quatro opções são invariáveis: `Default · Português · English · Español`.
      O ponto é preciso: quem abriu o painel numa língua que não lê está justamente
      procurando como trocar, e não pode depender de ler nada em volta para achar. Saiu o
      *"Segue o Stream Deck"*, que era o único item traduzido da lista; o que ele explicava
      passou para o fim do `langHint` ("Default significa acompanhar o idioma do app"). O
      tooltip do seletor, que estava fixo em português no HTML, virou chave de i18n — o
      `applyLang()` ganhou suporte a `data-i18n-title`
- [ ] Inconsistências de forma: *"Limpar o ditado"* (verbo) e *"Limpeza de ditado"* (substantivo)
      para a mesma coisa. O seletor de *Presets e prompts* ainda diz *"Segue o idioma falado da
      tecla"* — **não** é o mesmo caso do de cima: ali o automático tem um significado próprio
      que "Default" sozinho não contaria, então resolver junto com o primeiro item desta seção
- [x] `"pal."` abreviado na tecla de confirmação — resolvido junto com o 2.3: virou a palavra
      inteira, em duas linhas, nos três idiomas (`key-text.ts`)
- [ ] Termos inevitáveis (`ffmpeg`, `tokens`, `DPAPI`) precisam aparecer explicados **na primeira
      vez**, não em toda menção

#### Como fazer

- [ ] Ler o painel inteiro de cima a baixo, nos três idiomas, **como quem nunca viu** — é assim
      que a inconsistência aparece; campo a campo ela se esconde
- [ ] Fixar vocabulário antes de reescrever: uma palavra por conceito, e a mesma sempre
- [ ] Rodar o render headless dos três idiomas e conferir se algum texto reescrito estourou o
      layout (o alemão não existe aqui, mas o espanhol já é ~15% mais longo que o português)
- [ ] Conferir a paridade de chaves ao final (comando no [CLAUDE.md](../CLAUDE.md))

### 3.2 Refinamento visual

O painel funciona e é honesto, mas parece um formulário. Sem virar enfeite:

- [x] **Preview da tecla ao vivo dentro do painel — feito (v1.1.0.0).** Fica em *Preset e
      essencial*, logo abaixo do rótulo, e aparece também no modo simples. É a MESMA imagem que
      vai para a tecla: `idleImage()` saiu de dentro do `render()` e é chamada pelos dois, para
      que prévia e tecla física não tenham como divergir.
      Duas decisões que valem registro: as configurações viajam **na mensagem** `keyPreview`, e
      não são lidas de `getSettings()`, porque o painel grava com 150 ms de atraso — lendo do
      Stream Deck a prévia mostraria sempre o penúltimo caractere digitado; e o pedido é
      debounced em 120 ms, para digitar o rótulo não virar uma rajada de round-trips.
- [ ] Tipografia e ritmo: escala de tamanhos coerente, respiro entre seções, alinhamento dos
      rótulos
- [ ] Transições curtas ao abrir/fechar seções e ao trocar de modo de estilo
- [ ] Trocar o emoji 🌐 e os `↳` por SVG inline — emoji varia entre sistemas
- [ ] Estados de foco visíveis para navegação por teclado
- [ ] Revisar o contraste em tema claro do Stream Deck, se existir

---

## 4. Tradução

### 4.0 Ampliar os idiomas de destino — ✅ feito (v1.1.0.0)

Eram **12** destinos contra **30** idiomas falados. Agora são **28**
(`TARGET_CODES` em [languages.ts](../src/lib/languages.ts)).

- [x] Acrescentados os 16 que faltavam: polonês, tcheco, romeno, húngaro, grego, sueco,
      norueguês, dinamarquês, finlandês, ucraniano, turco, hebraico, híndi, indonésio,
      vietnamita, tailandês
- [x] Confirmado na prática: bastou o código. Nome e ordenação alfabética vieram do
      `Intl.DisplayNames`, nos três idiomas do painel — há teste travando isso
- [x] **Onde parou:** nos idiomas já aceitos como falados, menos catalão e galego. Ficaram de
      fora porque a qualidade de tradução *para* eles é a mais duvidosa da lista, e oferecer um
      destino que traduz mal é pior que não oferecer. Entram como fala, não como destino —
      trocar isso é uma linha, se a experiência disser o contrário
- [ ] Com 28 o `<select>` ainda passa; se um dia chegar a ~35, avaliar campo com busca ou os
      últimos usados no topo
- [ ] O badge de 2 letras continua sendo o código, e agora há siglas opacas de ler (`el` para
      grego, `he` para hebraico, `cs` para tcheco). Mantido de propósito por ora: as descrições
      dos presets dizem "a tecla mostra EN no canto", então mudar para nome curto é uma decisão
      com efeitos em cadeia — decidir junto com o item 2.4

### 4.1 Tradução de seleção: fluxo mais direto

Hoje, para traduzir um texto selecionado é preciso entender que "desligar Ouvir + ligar
Escrever com tradução" faz isso. Funciona, mas exige entender o modelo antes de usar.

- [ ] **Preset pronto** "Traduzir seleção → inglês" (e espanhol), sem gravação, para a coisa
      existir sem configuração
- [ ] A tecla precisa **parecer** diferente da que grava: talvez um ícone de texto/seleção em
      vez do microfone, para não haver dúvida do que ela faz
- [ ] Avaliar um modo **híbrido**: se houver texto selecionado, traduz a seleção; se não
      houver, grava. Uma tecla só resolveria os dois casos — mas cuidado, comportamento que
      muda sozinho é difícil de prever, e a decisão precisa ser sua
- [ ] Feedback quando não há seleção nem clipboard: hoje diz "sem texto", pode ser mais claro
- [ ] Idioma de destino no badge também nesse modo

---

## 5. Backlog maior (fase 2)

Já discutido e deliberadamente fora do escopo inicial:

- [ ] Transcrever **arquivo de áudio** existente
- [ ] Capturar **áudio do sistema** (loopback) para reuniões — exige VB-Cable ou WASAPI
- [ ] **Streaming** da transcrição (os modelos GPT-4o suportam)
- [ ] Fila de **reenvio** do áudio que falhou — hoje ele é preservado, mas o reenvio é manual
- [x] Atalho global de teclado, sem depender de **apertar** o Stream Deck — feito na
      v1.3.0.0, ver seção 7. Continua dependendo do **app** da Elgato rodando, porque é
      nele que o plugin vive; o que deixou de ser necessário é a tecla estar à mão
- [ ] Rastreamento de custo (foi decidido **não** fazer; revisitar só se houver demanda)
- [ ] Publicar na loja da Elgato: `streamdeck validate`, `streamdeck pack`, ícones em todas as
      resoluções exigidas e revisão do texto do catálogo

---

## 6. Dívidas técnicas conhecidas

- [ ] [dictation.ts](../src/actions/dictation.ts) passou de **1160 linhas** e acumula máquina
      de estados + ponte com o painel + tratador do atalho de teclado. A ponte
      (`onSendToPlugin`) sairia limpa para um módulo próprio — cresceu na v1.2.0.0 com o
      `keyPreview` servindo as duas grades, e de novo na v1.3.0.0 com o `Surface` e o visor
      emprestado. É a dívida que mais cresce a cada rodada
- [ ] [icons.ts](../src/lib/icons.ts) dobrou de tamanho com os 18 ícones e as três direções.
      A tabela `GLYPHS` é dado puro e sairia limpa para um arquivo só dela, deixando em
      `icons.ts` só o motor (layout do texto, escala, composição da tecla)
- [ ] `CHAR_RATIO = 0.56` em icons.ts é estimativa da largura média de caractere; erra para
      textos com muitas maiúsculas ou muitos "i". Se virar problema, medir por caractere
- [ ] O painel não tem teste automatizado — só o render headless manual. Um smoke test que
      carrega o HTML e confere que `handlePlugin({event:"init"})` popula tudo evitaria
      regressões silenciosas (foi assim que se descobriu o painel morrendo sem o i18n.js)
- [ ] `npm run mic` grava do microfone e não roda em CI; manter como teste local mesmo

---

## 7. Atalho de teclado — ✅ feito (v1.3.0.1)

Uma tecla do teclado aciona o ditado sem tocar no Stream Deck, **inclusive quando a tecla do
deck está em outra página ou outro perfil**. Desenhado em grelha com o usuário em 27/07/2026;
as decisões estão em [CLAUDE.md](../CLAUDE.md), itens 15 a 17 de *Decisões que não devem ser
revertidas*.

Como funciona: um endereço `streamdeck://plugins/message/<uuid>/dictate?key=<apelido>` chega ao
plugin, que acha a tecla pelo apelido em [shortcuts.ts](../src/lib/shortcuts.ts) e roda o ditado
a partir de uma cópia das configurações — o SDK só entrega as ações **visíveis**, então sem esse
caderninho a tecla da tela 5 não existiria.

**Medido nesta máquina:** 434 ms entre disparar o endereço e o plugin receber; o modo passivo
(`streamdeck=hidden`) **não rouba o foco**, que é a condição para o texto ser colado no lugar
certo.

O que ficou de fora, e por quê:

- **Segurar para falar pelo atalho.** O recado é um pulso, não existe "soltou". Descobriu-se
  depois que daria para inferir pelo repique da tecla — e a conclusão foi **não fazer**:
  depende da configuração de repetição do Windows e de comportamento não documentado do
  PowerToys.
- **Acionar botão de outro plugin ou ação de fábrica.** Impossível: o deep link é entregue ao
  plugin dono do UUID. Só o Bitfocus Companion resolveria, substituindo o software da Elgato.
- **Lista de programas onde o atalho vale.** Chegou a existir e foi removida a pedido: falhar
  em silêncio num programa fora da lista é pior que o incômodo em jogo. Restou a trava de tela
  cheia do plugin.

### Armadilha do PowerToys (custou uma hora)

O remapeamento é escrito à mão em `%LOCALAPPDATA%\Microsoft\PowerToys\Keyboard Manager\default.json`,
em `remapShortcuts.global` com `operationType: 2` e `openUri` — a seção `remapShortcutsToRunProgram`
existe nas constantes do PowerToys mas **não é lida**. A engine não observa o arquivo: precisa do
evento `PowerToys_KeyboardManager_Event_Settings`.

**Abrir o editor do Keyboard Manager apaga o remapeamento e mata o gancho de teclado.** Religar
só reiniciando o PowerToys elevado ou alternando o módulo pela interface.
