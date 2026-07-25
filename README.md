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
| Traduzir para inglês | sim | limpa e traduz (badge `EN` na tecla) |
| Traduzir para espanhol | sim | limpa e traduz (badge `ES` na tecla) |
| E-mail formal | sim | limpa e reescreve como e-mail |
| Tópicos | sim | limpa e organiza em marcadores |
| Só revisar a seleção | **não** | pega o texto selecionado (Ctrl+C) e revisa por cima |

## As duas etapas

O painel mostra a tecla como um caminho de duas etapas, porque é isso que ela é:

```
1. OUVIR          sua voz vira texto        [modelo de áudio]
        ↓
2. ESCREVER       o texto vira outro texto  [modelo de linguagem]
```

São dois modelos diferentes porque são dois trabalhos diferentes: um escuta áudio, o outro
escreve. **Traduzir é trabalho do segundo** — o primeiro só sabe transcrever o que foi falado,
no idioma em que foi falado. Cada etapa liga e desliga por conta, e é daí que saem as
combinações úteis:

| 1. Ouvir | 2. Escrever | Resultado |
|---|---|---|
| ✅ | ❌ | ditado cru, mais rápido e mais barato |
| ✅ | limpeza | ditado limpo — mesmas palavras, escrita arrumada |
| ✅ | limpeza + tradução | fala em português, sai em inglês |
| ✅ | limpeza + instrução | formalizado, em tópicos, no tom que você pedir |
| ❌ | qualquer | reescreve o que está selecionado, **sem gravar nada** |

A **limpeza de ditado** pontua, tira hesitações ("né", "tipo"), respeita autocorreções
("manda pro João, *quer dizer*, pra Maria" → "manda para a Maria"), converte comandos falados
("vírgula", "novo parágrafo") e formata números e datas. Ela **não** troca suas palavras nem
resume.

Para traduzir **não é preciso escrever prompt**: marque *Traduzir para outro idioma*, escolha
o idioma na lista, e a tecla passa a exibir a sigla no canto (`EN`, `ES`). A instrução é
montada por baixo — e você pode lê-la, veja abaixo.

## O painel

- **Simples / Avançado** — o modo Simples mostra preset, rótulo, microfone e as duas etapas.
  O Avançado abre modelos, idioma falado, contexto, silêncio, limites, cores e ffmpeg.
- **Cada preset se explica** — ao selecionar um, aparece uma frase dizendo para que ele serve;
  no modo Avançado vem junto o detalhamento do que ele configura, **gerado a partir do próprio
  preset**, então nunca diverge do que ele faz de verdade.
- **Ver o que será enviado** — abre o texto **exato** que vai para a OpenAI nas duas etapas,
  peça por peça: limpeza, tradução ou sua instrução, grafia canônica e as travas de segurança.
  Nenhum prompt é oculto: se o plugin manda, você pode ler.
- **Sem chave configurada**, um aviso aparece no topo com um guia passo a passo de como obter
  uma na OpenAI, com os links diretos e o custo estimado.

## Idiomas — três eixos independentes

Português, inglês e espanhol, em três lugares que **não precisam concordar**:

| Eixo | O que controla | Padrão |
|---|---|---|
| 🌐 **Painel** | o que **você** lê | segue o app Stream Deck |
| 📝 **Presets e prompts** | o que a **IA** lê | segue o idioma falado da tecla |
| 🎙 **Idioma falado** (por tecla) | o que a transcrição espera ouvir | português |

Isso existe porque são perguntas diferentes. Quem usa o Stream Deck em inglês e trabalha em
português precisa exatamente disso — e o app só informa um idioma.

E não é só rótulo traduzido: **os prompts mudam de idioma junto**, porque a camada de limpeza
depende de exemplos da língua falada. "vírgula" e as muletas "né", "tipo" só existem em
português; em inglês são "comma", "um", "you know"; em espanhol, "coma", "este", "o sea". Um
prompt em português aplicado a uma fala em inglês perderia justamente a parte que trabalha.
Os nomes e as instruções dos presets seguem o mesmo eixo.

## Dicionário de palavras canônicas

Suas siglas e termos próprios. Fica em **Configuração da máquina → Abrir dicionário**, que
abre uma janela própria com o campo grande e a contagem de termos ao lado do botão. Ele age em
duas frentes:

1. **No prompt de transcrição** — ajuda o modelo a *ouvir* certo. Tem teto de **224 tokens**
   (~75 siglas); o que passar disso a API descarta em silêncio, e descarta o *começo*, por
   isso o dicionário é cortado antes do seu contexto. O painel mostra um medidor.
2. **Na correção final** — uma comparação exata força a grafia canônica no texto pronto.
   Sem limite de quantidade, sem custo e sem chance de alucinação. É esta que garante o
   resultado; a primeira só melhora as chances.

## O prompt de transcrição vai vazio até você preencher

Vale saber, porque não é óbvio: o parâmetro `prompt` da etapa 1 é montado de **duas fontes,
ambas suas** — o dicionário de palavras canônicas e o campo *Contexto* da tecla. Os dois
nascem vazios, e **nenhum preset de fábrica preenche o Contexto**. Enquanto os dois estiverem
vazios, o parâmetro nem é enviado à API.

Isso é deliberado: contexto genérico atrapalha mais do que ajuda. Preencha o Contexto quando a
tecla tiver assunto fixo ("Reunião técnica sobre infraestrutura de rede") — aí o modelo passa a
ouvir esperando aquele vocabulário.

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
| [com.felipe.transcritranslator.sdPlugin/ui/i18n.js](com.felipe.transcritranslator.sdPlugin/ui/i18n.js) | textos do painel em pt/en/es |

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
