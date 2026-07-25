# Roadmap

O que ficou para as próximas rodadas, com contexto suficiente para retomar sem reconstruir o
raciocínio. Ordem = prioridade sugerida, não obrigação.

Ao mexer em qualquer item: subir [version.json](../version.json) antes de commitar
(ver [CLAUDE.md](../CLAUDE.md), *REGRA: toda alteração sobe a versão*).

---

## 0. Teste com voz de ponta a ponta — **bloqueia tudo**

Nada abaixo importa se o básico não estiver provado. **O plugin nunca transcreveu uma frase
real.** Todo o resto foi verificado (102 asserções, gravação contra o hardware, render do
painel), mas o caminho completo — falar → transcrever → colar — nunca rodou.

Roteiro completo em [PLANO-ORIGINAL.md](PLANO-ORIGINAL.md), seção *Verificação*. O essencial:

- [ ] Configurar a chave e ditar num Bloco de Notas em `toggle`; conferir acentuação
- [ ] Repetir em `ptt` (segurar)
- [ ] Waveform mexe ao falar e fica parada no silêncio
- [ ] Auto-parar: falar e ficar 3 s calado
- [ ] Segurar durante a gravação → `SOLTE P/ CANCELAR`, nada é enviado
- [ ] Trocar de janela durante o processamento → **não cola**, avisa "copiado"
- [ ] Trocar de página no XL durante a gravação → entrega mesmo assim
- [ ] Apertar e parar sem falar → "sem fala", nada colado (blindagem anti-eco)
- [ ] Dicionário: cadastrar sigla, ditar, conferir grafia canônica
- [ ] Comandos falados: "vírgula", "novo parágrafo"

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

## 2. A tecla: fundo preto e mais elegância

Hoje o fundo inteiro é a cor do estado (vermelho ao gravar), com barras e texto brancos por
cima. Fica saturado e "de protótipo". A direção: **fundo preto, e a cor só no que informa.**

Tudo em [src/lib/icons.ts](../src/lib/icons.ts) — SVG gerado em runtime, sem dependência.

### 2.1 Barras de voz

- [ ] Fundo quase-preto (`#0d0d0f`), a cor do estado migra para as **barras**
- [ ] Barras com gradiente vertical e brilho sutil; considerar as centrais mais altas por
      construção, como um VU de verdade
- [ ] Testar se o `<filter>` de *glow* sobrevive ao renderizador do Stream Deck — se não,
      simular com uma barra semitransparente por baixo, mais larga
- [ ] Manter as 9 barras rolantes: o valor está em ver a voz **andando**, não pulsando

### 2.2 Estado de processamento (hoje "enviando" / "escrevendo")

- [ ] Trocar os três pontinhos por algo que sugira trabalho contínuo — barra indeterminada,
      linhas de texto surgindo, ou um traço que varre a tecla
- [ ] **Repensar a palavra.** "Escrevendo" é vago. Melhor seria contextual, porque o plugin
      já sabe o que está fazendo: `traduzindo` quando `styleMode === "translate"`,
      `revisando` quando só há limpeza, `reescrevendo` quando há instrução livre.
      Precisa das três traduções (ver regra trilíngue no CLAUDE.md)

### 2.3 Confirmação final

- [ ] Número e palavra em **linhas separadas**, número grande:

```
   ✓            ✓
 142      →    142
palavras     palavras
```

- [ ] Já existe suporte a múltiplas linhas (`wrapLabel` / `textLayout`) — o trabalho é escolher
      os corpos de fonte e conferir que o check não fica espremido
- [ ] `words` / `palabras` nas outras línguas; hoje o texto é montado em
      [dictation.ts](../src/actions/dictation.ts) com `"pal."` fixo em português

> **Cuidado:** o teste `ícone e texto não se sobrepõem` trava a geometria, não a estética.
> Ao mexer, renderize e olhe — há um harness pronto descrito no CLAUDE.md (*Como testar*).

### 2.4 Biblioteca de ícones — mais opções, e melhores

Hoje são **cinco** (`mic`, `globe`, `bubble`, `pen`, `none`), desenhados à mão em SVG dentro de
[icons.ts](../src/lib/icons.ts). Poucos para diferenciar 32 teclas de um XL — e desenhados para
fundo colorido, não para o fundo escuro que o item 2.1 vai trazer.

**Ampliar e reestilizar são o mesmo trabalho**, e nessa ordem: definir o estilo primeiro,
depois desenhar o conjunto inteiro nele. Ampliar no estilo atual é retrabalho garantido.

#### Estilo, antes de desenhar

- [ ] Decidir entre **contorno** (como hoje) e **preenchimento sólido**. Em fundo escuro, sólido
      tem mais presença e sofre menos com escala; contorno é mais leve mas exige traço grosso
- [ ] **Traço que sobrevive ao encolhimento** — armadilha já conhecida deste código: quando o
      glifo é reduzido para dar lugar ao texto (`scale(k)` em `keyImage`), o `stroke-width`
      encolhe junto. Com `k ≈ 0.4`, um traço de 3 px vira 1,2 px e quase some. Testar
      `vector-effect="non-scaling-stroke"`; se o renderizador do Stream Deck ignorar, compensar
      o traço em função de `k` na hora de montar
