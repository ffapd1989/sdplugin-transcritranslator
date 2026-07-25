# TranscriTranslator — ditado por voz no Stream Deck

Uma tecla do Stream Deck vira um microfone de ditado: **aperta, fala, aperta de novo**, e o
texto aparece no campo onde você estava digitando — transcrito pela OpenAI e, se você quiser,
já limpo, traduzido ou reescrito no tom que você definir.

É um plugin **de propósito geral**. Não vem com vocabulário nem prompts de nenhuma área: o
que for do seu trabalho entra pelo seu dicionário e pelos seus presets.

```
┌────────┐   aperta   ┌────────┐   aperta   ┌────────┐        ┌────────┐
│   ▂▄▆   │  ───────>  │ ▁▃▅█▆▃▁ │  ───────>  │   ▚▚    │ ─────> │   ✓    │
│   ███   │            │ ▁▃▅█▆▃▁ │            │         │        │        │
│ Ditado  │            │  0:07   │            │ enviando│        │142 pal.│
└────────┘            └────────┘            └────────┘        └────────┘
   ocioso               gravando              enviando          colado
```

## Instalação

Pré-requisitos: **Node 24+**, app **Stream Deck 6.5+**, **ffmpeg** no PATH (o
`ffmpeg full build` traz o `ffplay`, usado nos bipes) e uma **chave da API da OpenAI**.

```powershell
cd "H:\...\PLUGINS STREAMDECK\TRANSCRITRANSLATOR"
npm install
npm run build
powershell -NoProfile -ExecutionPolicy Bypass -File .\render-images.ps1

streamdeck dev                                        # uma vez, libera plugins locais
streamdeck link com.felipe.transcritranslator.sdPlugin
streamdeck restart com.felipe.transcritranslator
```

No app Stream Deck, arraste **Ditado** (categoria *TranscriTranslator*) para uma tecla. Abra
a seção **Configuração da máquina** no painel e cole a chave da OpenAI — isso é feito **uma
vez** e vale para todas as teclas.

## Como usar

| Ação | O que faz |
|---|---|
| Toque | Começa a gravar. A tecla vira vermelha e as barras mostram sua voz |
| Toque de novo | Para, transcreve e cola |
| **Segurar ~1 s gravando** | **Cancela** e descarta, sem gastar API |
| Segurar durante o envio | Aborta a chamada em andamento |

Ficar ~2,5 s em silêncio também encerra sozinho (configurável). No modo **Segurar**, a tecla
grava enquanto você mantém o dedo e para ao soltar.

## Presets

Cada tecla é independente. Os presets são **moldes**: aplicar copia os valores para a tecla,
que segue própria dali em diante. Salve os seus com *Salvar como…* — eles vão para
`%LOCALAPPDATA%\transcritranslator\presets.json` e podem ser levados para outra máquina.

| Preset | Grava? | Faz com o texto |
|---|---|---|
| Ditado cru | sim | nada — cola exatamente o que foi transcrito |
| **Ditado limpo** (padrão) | sim | pontua e limpa a fala, sem trocar suas palavras |
| → Inglês | sim | limpa e traduz |
| E-mail formal | sim | limpa e reescreve como e-mail |
| Tópicos | sim | limpa e organiza em marcadores |
| Só reescrever seleção | **não** | pega o texto selecionado (Ctrl+C) e reescreve por cima |

## As duas etapas

Transcrição e processamento de texto **ligam e desligam separadamente**, e é isso que gera as
combinações úteis:

| Transcrição | Texto | Resultado |
|---|---|---|
| ✅ | ❌ | ditado cru, mais rápido e mais barato |
| ✅ | limpeza | ditado limpo — mesmas palavras, escrita arrumada |
| ✅ | limpeza + estilo | limpo e traduzido / formalizado / em tópicos |
| ❌ | qualquer | reescreve o que está selecionado, **sem gravar nada** |

