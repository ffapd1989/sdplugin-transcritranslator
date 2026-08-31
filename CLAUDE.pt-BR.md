*Idioma: **Português** · [English](CLAUDE.md)*

# TranscriTranslator — guia para quem for mexer no código

Plugin do Stream Deck: uma tecla grava o microfone, transcreve na OpenAI e cola o texto no
campo em foco, opcionalmente limpando, traduzindo ou reescrevendo antes.

Este arquivo é o guia de **desenvolvimento**. Para uso e configuração, ver [README.pt-BR.md](README.pt-BR.md).

> **Leia a seção [Decisões que não devem ser revertidas](#decisões-que-não-devem-ser-revertidas)
> antes de mexer em `recorder.ts`, `openai.ts` ou `canon.ts`.** Várias escolhas ali parecem
> tortas e são consequência de medição ou de bug em produção — inclusive de outro projeto.

---

## Comandos

```powershell
npm run check     # tipos (tsc --noEmit)
npm run test      # 240 asserções das partes puras — sem Stream Deck, sem rede, sem microfone
npm run mic       # grava 3 s do microfone real e valida o núcleo contra o hardware
npm run build     # bundle -> com.felipe.transcritranslator.sdPlugin/bin/plugin.js
npm run watch     # rebuild automático
npm run shots     # regera as imagens do README a partir da interface real (precisa do Chrome)

streamdeck restart com.felipe.transcritranslator   # recarrega no app
```

Ciclo normal de trabalho: **bump** → `check` → `test` → `build` → `restart`. Mexeu em
`recorder.ts`, rode `npm run mic` também — é o único teste que exercita o comando do ffmpeg de
verdade.

## REGRA: toda alteração sobe a versão

Antes de commitar qualquer mudança, edite [version.json](version.json) — é a **fonte única**:

```json
{ "version": "1.0.0.0", "date": "2026-07-25" }
```

Quatro dígitos, `a.b.c.d`, como o manifest da Elgato exige. Suba o último em correção pequena,
o terceiro em mudança de comportamento, o segundo em recurso novo, o primeiro em virada grande.
Atualize a `date` junto — ela aparece no rodapé do painel.

O `build.mjs` **sincroniza o manifest sozinho** a partir daí e injeta os valores no bundle, então
versão do painel e versão do Stream Deck não têm como divergir. Ele também recusa o build se o
formato não for `a.b.c.d`.

### E o commit? Só com autorização

Bumpar é automático. **Commitar e dar push, não.** Deixe a mudança pronta e verificada, diga o
que está pendente e espere o aval — ou pergunte, quando a alteração for significativa o
bastante para justificar a interrupção.

O motivo é de histórico, não de segurança: dez commits de ajuste fino são piores que um commit
coeso, e quem decide o recorte é quem vai conviver com o repositório.

Instalação inicial (uma vez): `npm install`, `render-images.ps1`, `streamdeck dev`,
`streamdeck link com.felipe.transcritranslator.sdPlugin`.

## REGRA: a documentação é bilíngue — inglês e português

Todo documento existe duas vezes: o arquivo em inglês é o canônico e o em português fica ao lado
com o sufixo `.pt-BR`. **Os dois mudam na mesma alteração.** Um `.pt-BR` atrasado é pior que
tradução nenhuma, porque parece atual.

Os pares são `README`, `CLAUDE`, `CONTRIBUTING`, `PRIVACY`, `SECURITY`, `CODE_OF_CONDUCT`,
`docs/README`, `docs/ROADMAP` e `docs/ORIGINAL-PLAN`. Acrescentar um documento é acrescentar
dois, mais uma linha nos dois `docs/README`.

A faixa de abas que o GitHub mostra no topo da página do repositório (*Readme*, *MIT license*,
*Code of conduct*, *Security*) só reconhece nomes de arquivo fixos, então essas abas sempre
abrem o lado em inglês. Isso é limitação do GitHub, não decisão — quem leva o leitor para a
versão em português é o link de troca no topo de cada página.

Comentário de código, mensagem de commit e identificador vão em **inglês** — o projeto é
colaborativo e publicável na loja. Texto que o usuário vê é outra história: vive nos arquivos
de i18n e existe nos três idiomas (ver a regra mais abaixo). String em português leva
**acentuação completa** — `Configurações`, nunca `Configuracoes`; se aparecer mojibake
(`Ã§`, `Ã£`) na tela, o bug é de encoding, e se corrige o encoding em vez de apagar o acento.

---

## Arquitetura

```
apertar → captura o processo em foco (UIAutomation, ~75 ms, em paralelo)
        → ffmpeg dshow — 1 processo, 2 saídas simultâneas
               ├─ MP3 16 kHz mono 48 kbps → %LOCALAPPDATA%\transcritranslator\audio\
               └─ medidor de nível (RMS) pelo stderr → waveform da tecla + auto-stop
        → parar: "q" no stdin
        → [etapa 1] POST /v1/audio/transcriptions
        → regex do dicionário canônico
        → [etapa 2] POST /v1/chat/completions   (limpeza + estilo, em camadas)
        → regex do dicionário canônico
        → histórico .md → clipboard → cola se o foco não mudou
```

| Arquivo | Papel |
|---|---|
| [src/plugin.ts](src/plugin.ts) | Boot: cria pastas, mata ffmpeg órfão, aquece o cofre, conecta |
| [src/actions/dictation.ts](src/actions/dictation.ts) | Máquina de estados da tecla + ponte com o painel. É o arquivo grande (~800 linhas) |
| [src/lib/recorder.ts](src/lib/recorder.ts) | ffmpeg: lista microfones, grava, mede nível, detecta silêncio |
| [src/lib/openai.ts](src/lib/openai.ts) | As duas chamadas, retries, detecção de recusa, anti-eco |
| [src/lib/prompts.ts](src/lib/prompts.ts) | Composição do system prompt em camadas |
| [src/lib/prompt-text.ts](src/lib/prompt-text.ts) | **Texto** dos prompts em pt/en/es — é o que a IA lê |
| [src/lib/key-text.ts](src/lib/key-text.ts) | **Texto da tecla** em pt/en/es — "enviando", "sem fala", "palavras" |
| [src/lib/preset-text.ts](src/lib/preset-text.ts) | Nomes e instruções dos presets em pt/en/es |
| [src/lib/presets.ts](src/lib/presets.ts) | Moldes de fábrica + salvar/aplicar os do usuário |
| [src/lib/canon.ts](src/lib/canon.ts) | Dicionário: `keywords[]` / orçamento de 224 tokens + correção por regex |
| [src/lib/deliver.ts](src/lib/deliver.ts) | Foco, clipboard, colagem, histórico |
| [src/lib/sessions.ts](src/lib/sessions.ts) | Estado global das teclas, trava de gravação única, PIDs órfãos |
| [src/lib/shortcuts.ts](src/lib/shortcuts.ts) | Apelido → tecla, para o atalho de teclado alcançar tecla fora da tela |
| [src/lib/icons.ts](src/lib/icons.ts) | A tecla desenhada em SVG (ícones, waveform, badges) |
| [src/lib/settings.ts](src/lib/settings.ts) | Tipos, defaults e a cascata de resolução de idioma |
| [src/lib/vault.ts](src/lib/vault.ts) | Cofre DPAPI da chave da OpenAI |
| [src/lib/theme.ts](src/lib/theme.ts), [beep.ts](src/lib/beep.ts), [paths.ts](src/lib/paths.ts) | Cores derivadas, bipes por ffplay, caminhos |
| [`…sdPlugin/ui/dictation.html`](com.felipe.transcritranslator.sdPlugin/ui/dictation.html) | Painel inteiro: HTML+CSS+JS à mão, sem dependência externa |
| [`…sdPlugin/ui/i18n.js`](com.felipe.transcritranslator.sdPlugin/ui/i18n.js) | Textos da **interface** em pt/en/es — é o que o usuário lê |
| [tools/screenshots.ts](tools/screenshots.ts) | Desenha `docs/img/*.png` a partir da tecla real e do painel real |

### Os três eixos de idioma

Não são a mesma coisa e não precisam concordar:

| Eixo | Onde mora | Resolve em |
|---|---|---|
| Painel (o que **você** lê) | `GlobalSettings.uiLang` | `resolveUiLocale()` → app Stream Deck |
| Presets e prompts (o que a **IA** lê) | `GlobalSettings.contentLang` | `resolveContentLocale()` → idioma falado → painel → app |
| Idioma falado (por tecla) | `ActionSettings.language` | vai direto no parâmetro `language` da API |

Texto de interface vive em `ui/i18n.js`; texto que a IA lê vive em `src/lib/prompt-text.ts` e
`preset-text.ts`; texto que aparece **na tecla** vive em `src/lib/key-text.ts`. **Nunca duplique
uma frase entre eles** — o painel recebe do plugin o que já foi resolvido.

A tecla segue o idioma do **painel** (`uiLang`), não o da fala: quem olha a tecla é quem
configurou o plugin. O `uiLocaleCache` em `dictation.ts` guarda esse idioma porque a tecla é
redesenhada a 8 fps — um `getGlobalSettings()` por quadro seria absurdo. Ele é atualizado no
`willAppear`, no `init` do painel e depois de cada `setGlobal`.

### REGRA: tudo que é texto tem de existir nos três idiomas

O plugin é publicável na loja da Elgato, então **não existe "só em português"**. Ao acrescentar
qualquer texto, os três (`pt`, `en`, `es`) entram na mesma mudança:

| Se você acrescentar… | Tem de mexer em |
|---|---|
| Rótulo, dica ou botão do painel | `ui/i18n.js` — os três blocos |
| Regra na camada de limpeza, trava, instrução de tradução | `src/lib/prompt-text.ts` — os três blocos |
| Preset de fábrica (nome ou instrução) | `src/lib/preset-text.ts` — os três blocos |
| Palavra que aparece **na tecla** (estado, aviso, erro) | `src/lib/key-text.ts` — os três blocos |
| Nome de idioma | **nada** — vem do `Intl.DisplayNames` |
| Idioma novo de tradução | **só o código** em `TARGET_CODES` — nome e ordem vêm do `Intl` |

Duas verificações rápidas antes de commitar:

```bash
# paridade das chaves do painel
node -e "global.window={};require('./com.felipe.transcritranslator.sdPlugin/ui/i18n.js');
const I=global.window.TT_I18N,b=Object.keys(I.pt);
for(const l of ['pt','en','es']){const m=b.filter(k=>!(k in I[l]));
console.log(l, m.length?('FALTA '+m):'completo')}"

npm run test   # cobre prompts e presets nos três idiomas
```

Essa checagem de paridade compara `en` e `es` CONTRA o `pt`, então uma chave que falta nos
**três** passa batido — o `applyLang()` mantém o que está escrito no HTML e o painel mostra
português dentro de uma interface em inglês. Foi assim que a chave `copy`, do botão de copiar o
endereço, passou despercebida até uma captura de tela flagrar. O `npm run test` agora lê o
`dictation.html`, junta todo `data-i18n`, `data-i18n-ph` e `data-i18n-title`, e reprova se
faltar alguma em algum idioma.

**Nomes de idioma não são traduzidos à mão.** `src/lib/languages.ts` usa `Intl.DisplayNames` —
verificado: o Node do Stream Deck tem ICU completo. São duas formas: `languageName()` devolve
minúsculo para caber na frase do prompt ("Traduza o texto para inglês"); `languageLabel()`
devolve capitalizado para a lista do painel ("Inglês"). Inglês escreve idioma em maiúscula e
português/espanhol em minúscula — o Intl já entrega a forma certa de cada um.

---

## Decisões que não devem ser revertidas

Cada uma custou medição ou bug. Se for mudar, meça de novo antes.

**1. O medidor de nível sai pelo stderr do ffmpeg, não pelo stdout.** Medido nesta máquina:

| Saída | Primeira amostra |
|---|---|
| `ametadata … file=-` (stdout) | **4519 ms**, tudo de uma vez no fim |
| `ametadata` sem `file` (log → stderr) | **373 ms**, fluxo contínuo |

O stdout passa por `avio`, que bufferiza. Pelo stdout a tecla só viraria "gravando" depois de
4,5 s e as primeiras palavras de todo ditado se perderiam. É por isso que o `-loglevel` é
`info` e o parser separa amostra de ruído em `onMeter()`.

**2. Limiares de fala e silêncio são relativos ao piso de ruído, não absolutos.** O FIFINE mede
−80 dBFS em silêncio e o headset CORSAIR −96 dBFS. Um limiar fixo ("−34 dB é fala") funciona num
microfone e diz "sem fala" em *todo* ditado no outro.

**3. Parar é `q` no stdin, nunca `taskkill`.** É o `q` que fecha o MP3 corretamente.

**4. MP3, não m4a/opus.** Stream puro, sem *moov atom* para finalizar: se o processo morrer no
meio, o que foi gravado continua válido. E é formato oficialmente aceito pela API.

**5. Anti-eco.** Os modelos GPT-4o devolvem o próprio `prompt` como se fosse a transcrição quando
o áudio é curto ou silencioso — comportamento que o projeto FALA TU sofreu em produção. Como o
dicionário vai no prompt, sem defesa um toque acidental colaria a lista de siglas no documento.
Três barreiras: áudio < 0,8 s ou sem fala não é enviado; retorno parecido demais com o prompt é
descartado; auto-stop por silêncio evita gravar vazio.

**6. A grafia canônica é garantida por regex, não pelo modelo.** Determinística, sem limite de
tamanho, sem custo. O prompt de transcrição só *melhora as chances* de ouvir certo. E o `\b` do
JS **não** reconhece letras acentuadas — o limite de palavra usa `(?<![\p{L}\p{N}])…`.

**7. Chave no cofre DPAPI, nunca nas settings do Stream Deck** — elas viram `.json` em texto
plano em `%APPDATA%\Elgato`.

**8. O prompt da etapa de texto muda de idioma junto com a fala.** A camada de limpeza depende
de exemplos da língua falada ("vírgula", "né" / "comma", "um"). A doc da OpenAI reforça: *"The
prompt should match the audio language."*

**9. Estado das gravações vive em `sessions.ts`, fora da instância da ação.** O SDK dispara
`willDisappear` ao trocar de página/perfil; na instância, o ditado morreria junto.

**10. Cada ícone é desenhado UMA vez, e os dois modos saem dele.** Em `icons.ts` um ícone é
uma lista de formas com papéis (`body`, `ink`, `cut`, `cutfill`, `fill`, `slash`). O estilo
`neon` renderiza essa lista como contorno; `aurora` e `ring`, como silhueta cheia. Se um dia
alguém for "simplificar" escrevendo dois conjuntos de glifos, os dois divergem no mês seguinte.
Todo ícone vive na grade de 32×32 centrada em (36,28) — há teste reprovando coordenada fora dela.

**11. O traço encolhido é compensado por `1/√k`, não por `1/k`.** Medido: com rótulo de três
linhas o glifo cai para `k ≈ 0,4` e um traço de 3,1 px vira 1,2 px e some. Compensar por
inteiro — que é o que `vector-effect="non-scaling-stroke"` faz — devolve 3,1 px e o glifo vira
uma mancha, porque num desenho a 40% aquilo é proporcionalmente enorme. A raiz fica no meio.
**Não trocar por `non-scaling-stroke`:** já foi avaliado e é a resposta errada, não a fácil.

**12. Nada de `<filter>` no SVG da tecla.** Brilho e halo são gradientes — o mesmo mecanismo
que a tecla sempre usou e que sabemos que o renderizador do Stream Deck aceita. O halo do
`neon` são três passadas do mesmo contorno (larga e apagada, média na cor, filete branco).
Blur de verdade só entra se alguém validar no aparelho físico primeiro.

**13. A prévia da tecla no painel usa a MESMA função que desenha a tecla.** `idleImage()` é
chamada pelo `render()` e pelo comando `keyPreview`. Se um dia a prévia for reimplementada em
HTML "para ficar mais rápido", ela passa a mentir no dia seguinte, e uma prévia que mente é pior
que nenhuma. As configurações viajam **na mensagem** do painel, não são lidas de `getSettings()`:
o painel grava com 150 ms de atraso e a prévia mostraria sempre o penúltimo caractere digitado.

**14. Na tecla, o texto manda no espaço e o ícone cede.** Com duas ou três linhas de rótulo o
glifo encolhe e sobe (`<g transform="…scale(…)">` em `keyImage`). Sem isso, "Relato de
atendimento" imprime as linhas **em cima** do microfone. Há teste travando a não-sobreposição;
se mexer no layout da tecla, renderize e olhe — o teste garante a geometria, não a estética.

---

**15. O ditado não precisa de tecla na tela — quem manda é a `Surface`.** O SDK só
entrega as ações **visíveis** (`SingletonAction.actions` é literalmente *"the visible
actions"*), e o atalho de teclado existe justamente para acionar a tecla da tela 5
estando na tela 1. Por isso o pipeline recebe uma `Surface` (id, `getSettings`,
`setImage`), que tanto uma `KeyAction` real quanto a superfície emprestada satisfazem.
A emprestada lê de uma cópia guardada em `shortcuts.ts` e desenha em **qualquer** tecla
do plugin que esteja à vista — preferindo a dona, se ela aparecer. Se não houver
nenhuma, o ditado roda sem visor e os bipes fazem o serviço. **Não trocar por "buscar a
tecla no SDK":** ela não está lá, e é essa a razão do caderninho existir.

**16. O apelido do atalho é o interruptor da porta de fora.** Qualquer programa da
máquina pode disparar um `streamdeck://`. Tecla sem apelido é inalcançável, e o campo
nasce vazio — a exposição é sempre um ato consciente, uma tecla por vez. Não
acrescentar um "permitir acionamento externo" separado: seriam dois interruptores para
a mesma porta, e um deles ficaria mentindo.

**17. Acionamento por teclado é sempre alternado.** O recado do Windows é um pulso; não
existe "soltou o atalho". Tecla configurada como *segurar para falar* roda como
alternada quando vem do teclado, em vez de recusar — recusar puniria a pessoa por uma
limitação do transporte.

**18. O dicionário vai em `keywords[]` quando o modelo tem esse campo, e no `prompt` quando
não tem.** Medido com um áudio sintético em pt-BR contendo seis termos:

| requisição | termos ouvidos certo |
|---|---|
| `gpt-4o-mini-transcribe` + dicionário no `prompt` | 4/6 |
| `gpt-transcribe` + dicionário no `prompt` | 4/6 |
| **`gpt-transcribe` + dicionário em `keywords[]`** | **6/6** |
| `gpt-transcribe` sem nada | 2/6 |

A ramificação não é otimização: os modelos anteriores respondem **HTTP 400** a um campo
`keywords[]`, então não dá para mandar sempre. O `language` continua no singular mesmo no
`gpt-transcribe`, que também documenta um `languages[]` plural — mandar os dois é outro HTTP
400, e a tecla dita um idioma falado só. E o teto de 32 keywords existe porque o campo não é
de graça: com 66 keywords o mesmo áudio caiu para 4/6.

O efeito colateral é o que mais importa: com o dicionário fora do prompt, o ECO não tem o que
devolver. Reproduzido com 1,5 s de silêncio digital — o `gpt-4o-mini-transcribe` devolveu a
lista inteira, o `gpt-transcribe` devolveu string vazia. A blindagem anti-eco fica assim
mesmo, porque os modelos antigos continuam na lista e o modelo é escolha do usuário.

## Decisões de produto (definidas com o usuário)

Não são acidentes de implementação — foram escolhidas explicitamente:

- Trocar de página no Stream Deck **não** interrompe a gravação.
- **Uma gravação por vez** na máquina; a segunda tecla pisca "ocupado".
- Foco mudou entre gravar e entregar → **não cola**, só copia e avisa.
- Recusa por política de conteúdo → **entrega a transcrição crua** em vez de perder a fala.
- Falha de API → 2 retries só em erro transitório, e o **áudio é preservado**.
- Segurar durante a gravação cancela; o aviso `SOLTE P/ CANCELAR` aparece *antes* da ação.
- Presets são **moldes**: aplicar copia valores, a tecla segue independente.
- Custo **não** é rastreado.
- O plugin é **de propósito geral** — nada de domínio específico embutido. Dicionário e campo
  de estilo nascem vazios.

O histórico completo dessas decisões está no plano em
[docs/ORIGINAL-PLAN.pt-BR.md](docs/ORIGINAL-PLAN.pt-BR.md).

---

## Armadilhas do ambiente

- **Decorators TC39.** O `@action` do SDK v2 exige decorators TC39 — **não** ative
  `experimentalDecorators` no tsconfig.
- **Banner `createRequire` em [build.mjs](build.mjs).** A lib `ws` do SDK usa `require()` de
  builtins; sem o banner, o bundle ESM quebra em runtime.
- **O plugin roda no Node 20 do Stream Deck**, não no Node do sistema
  (`%APPDATA%\Elgato\StreamDeck\NodeJS\20.x\node.exe`). `File`, `FormData`, `fetch` e
  `AbortSignal.timeout` existem lá — já verificado —, mas API mais nova pode não existir.
- **`streamDeck.ui.sendToPropertyInspector(...)`** é quem fala com o painel, não o objeto da ação.
- **PowerShell e números negativos:** `Mix-Channel $r -0.42` faz o parser ler `-0.42` como nome
  de parâmetro. Sempre entre parênteses: `(Mix-Channel $r (-0.42))`.
- **Acentuação completa em português** nos prompts e nas strings de interface em português. Os
  prompts vão para a API em português correto — não em ASCII.
- **O atalho de teclado REPETE enquanto a tecla é segurada.** Medido: o PowerToys
  dispara a ação a cada repetição automática do teclado, ~30 ms uma da outra — um toque
  um pouco demorado virou 28 recados e oito gravações simultâneas do mesmo microfone.
  Por isso `onDeepLink` tem duas travas **síncronas** (janela de 600 ms por apelido e
  ferrolho de reentrância) antes de qualquer `await`. Não mover essas travas para
  depois de um `await`: é exatamente na espera que a rajada entra.
- **A tecla demora a refletir o novo build.** Depois de `streamdeck restart`, a imagem na tecla
  física pode continuar a antiga por alguns segundos. Já custou um diagnóstico errado: um
  rótulo cortado parecia bug de layout e era só o desenho velho ainda na tela. Antes de sair
  investigando, confirme gerando o SVG direto (`keyImage(...)` num script) e comparando com o
  que a tecla mostra — se divergirem, é cache, não código.

---

## Como testar

**`npm run test`** cobre o que é puro: dicionário, orçamento de tokens, anti-eco, composição de
prompt nos três idiomas, cascata de idioma, SVG da tecla, defaults. Roda em ~1 s.

**`npm run mic`** exercita o hardware: lista dispositivos, grava 3 s, e reporta latência de
confirmação, taxa de amostras, pico em dBFS e se o MP3 saiu válido. É o teste que pega regressão
no comando do ffmpeg.

**O painel dá para renderizar sem o Stream Deck**, e vale a pena antes de mexer no layout:
copie `ui/i18n.js` e `ui/dictation.html` para uma pasta temporária, injete antes de `</body>`
um `<script>` que chame `handlePlugin({event:"init", …})` com dados falsos, e rode

```bash
chrome --headless --disable-gpu --force-device-scale-factor=2 \
  --window-size=360,1500 --virtual-time-budget=2500 \
  --screenshot=out.png "file:///…/preview.html"
```

Para checar overflow na largura real do painel (340 px), injete
`<style>html,body{width:340px}</style>` e leia `document.body.scrollWidth` via `--dump-dom` com
o valor escrito em `document.title`. Foi assim que se descobriu que o painel morria inteiro
quando o `i18n.js` faltava.

**As imagens do README são geradas, nunca feitas à mão.** O `npm run shots` roda o
[tools/screenshots.ts](tools/screenshots.ts): a faixa de teclas sai do `keyImage()`, a mesma
função que desenha a tecla física, e as telas do painel são o `ui/dictation.html` de verdade
alimentado com os mesmos payloads que o plugin manda pelo `sendToPropertyInspector`. Mexeu na
interface, rode de novo. Captura feita à mão começa a mentir no dia seguinte, e ninguém percebe.

Duas armadilhas ali, as duas já resolvidas, mas boas de saber se for mexer: o Chrome headless
recusa janela mais estreita que ~500 px (por isso a largura é travada no próprio documento e a
altura é lida de volta da página), e o painel liga os botões no `DOMContentLoaded` (por isso o
script injetado precisa esperar por ele, senão todo clique é inócuo).

**Nada disso substitui o teste na tecla física.** Build passando não prova que a waveform mexe.

---

## Estado

**O caminho principal funciona** — validado com voz real em 25/07/2026 (v1.0.1.1): gravar,
transcrever e colar, de ponta a ponta.

Em 26/07/2026 (v1.1.0.0) entraram quatro itens do roadmap: chave da OpenAI colável dentro do
próprio modal de ajuda, 28 idiomas de destino (eram 12), confirmação em duas linhas com o
número grande, e **prévia da tecla ao vivo no painel** — esta última encurta muito o ciclo de
ajuste de aparência, porque tira o Stream Deck físico do caminho. Junto veio a tradução de
todo o texto da tecla para os três idiomas (`key-text.ts`).

Na v1.2.0.0, no mesmo dia, a **virada visual** (roadmap 2.1 e 2.4): fundo quase-preto, cor só
no que informa, **três direções escolhíveis por tecla** (`neon`, `aurora`, `ring`) e o conjunto
de ícones de 5 para 18. Oito propostas foram desenhadas e comparadas antes de escrever o código
definitivo — as folhas ficaram em [docs/estilos/](docs/estilos/), e vale abrir antes de propor
uma nona. Escolher ícone e estilo agora é uma grade de miniaturas, não um `<select>`.

Na v1.3.0.0 (27/07/2026) entrou o **atalho de teclado**: um endereço
`streamdeck://plugins/message/<uuid>/dictate?key=<apelido>&streamdeck=hidden` aciona a
tecla mesmo que ela esteja em outra tela do deck. Medido nesta máquina: **434 ms** entre
disparar o endereço e o plugin receber, e o modo passivo (`streamdeck=hidden`)
**não rouba o foco** — verificado comparando a janela em foco antes e depois, o que é
condição para o texto ser colado no lugar certo.

Na v1.4.0.0 (30/08/2026) o modelo de áudio passou a ser o `gpt-transcribe`, e com ele o
dicionário mudou para `keywords[]` — os números estão na decisão 18 e no
[docs/ROADMAP.pt-BR.md](docs/ROADMAP.pt-BR.md) item 1.1. Os modelos anteriores continuam na
lista e mantêm o caminho antigo intacto. Verificado contra a API real pelo próprio
`transcribe()` do plugin, num áudio sintético: 6/6 termos com o `gpt-transcribe`, 4/6 com o
`gpt-4o-mini-transcribe`, e a blindagem anti-eco ainda pegando o eco do modelo antigo no
silêncio.

**Nada disso foi visto na tecla física ainda** — só no render headless.

O que falta são os **casos de borda**, que não se exercitam no uso normal e falham em silêncio:
trocar de janela durante o processamento, trocar de página no XL durante a gravação, e a
blindagem anti-eco (apertar e parar sem falar). Lista completa em
[docs/ROADMAP.pt-BR.md](docs/ROADMAP.pt-BR.md) item 0; roteiro detalhado em
[docs/ORIGINAL-PLAN.pt-BR.md](docs/ORIGINAL-PLAN.pt-BR.md), seção *Verificação*.

O que vem depois está em [docs/ROADMAP.pt-BR.md](docs/ROADMAP.pt-BR.md).

## Fora de escopo (fase 2)

Transcrever arquivo de áudio existente · capturar áudio do sistema para reuniões · streaming da
transcrição · atalho global sem o Stream Deck · fila de reenvio de áudio que falhou ·
rastreamento de custo.