- [ ] Grade e peso comuns: mesmo tamanho óptico, mesma espessura, mesmo raio de canto. Ícone
      solto em estilo diferente estraga o conjunto todo
- [ ] Contraste conferido **em fundo escuro e claro** — a cor é configurável por tecla, então o
      ícone precisa aguentar de `#0d0d0f` a um âmbar claro. Branco puro nem sempre é a melhor
      resposta; considerar um branco levemente frio ou opacidade

#### Conjunto a cobrir

- [ ] Captura: microfone, microfone cortado (mudo), ondas sonoras, fone
- [ ] Texto: documento, parágrafo, lista, aspas, teclado
- [ ] Ação: tradução (setas opostas, ou `A` ↔ `文`), varinha/limpeza, raio (rápido/cru),
      lápis, verificação
- [ ] Contexto: e-mail, chat, código, calendário
- [ ] Manter `none` — tecla só com rótulo é legítima e às vezes a mais legível

#### Cuidados

- [ ] Cada ícone novo é opção no painel: rever se o `<select>` ainda serve ou se vira uma grade
      visual de miniaturas (o preview do item 3 ajudaria aqui)
- [ ] `IconName` em [settings.ts](../src/lib/settings.ts) e o `switch` em `glyph()` crescem
      juntos — vale uma tabela `nome → path` em vez do switch, quando passarem de ~10
- [ ] Ícone é identidade: se algum dia o plugin for para a loja, o conjunto vira parte da cara
      dele. Vale desenhar pensando nisso

---

## 3. Painel mais high-tech

O painel funciona e é honesto, mas parece um formulário. Sem virar enfeite:

- [ ] **Preview da tecla ao vivo dentro do painel.** É o item de maior retorno: hoje é preciso
      olhar o Stream Deck físico para ver o efeito de cor, rótulo, fonte e ícone. O SVG já é
      gerado no plugin — bastaria mandá-lo ao painel a cada mudança e desenhar num `<img>`.
      Resolveria de vez o ciclo lento de ajustar aparência.
- [ ] Tipografia e ritmo: escala de tamanhos coerente, respiro entre seções, alinhamento dos
      rótulos
- [ ] Transições curtas ao abrir/fechar seções e ao trocar de modo de estilo
- [ ] Trocar o emoji 🌐 e os `↳` por SVG inline — emoji varia entre sistemas
- [ ] Estados de foco visíveis para navegação por teclado
- [ ] Revisar o contraste em tema claro do Stream Deck, se existir

---

## 4. Tradução

### 4.0 Ampliar os idiomas de destino

Hoje são **12** destinos (`TARGET_CODES` em [languages.ts](../src/lib/languages.ts)) contra
**30** idiomas falados (`SPOKEN_CODES`). A assimetria não tem razão de ser: quem fala 30 pode
querer traduzir para mais que 12.

- [ ] Ampliar `TARGET_CODES` — acrescentar código à lista **basta**, o nome vem traduzido do
      `Intl.DisplayNames` e a ordenação alfabética se ajusta sozinha. Nada de tabela para manter
- [ ] Cobrir pelo menos os europeus que faltam (polonês, tcheco, romeno, húngaro, grego, sueco,
      norueguês, dinamarquês, finlandês, ucraniano, turco), hebraico, híndi, indonésio,
      vietnamita, tailandês — os mesmos já aceitos como falados
- [ ] Decidir onde parar: a OpenAI declara 98 idiomas treinados, mas com aviso de que fora da
      lista principal a qualidade cai. Listar o que não funciona bem é pior que não listar
- [ ] **Se a lista passar de ~30, o `<select>` simples fica ruim.** Avaliar campo com busca, ou
      manter no topo os últimos usados
- [ ] Conferir o badge de 2 letras da tecla: com muitos idiomas surgem siglas ambíguas para
      quem lê (`ko`, `hu`, `he`). Talvez valha o nome curto em vez do código

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
- [ ] Atalho global de teclado, sem depender do Stream Deck
- [ ] Rastreamento de custo (foi decidido **não** fazer; revisitar só se houver demanda)
- [ ] Publicar na loja da Elgato: `streamdeck validate`, `streamdeck pack`, ícones em todas as
      resoluções exigidas e revisão do texto do catálogo

---

## 6. Dívidas técnicas conhecidas

- [ ] [dictation.ts](../src/actions/dictation.ts) passou de 800 linhas e acumula máquina de
      estados + ponte com o painel. A ponte (`onSendToPlugin`) sairia limpa para um módulo
      próprio
- [ ] `CHAR_RATIO = 0.56` em icons.ts é estimativa da largura média de caractere; erra para
      textos com muitas maiúsculas ou muitos "i". Se virar problema, medir por caractere
- [ ] O painel não tem teste automatizado — só o render headless manual. Um smoke test que
      carrega o HTML e confere que `handlePlugin({event:"init"})` popula tudo evitaria
      regressões silenciosas (foi assim que se descobriu o painel morrendo sem o i18n.js)
- [ ] `npm run mic` grava do microfone e não roda em CI; manter como teste local mesmo
