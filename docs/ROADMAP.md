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

## 1. A tecla: fundo preto e mais elegância

Hoje o fundo inteiro é a cor do estado (vermelho ao gravar), com barras e texto brancos por
cima. Fica saturado e "de protótipo". A direção: **fundo preto, e a cor só no que informa.**

Tudo em [src/lib/icons.ts](../src/lib/icons.ts) — SVG gerado em runtime, sem dependência.

### 1.1 Barras de voz

- [ ] Fundo quase-preto (`#0d0d0f`), a cor do estado migra para as **barras**
- [ ] Barras com gradiente vertical e brilho sutil; considerar as centrais mais altas por
      construção, como um VU de verdade
- [ ] Testar se o `<filter>` de *glow* sobrevive ao renderizador do Stream Deck — se não,
      simular com uma barra semitransparente por baixo, mais larga
- [ ] Manter as 9 barras rolantes: o valor está em ver a voz **andando**, não pulsando

### 1.2 Estado de processamento (hoje "enviando" / "escrevendo")

- [ ] Trocar os três pontinhos por algo que sugira trabalho contínuo — barra indeterminada,
      linhas de texto surgindo, ou um traço que varre a tecla
- [ ] **Repensar a palavra.** "Escrevendo" é vago. Melhor seria contextual, porque o plugin
      já sabe o que está fazendo: `traduzindo` quando `styleMode === "translate"`,
      `revisando` quando só há limpeza, `reescrevendo` quando há instrução livre.
      Precisa das três traduções (ver regra trilíngue no CLAUDE.md)

### 1.3 Confirmação final

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

---

## 2. Painel mais high-tech

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

## 3. Tradução

### 3.0 Ampliar os idiomas de destino

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

### 3.1 Tradução de seleção: fluxo mais direto

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

## 4. Backlog maior (fase 2)

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

## 5. Dívidas técnicas conhecidas

- [ ] [dictation.ts](../src/actions/dictation.ts) passou de 800 linhas e acumula máquina de
      estados + ponte com o painel. A ponte (`onSendToPlugin`) sairia limpa para um módulo
      próprio
- [ ] `CHAR_RATIO = 0.56` em icons.ts é estimativa da largura média de caractere; erra para
      textos com muitas maiúsculas ou muitos "i". Se virar problema, medir por caractere
- [ ] O painel não tem teste automatizado — só o render headless manual. Um smoke test que
      carrega o HTML e confere que `handlePlugin({event:"init"})` popula tudo evitaria
      regressões silenciosas (foi assim que se descobriu o painel morrendo sem o i18n.js)
- [ ] `npm run mic` grava do microfone e não roda em CI; manter como teste local mesmo