A **limpeza de ditado** pontua, tira hesitações ("né", "tipo"), respeita autocorreções
("manda pro João, *quer dizer*, pra Maria" → "manda para a Maria"), converte comandos falados
("vírgula", "novo parágrafo") e formata números e datas. Ela **não** troca suas palavras nem
resume — isso é trabalho do campo de estilo.

## Dicionário de palavras canônicas

Suas siglas e termos próprios, em **Configuração da máquina**. Ele age em duas frentes:

1. **No prompt de transcrição** — ajuda o modelo a *ouvir* certo. Tem teto de **224 tokens**
   (~75 siglas); o que passar disso a API descarta em silêncio, e descarta o *começo*, por
   isso o dicionário é cortado antes do seu contexto. O painel mostra um medidor.
2. **Na correção final** — uma comparação exata força a grafia canônica no texto pronto.
   Sem limite de quantidade, sem custo e sem chance de alucinação. É esta que garante o
   resultado; a primeira só melhora as chances.

## Onde ficam as coisas

| Caminho | O quê |
|---|---|
| `%LOCALAPPDATA%\transcritranslator\openai-key.xml` | chave, cifrada por **DPAPI** |
| `…\historico\AAAA-MM.md` | histórico mensal (transcrição crua + texto final) |
| `…\audio\` | áudios, se você pedir para guardar |
| `…\audio\falhou\` | áudio de envio que falhou — **sempre preservado** |
| `…\presets.json` | seus presets |

A chave **não** fica nas configurações do Stream Deck: elas viram um `.json` em texto plano em
`%APPDATA%\Elgato`. No DPAPI ela só abre nesta conta do Windows. Mesmo padrão do `cred.xml`
da VPN em `C:\SRVDRU\configurar srvdru\vpn`.

## Decisões que não são óbvias

**O medidor de nível sai pelo stderr do ffmpeg, não pelo stdout.** Medido nesta máquina:

| Saída | Primeira amostra |
|---|---|
| `ametadata … file=-` (stdout) | **4519 ms**, tudo de uma vez no fim |
| `ametadata` sem `file` (log → stderr) | **373 ms**, fluxo contínuo |

O stdout passa por `avio`, que bufferiza; o log vai direto. Pelo stdout a tecla só viraria
"gravando" depois de 4,5 s — as primeiras palavras se perderiam toda vez. **Não troque de
volta.**

**Os limiares de fala e silêncio são relativos ao piso de ruído, não absolutos.** O FIFINE
mede −80 dBFS em silêncio e o headset CORSAIR −96 dBFS. Um limiar fixo tipo "−34 dB é fala"
funcionaria num microfone e diria "sem fala" em todo ditado no outro. O piso é medido durante
a própria gravação (o menor nível visto, que se calibra nos vales entre sílabas), e fala é
"piso + 14 dB".

**A tecla só vira REC quando o ffmpeg confirma captura**, e é aí que o bipe toca. O bipe deixa
de ser enfeite e vira o sinal de "pode falar".

**Áudio é MP3 16 kHz mono 48 kbps** — ~0,36 MB/min contra ~1,9 MB do WAV. O ganho não é banda,
é o teto de 25 MB da API: 13 min viram ~70 min. E sai de graça, porque o encode roda *durante*
a captura. MP3 e não m4a porque é stream puro, sem *moov atom* para finalizar — se o processo
morrer no meio, o que foi gravado continua válido.

**Parar é `q` no stdin do ffmpeg, nunca `taskkill`** — é o `q` que fecha o arquivo direito.

**Anti-eco.** Os modelos GPT-4o às vezes devolvem o próprio `prompt` como se fosse a
transcrição quando o áudio é curto ou silencioso. Como o dicionário vai no prompt, sem defesa
um toque sem querer colaria a sua lista de siglas dentro do documento. Três barreiras: áudio
com menos de 0,8 s ou sem fala não é enviado; retorno parecido demais com o prompt é
descartado; e o auto-parar por silêncio evita gravar vazio.

**Recusa do modelo não custa a sua fala.** Se a etapa de texto for bloqueada por política de
conteúdo, o plugin cola a **transcrição crua** e avisa "cru — bloqueado" — em vez de perder
minutos de ditado por causa do embelezamento.

**Injeção de prompt.** Na modalidade "só reescrever seleção" o texto vem do **clipboard**, que
pode ter sido copiado de qualquer página. O system prompt declara que o texto do usuário é
dado a transformar, nunca ordem a cumprir.

**A gravação sobrevive à troca de página no Stream Deck.** O SDK dispara `willDisappear` ao
navegar para outra página ou perfil; se o estado morasse na instância da tecla, o ditado
morreria junto. Ele vive num registro global indexado pelo id da ação
([`sessions.ts`](src/lib/sessions.ts)).

**O Ctrl+V só acontece se a janela em foco não mudou.** O processo em foco é lido no início e
conferido no fim (`UIAutomation`, 75 ms — P/Invoke com `Add-Type -TypeDefinition` custaria
~1 s porque compila C#). Se você foi fazer outra coisa, o plugin copia e avisa em vez de colar
no lugar errado.

## Desenvolvimento

```powershell
npm run check     # tipos
npm run test      # 42 asserções das partes puras (dicionário, prompts, SVG, defaults)
npm run mic       # grava 3 s do microfone e valida o núcleo contra o hardware
npm run watch     # rebuild automático
npm run build
streamdeck restart com.felipe.transcritranslator
```

`npm run mic -- "NOME DO MICROFONE"` testa um dispositivo específico. Ele reporta latência de
confirmação, taxa de amostras, pico em dBFS e se o MP3 saiu válido — é o teste que pega
regressão no comando do ffmpeg.

O `@action` do SDK v2 usa **decorators TC39** — não ative `experimentalDecorators`. O bundle
precisa do banner `createRequire` em [`build.mjs`](build.mjs), porque a lib `ws` do SDK usa
`require()` de builtins.

Log do plugin: `%APPDATA%\Elgato\StreamDeck\logs\StreamDeck.log` (procure
`com.felipe.transcritranslator`; "Plugin connected" = subiu).

## Estrutura

| Arquivo | Papel |
|---|---|
| [src/lib/recorder.ts](src/lib/recorder.ts) | ffmpeg: lista microfones, grava, mede nível, detecta silêncio |
| [src/lib/openai.ts](src/lib/openai.ts) | as duas chamadas, retries, recusa, anti-eco |
| [src/lib/prompts.ts](src/lib/prompts.ts) | camada de limpeza, composição, travas de segurança |
| [src/lib/canon.ts](src/lib/canon.ts) | dicionário: prompt com teto de tokens + correção por regex |
| [src/lib/deliver.ts](src/lib/deliver.ts) | foco, clipboard, colagem, histórico |
| [src/lib/sessions.ts](src/lib/sessions.ts) | estado global das teclas, trava de gravação única, órfãos |
| [src/lib/icons.ts](src/lib/icons.ts) | a tecla desenhada em SVG |
| [src/actions/dictation.ts](src/actions/dictation.ts) | máquina de estados e ponte com o painel |
| [com.felipe.transcritranslator.sdPlugin/ui/dictation.html](com.felipe.transcritranslator.sdPlugin/ui/dictation.html) | painel, sem dependência de rede |

## Diagnóstico

| Sintoma | Causa provável |
|---|---|
| "sem chave" | chave não salva no cofre — painel → Configuração da máquina |
| "sem ffmpeg" | ffmpeg fora do PATH; informe o caminho no painel |
| "sem fala" sempre | microfone mudo ou errado — rode `npm run mic` e use **Testar** no painel |
| "copiado, Ctrl+V" | você trocou de janela durante o processamento; o texto está no clipboard |
| "cru — bloqueado" | a etapa de texto foi recusada; a transcrição foi colada sem tratamento |
| "ocupado" | outra tecla já está gravando |
| Tecla não aparece | rode `streamdeck dev` e refaça o `link` |
