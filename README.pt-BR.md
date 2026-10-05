*Idioma: **Português** · [English](README.md)*

# TranscriTranslator — ditado por voz no Stream Deck

[![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-3B6FD4)](LICENSE)
[![Privacidade](https://img.shields.io/badge/privacidade-o%20que%20vai%20%C3%A0%20OpenAI-6E56CF)](PRIVACY.pt-BR.md)
![Plataforma](https://img.shields.io/badge/plataforma-Windows%2010%20%2F%2011-0078D4)
![Stream Deck](https://img.shields.io/badge/Stream%20Deck-7.1%2B-101014)
![Node](https://img.shields.io/badge/Node-24%2B-2E8C3C)
![Interface](https://img.shields.io/badge/interface-pt%20%C2%B7%20en%20%C2%B7%20es-2E7D74)
![Marketplace](https://img.shields.io/badge/Elgato%20Marketplace-ainda%20n%C3%A3o-8a8a90)

Uma tecla do Stream Deck vira um microfone de ditado: **aperta, fala, aperta de novo**, e o
texto aparece no campo onde você estava digitando — transcrito pela OpenAI e, se você quiser,
já limpo, traduzido ou reescrito no tom que você definir.

<img src="docs/img/keys.png" width="400" alt="Teclas do Stream Deck: o ciclo do ditado, quatro teclas configuradas de formas diferentes e os estados de aviso">

Toda tecla dessa imagem é o próprio plugin se desenhando — elas saem da mesma função que a
tecla física usa, e são regeradas por `npm run shots`. Nada ali é montagem.

> **A chave da OpenAI é sua.** O plugin não tem serviço próprio: ele fala com a *sua* conta na
> OpenAI. O áudio vai para o endpoint de transcrição e, com a segunda etapa ligada, o texto vai
> para um modelo de linguagem. É pagamento por uso, na ordem de **US$ 0,003 por minuto de
> áudio** mais alguns centavos por mil palavras reescritas. Sem chave não se dita nada — o
> painel ensina a obter uma, com os links diretos.

Cada tecla faz um de três trabalhos, e quem escolhe é você: **transcrever** e colar o que foi
dito; **transcrever e traduzir** para um de 28 idiomas; ou **transcrever e reescrever** seguindo
uma instrução que você salvou naquela tecla — e-mail formal, tópicos, o que você digitar. O
primeiro funciona sozinho; os outros dois são o mesmo ditado com uma segunda etapa ligada.

É um plugin **de propósito geral**. Não vem com vocabulário nem prompts de nenhuma área: o
que for do seu trabalho entra pelo seu dicionário e pelos seus presets. E a interface inteira —
painel, prompts e as palavras na tecla — existe em **português, inglês e espanhol**, escolhidos
de forma independente.

## O que ele faz

| | |
|---|---|
| **Ditar em qualquer campo** | Grava o microfone, transcreve e cola — só se você ainda estiver na janela em que começou |
| **Limpar a fala** | Pontuação, sem hesitação, comandos falados ("vírgula", "novo parágrafo") viram sinais, números e datas formatados |
| **Traduzir enquanto você fala** | 28 idiomas de destino, escolhidos numa lista. Sem escrever prompt |
| **Reescrever no seu tom** | Uma instrução livre por tecla: e-mail formal, tópicos, o que você digitar |
| **Revisar uma seleção** | Uma tecla que não grava nada: pega o texto selecionado e devolve reescrito |
| **A sua grafia** | Um dicionário canônico que força `GitHub`, `PostgreSQL`, `CPC` — por comparação exata, não pedindo com jeitinho ao modelo |
| **Acionar pelo teclado** | Um atalho alcança a tecla mesmo que ela esteja em outra tela do deck |
| **Três idiomas de interface** | Português, inglês e espanhol — painel, prompts e texto da tecla, escolhidos separadamente |

## Pré-requisitos

| | |
|---|---|
| Windows | 10 ou 11 |
| App Stream Deck | 7.1+ (qualquer hardware; desenvolvido no XL) |
| ffmpeg | o painel encontra, ou instala com um clique (winget, sem administrador) |
| Chave da OpenAI | pagamento por uso; cerca de US$ 0,003 por minuto de áudio |
| Node | 24+, só para compilar |

## Instalação

Ele **ainda não está no Elgato Marketplace**, então a instalação é a partir do código:

```powershell
git clone https://github.com/ffapd1989/sdplugin-transcritranslator.git
cd sdplugin-transcritranslator
npm install
npm run build
powershell -NoProfile -ExecutionPolicy Bypass -File .\render-images.ps1

streamdeck dev                                        # uma vez, libera plugins locais
streamdeck link com.felipe.transcritranslator.sdPlugin
streamdeck restart com.felipe.transcritranslator
```

No app Stream Deck, arraste **Dictate** (categoria *TranscriTranslator*) para uma tecla. Abra
a seção **Configuração da máquina** no painel e cole a chave da OpenAI — isso é feito **uma
vez** e vale para todas as teclas. Se você ainda não tem chave, o painel ensina a obter uma,
com os links diretos e o custo.

O **ffmpeg** é o programa gratuito que grava o microfone. O painel procura sozinho — inclusive
um instalado há um minuto, com o app Stream Deck ainda aberto. Se não achar, um aviso no topo
oferece **Instalar agora**, que o instala pelo winget, o instalador que já vem no Windows, sem
senha de administrador; **Como instalar** ensina o caminho à mão.

<img src="docs/img/panel-ffmpeg.png" width="340" alt="O guia do ffmpeg: instalar com um clique, ou à mão em três passos">

## Como usar

| Ação | O que faz |
|---|---|
| Toque | Começa a gravar. A tecla vira vermelha e as barras mostram sua voz |
| Toque de novo | Para, transcreve e cola |
| **Segurar ~1 s gravando** | **Cancela** e descarta, sem gastar API |
| Segurar durante o envio | Aborta a chamada em andamento |

Ficar ~10 s em silêncio também encerra sozinho (configurável de 2,5 a 30 s). No modo
**Segurar**, a tecla grava enquanto você mantém o dedo e para ao soltar.

## O painel

Tudo é por tecla, e o painel abre no modo Simples: preset, rótulo, microfone, o idioma que
você vai falar e as duas etapas. O Avançado abre modelos, contexto, silêncio, limites, o
atalho de teclado, cores e ffmpeg.

<table>
<tr>
<td><img src="docs/img/panel-simple.png" width="340" alt="Modo simples: preset, rótulo, prévia da tecla ao vivo, microfone, idioma falado e as duas etapas"></td>
<td valign="top"><img src="docs/img/panel-capture.png" width="340" alt="Captura: modo, parada por silêncio, limite, bipe e o atalho de teclado com o endereço pronto"></td>
</tr>
<tr>
<td align="center"><em>Modo simples</em></td>
<td align="center"><em>Captura, com o atalho de teclado</em></td>
</tr>
</table>

- **Cada preset se explica** — ao selecionar um, aparece uma frase dizendo para que ele serve;
  no modo Avançado vem junto o detalhamento do que ele configura, **gerado a partir do próprio
  preset**, então nunca diverge do que ele faz de verdade.
- **A prévia da tecla é a tecla** — a imagem ao lado do rótulo não é ilustração, é o mesmo PNG
  que o Stream Deck recebe, redesenhado enquanto você digita.
- **Sem chave configurada**, um aviso aparece no topo com um guia passo a passo.

## Nenhum prompt é oculto

*Ver o que será enviado* abre o texto **exato** que vai para a OpenAI nas duas etapas, peça por
peça: o dicionário que viaja junto com a transcrição, a camada de limpeza, a instrução de
tradução, a grafia canônica e as travas de segurança. Se o plugin manda, você pode ler.

<img src="docs/img/panel-prompt.png" width="340" alt="O texto exato enviado à OpenAI, separado em blocos nomeados">

> A imagem mostra os prompts em inglês porque a tecla do exemplo fala inglês: o idioma dos
> prompts acompanha a **fala**, não o painel.

## Presets

Cada tecla é independente. Os presets são **moldes**: aplicar copia os valores para a tecla,
que segue própria dali em diante. Salve os seus com *Salvar como…* — eles vão para
`%LOCALAPPDATA%\transcritranslator\presets.json` e podem ser levados para outra máquina.

| Preset | Grava? | Faz com o texto |
|---|---|---|
| Ditado cru | sim | nada — cola exatamente o que foi transcrito |
| **Ditado limpo** (padrão) | sim | pontua e limpa a fala, sem trocar suas palavras |
| Traduzir → inglês | sim | limpa e traduz (badge `EN` na tecla) |
| Traduzir → espanhol | sim | limpa e traduz (badge `ES` na tecla) |
| Traduzir → português | sim | para captar um trecho estrangeiro na sua língua |
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
o idioma na lista, e a tecla passa a exibir a sigla no canto (`EN`, `ES`).

## Deixar a tecla com a sua cara

Três direções visuais — `neon`, `aurora`, `ring` — e 18 ícones, escolhidos numa grade de
miniaturas em vez de um `<select>`. As miniaturas são desenhadas pelo plugin na cor e no
estilo da própria tecla, então a grade mostra o que a tecla vai mostrar.

<img src="docs/img/panel-appearance.png" width="340" alt="Aparência: amostras de cor por estado, os três estilos de tecla e a grade de ícones">

## Acionar pelo teclado

A tecla não precisa estar na tela para receber um ditado. Dê um apelido a ela e o painel
entrega um endereço pronto:

```
streamdeck://plugins/message/com.felipe.transcritranslator/dictate?key=translate&streamdeck=hidden
```

Cole isso no PowerToys → Keyboard Manager → *Remapear um atalho* → **Abrir URI**, e o atalho
passa a iniciar e encerrar aquela tecla de qualquer lugar — inclusive quando ela está na tela 5
do deck e você está na tela 1. Medido na máquina de desenvolvimento: **434 ms** entre disparar
o endereço e o plugin receber, e o modo passivo (`streamdeck=hidden`) **não** rouba o foco, que
é o que permite ao texto cair na janela certa.

Tecla sem apelido não é acionável de fora. O campo nasce vazio, e essa é a posição segura:
qualquer programa da máquina pode disparar um endereço `streamdeck://`.

## Idiomas — três eixos independentes

Português, inglês e espanhol, em três lugares que **não precisam concordar**:

| Eixo | O que controla | Padrão |
|---|---|---|
| 🌐 **Painel** | o que **você** lê | segue o Windows, depois o app Stream Deck |
| 📝 **Presets e prompts** | o que a **IA** lê | segue o idioma falado da tecla |
| 🎙 **Idioma falado** (por tecla) | o que a transcrição espera ouvir | Detectar |

Isso existe porque são perguntas diferentes. Quem usa o Stream Deck em inglês e trabalha em
português precisa exatamente disso — e o app só informa um idioma. O Windows vem primeiro
porque o app Stream Deck não tem português: numa máquina brasileira o app diz inglês e o
Windows diz a verdade.

**Vale informar o idioma falado.** *Detectar* é o padrão e funciona com qualquer idioma, mas a
documentação da OpenAI é explícita: fornecê-lo *"will improve accuracy and latency"*. Por isso
ele fica na seção essencial, e não escondido no avançado.

**E se eu misturo idiomas?** O `language` é uma **dica, não um filtro**: palavras soltas em
outro idioma (*deploy*, *commit*, *workshop*) saem certas mesmo com um idioma fixo. O que
quebra é fixar o idioma errado num áudio majoritariamente estrangeiro — aí use *Detectar*. E
para garantir a **grafia** de termos estrangeiros, o caminho é o dicionário canônico, que é
determinístico e não depende de o modelo acertar.

E não é só rótulo traduzido: **os prompts mudam de idioma junto**, porque a camada de limpeza
depende de exemplos da língua falada. "vírgula" e as muletas "né", "tipo" só existem em
português; em inglês são "comma", "um", "you know"; em espanhol, "coma", "este", "o sea". Um
prompt em português aplicado a uma fala em inglês perderia justamente a parte que trabalha.
Os nomes e as instruções dos presets seguem o mesmo eixo.

## Dicionário de palavras canônicas

Suas siglas e termos próprios, em **Configuração da máquina → Abrir dicionário**. Ele age em
duas frentes:

<img src="docs/img/panel-dictionary.png" width="340" alt="O dicionário de palavras canônicas em janela própria">

1. **Na entrada** — ajuda o modelo a *ouvir* certo, e o caminho depende do modelo de áudio:
   - o `gpt-transcribe` (o padrão) recebe o dicionário em `keywords[]`, um campo feito
     exatamente para isso. Até **32 termos**; daí para cima a acurácia começa a cair em vez
     de subir.
   - os modelos anteriores recebem dentro do `prompt`, com teto de **224 tokens** (~75
     siglas); o que passar disso a API descarta em silêncio, e descarta o *começo*, por isso
     o dicionário é cortado antes do seu contexto. O painel mostra um medidor — que some no
     `gpt-transcribe`, onde o dicionário não gasta mais esse orçamento.
2. **Na correção final** — uma comparação exata força a grafia canônica no texto pronto.
   Sem limite de quantidade, sem custo e sem chance de alucinação. É esta que garante o
   resultado; a primeira só melhora as chances.

Medido com um áudio sintético contendo seis termos: 4 de 6 ouvidos corretamente com o
dicionário no prompt (em qualquer uma das duas gerações de modelo), **6 de 6** com ele em
`keywords[]`.

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
| `…\settings.json` | idiomas, dicionário e caminho do ffmpeg |

A chave **não** fica nas configurações do Stream Deck: elas viram um `.json` em texto plano em
`%APPDATA%\Elgato`. No DPAPI ela só abre nesta conta do Windows.

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
npm run test      # 279 asserções das partes puras (dicionário, prompts, idiomas, SVG, defaults)
npm run mic       # grava 3 s do microfone e valida o núcleo contra o hardware
npm run shots     # regera docs/img/ e docs/marketplace/ a partir da interface real
npm run watch     # rebuild automático
npm run build
streamdeck restart com.felipe.transcritranslator
```

`npm run mic -- "NOME DO MICROFONE"` testa um dispositivo específico. Ele reporta latência de
confirmação, taxa de amostras, pico em dBFS e se o MP3 saiu válido — é o teste que pega
regressão no comando do ffmpeg.

O `@action` do SDK 3 usa **decorators TC39** — não ative `experimentalDecorators`. O bundle
precisa do banner `createRequire` em [`build.mjs`](build.mjs), porque a lib `ws` do SDK usa
`require()` de builtins.

Log do plugin: `%APPDATA%\Elgato\StreamDeck\logs\StreamDeck.log` (procure
`com.felipe.transcritranslator`; "Plugin connected" = subiu).

## Estrutura

| Arquivo | Papel |
|---|---|
| [src/lib/recorder.ts](src/lib/recorder.ts) | ffmpeg: lista microfones, grava, mede nível, detecta silêncio |
| [src/lib/ffmpeg.ts](src/lib/ffmpeg.ts) | encontra o ffmpeg (inclusive pelo PATH do registro) e o instala pelo winget |
| [src/lib/openai.ts](src/lib/openai.ts) | as duas chamadas, retries, recusa, anti-eco |
| [src/lib/prompts.ts](src/lib/prompts.ts) | composição do prompt em camadas |
| [src/lib/prompt-text.ts](src/lib/prompt-text.ts) | o texto dos prompts em pt/en/es — o que a IA lê |
| [src/lib/preset-text.ts](src/lib/preset-text.ts) | nomes e instruções dos presets em pt/en/es |
| [src/lib/canon.ts](src/lib/canon.ts) | dicionário: prompt com teto de tokens + correção por regex |
| [src/lib/deliver.ts](src/lib/deliver.ts) | foco, clipboard, colagem, histórico |
| [src/lib/sessions.ts](src/lib/sessions.ts) | estado global das teclas, trava de gravação única, órfãos |
| [src/lib/shortcuts.ts](src/lib/shortcuts.ts) | apelido → tecla, para o atalho alcançar tecla fora da tela |
| [src/lib/icons.ts](src/lib/icons.ts) | a tecla desenhada em SVG |
| [src/actions/dictation.ts](src/actions/dictation.ts) | máquina de estados e ponte com o painel |
| [com.felipe.transcritranslator.sdPlugin/ui/dictation.html](com.felipe.transcritranslator.sdPlugin/ui/dictation.html) | painel, sem dependência de rede |
| [com.felipe.transcritranslator.sdPlugin/ui/i18n.js](com.felipe.transcritranslator.sdPlugin/ui/i18n.js) | textos do painel em pt/en/es |
| [tools/screenshots.ts](tools/screenshots.ts) | regera as imagens deste README a partir da interface real |

## Diagnóstico

| Sintoma | Causa provável |
|---|---|
| "sem chave" | chave não salva no cofre — painel → Configuração da máquina |
| "sem ffmpeg" | ffmpeg não encontrado — **Instalar agora** no aviso do topo do painel, ou **Como instalar** |
| "microfone indisponível" | o microfone foi desconectado, renomeado ou está preso em outro programa — escolha de novo no painel |
| "sem fala" sempre | microfone mudo ou errado — rode `npm run mic` e use **Testar** no painel |
| "copiado, Ctrl+V" | você trocou de janela durante o processamento; o texto está no clipboard |
| "cru — bloqueado" | a etapa de texto foi recusada; a transcrição foi colada sem tratamento |
| "ocupado" | outra tecla já está gravando |
| Tecla não aparece | rode `streamdeck dev` e refaça o `link` |

---

## Documentação

| Arquivo | Para quem |
|---|---|
| **README.pt-BR.md** (este) | quem vai **usar** o plugin |
| [CLAUDE.pt-BR.md](CLAUDE.pt-BR.md) | quem vai **mexer no código** — arquitetura, armadilhas e decisões que não devem ser revertidas |
| [CONTRIBUTING.pt-BR.md](CONTRIBUTING.pt-BR.md) | como compilar, as quatro regras inegociáveis, como relatar bug |
| [PRIVACY.pt-BR.md](PRIVACY.pt-BR.md) | o que é enviado à OpenAI, o que fica em disco, como apagar |
| [SECURITY.pt-BR.md](SECURITY.pt-BR.md) | relatar vulnerabilidade, e a superfície de ataque que vale conhecer |
| [CODE_OF_CONDUCT.pt-BR.md](CODE_OF_CONDUCT.pt-BR.md) | seja decente, e o que acontece se alguém não for |
| [docs/ORIGINAL-PLAN.pt-BR.md](docs/ORIGINAL-PLAN.pt-BR.md) | histórico: o plano aprovado antes da implementação, com o porquê de cada escolha |
| [docs/ROADMAP.pt-BR.md](docs/ROADMAP.pt-BR.md) | o que vem depois — pendências e ideias, com contexto para retomar |

**Todos existem também em inglês**, ao lado, sem o sufixo `.pt-BR`, com a troca no topo de cada
página — e a versão em inglês é a canônica. O índice dos dois conjuntos está em
[docs/README.pt-BR.md](docs/README.pt-BR.md).

> As abas que o GitHub mostra no topo da página do repositório (*Readme*, *MIT license*,
> *Code of conduct*, *Security*) só reconhecem nomes de arquivo fixos, então elas sempre abrem a
> versão em inglês. O link de troca no topo de cada página leva à portuguesa.

## Agradecimentos

| Projeto | Autor | Licença | Como é usado |
|---|---|---|---|
| [Stream Deck SDK](https://github.com/elgatosf/streamdeck) (`@elgato/streamdeck`, `@elgato/schemas`, `@elgato/utils`) | Corsair Memory Inc. | MIT | empacotado |
| [ws](https://github.com/websockets/ws) | Einar Otto Stangvik, Arnout Kazemier, Luigi Pinca e colaboradores | MIT | empacotado, via SDK |
| [zod](https://github.com/colinhacks/zod) | Colin McDonnell | MIT | empacotado, via SDK |
| [FFmpeg](https://ffmpeg.org) — build do [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) | os desenvolvedores do FFmpeg; build de Gyan Doshi | GPL-3.0 | **não empacotado** — instalado por você, chamado como programa à parte |
| [API da OpenAI](https://platform.openai.com) | OpenAI | termos do serviço | a transcrição e a etapa de texto, com a sua chave |

As licenças do que vai empacotado viajam com o plugin em `THIRD-PARTY-NOTICES.txt`, gerado pelo
build a partir do que foi de fato empacotado.

## Licença

[MIT](LICENSE) — Felipe Drummond ([@ffapd1989](https://github.com/ffapd1989)).
