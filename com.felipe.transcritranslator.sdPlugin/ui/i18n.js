// The panel INTERFACE text, in three languages.
//
// Only text the user reads lives here. What the AI reads — preset names and instructions,
// prompt layers — lives on the plugin side (src/lib/preset-text.ts and prompt-text.ts) and
// reaches the panel already resolved, so the same sentence never exists in two places.
//
// The panel language and the content language are chosen separately: you can read the
// panel in English and have the presets in Portuguese.

window.TT_I18N = {
  pt: {
    _name: "Português",

    modeSimple: "Simples",
    modeAdvanced: "Avançado",

    secBasics: "Preset e essencial",
    secPipeline: "O que esta tecla faz",
    secCapture: "Captura",
    secOutput: "Saída",
    secLook: "Aparência",
    secGlobal: "Configuração da máquina",
    globalBadge: "vale para todas as teclas",

    preset: "Preset",
    apply: "Aplicar",
    saveAs: "Salvar como…",
    delete: "Excluir",
    presetHint: "Aplicar copia os valores para esta tecla. Depois disso ela segue independente.",
    presetName: "Nome do preset:",
    presetSaved: "preset salvo",
    presetBuiltinLocked: "presets de fábrica não podem ser excluídos",

    label: "Rótulo",
    labelHint: "Duas ou três palavras. Quebre a linha para controlar como aparece na tecla — se não quebrar, ele quebra sozinho quando não couber.",
    labelSize: "Tamanho da fonte",
    labelGap: "Espaço entre linhas",
    langDetect: "Detectar (ou misturo idiomas)",
    labelPh: "Ditado",
    preview: "Prévia da tecla",
    previewHint: "É a imagem que o Stream Deck recebe, em tamanho real. Mostra a tecla ociosa.",
    mic: "Microfone",
    micDefault: "Padrão do sistema (primeiro da lista)",
    test: "Testar",
    testing: "gravando 3 segundos — fale alguma coisa…",
    model: "Modelo",

    step1Title: "1. OUVIR",
    step1Sub: "sua voz vira texto",
    step1Model: "modelo de áudio",
    step1On: "Gravar o microfone e transcrever",
    step1Off: "Desligado: a tecla não grava nada e trabalha sobre o texto selecionado.",
    step2Title: "2. ESCREVER",
    step2Sub: "o texto vira outro texto",
    step2Model: "modelo de linguagem",
    step2On: "Processar o texto depois de transcrever",
    whyTwo:
      "São dois modelos diferentes porque são dois trabalhos diferentes: um escuta áudio, " +
      "o outro escreve. Traduzir é trabalho do segundo — o primeiro só sabe transcrever o " +
      "que foi falado, no idioma em que foi falado.",

    cleanup: "Limpar o ditado",
    cleanupHint:
      "Pontua, tira hesitações (“né”, “tipo”), respeita autocorreções (“quer dizer…”), " +
      "converte comandos falados (“vírgula”, “novo parágrafo”) e formata números e datas. " +
      "Não troca as suas palavras.",

    andThen: "E além disso:",
    modeNone: "Nada — só entregar o texto",
    modeTranslate: "Traduzir para outro idioma",
    modeCustom: "Seguir uma instrução minha",
    translateTo: "Traduzir para",
    translateHint: "A tecla passa a mostrar a sigla do idioma no canto.",
    styleLabel: "Sua instrução",
    stylePh: "Ex.: Reescreva como e-mail formal. / Resuma em tópicos. / Deixe mais direto.",

    seePrompt: "Ver o que será enviado",
    hidePrompt: "Ocultar",
    promptTitle: "Texto exato enviado à OpenAI",
    promptStep1: "Etapa 1 — prompt de transcrição",
    promptStep2: "Etapa 2 — instruções de escrita",
    promptEmpty: "(vazio — nada é enviado neste campo)",
    promptOff: "(etapa desligada)",
    promptDropped: "termos cortados pelo limite de 224 tokens:",

    captureMode: "Modo",
    modeToggle: "Toggle — aperta grava, aperta para",
    modePtt: "Segurar — grava enquanto pressiona",
    captureHint: "No modo toggle, segurar a tecla durante a gravação cancela sem gastar API.",
    silenceStop: "Parar sozinho após silêncio",
    silenceSecs: "Silêncio (s)",
    silenceHint:
      "Só arma depois que você começa a falar — a pausa inicial não encerra nada. " +
      "Padrão 10 s; de 2,5 a 30 s. Ignorado no modo Segurar.",
    maxMin: "Limite (min)",
    maxHint: "Corte automático. 0 desliga. O teto da API são 25 MB, cerca de 70 minutos.",
    beep: "Bip ao iniciar e parar",
    beepHint: "O bip de início toca quando o microfone está de fato capturando — é o sinal de “pode falar”.",

    shortcut: "Atalho de teclado",
    shortcutPh: "sem atalho",
    shortcutHint: "Apelido que identifica esta tecla num atalho de teclado. Em branco, a tecla não pode ser acionada de fora — que é a posição segura.",
    shortcutUrlLabel: "Endereço",
    shortcutHow: "Cole o endereço no PowerToys → Gerenciador de Teclado → Remapear um atalho → ação “Abrir URI”. Dentro dos programas que você listar como alvo, o atalho passa a gravar e parar esta tecla mesmo que ela esteja em outra tela.",
    shortcutReady: "Pronto: o atalho aciona esta tecla como “{alias}”.",
    shortcutTaken: "Este apelido já é da tecla “{key}”. Vale a primeira; troque aqui para não ficarem duas.",
    shortcutCopied: "Endereço copiado.",
    shortcutCopyFail: "Não consegui copiar — selecione o texto e use Ctrl+C.",
    copy: "Copiar",

    spokenLang: "Eu vou falar em",
    spokenHint: "Informar o idioma melhora a precisão e a velocidade — a própria OpenAI diz isso. Só deixe em Detectar se você realmente varia de idioma.",
    mixedHint: "Fala misturada: palavras soltas em outro idioma (deploy, commit, workshop) saem certas mesmo com um idioma fixo — o idioma é uma dica, não um filtro. Para garantir a grafia delas, cadastre-as no dicionário de palavras canônicas.",
    context: "Contexto para o modelo de áudio",
    contextPh: "Ex.: Reunião técnica sobre infraestrutura de rede. Fala rápida, com nomes de servidores.",
    contextHint:
      "Ajuda o modelo a ouvir certo antes de errar. Nasce vazio de propósito: contexto genérico " +
      "atrapalha mais do que ajuda. Preencha quando a tecla tiver um assunto fixo.",
    useCanon: "Enviar também o dicionário de palavras canônicas",
    budgetOf: "de",
    budgetTokens: "tokens",
    budgetOver: "— o excedente será descartado",
    budgetHint:
      "A API descarta o que passar de 224 tokens — e descarta o começo, então o dicionário é " +
      "cortado antes do seu contexto. A grafia certa é garantida de qualquer jeito pela correção automática.",

    autoPaste: "Colar no campo focado (Ctrl+V)",
    autoPasteHint:
      "Se você trocar de janela enquanto o texto é processado, o plugin não cola — copia e avisa na tecla.",
    history: "Guardar histórico (.md por mês)",
    folder: "Pasta",
    folderPh: "padrão: %LOCALAPPDATA%\\transcritranslator\\historico",
    keepAudio: "Guardar os áudios gravados",
    keepAudioHint: "Áudio de envio que falhou é preservado de qualquer forma, mesmo com isto desligado.",

    colorIdle: "Ocioso",
    colorRec: "Gravando",
    colorDone: "Pronto",
    icon: "Ícone",
    keyStyle: "Estilo da tecla",
    style_neon: "Neon",
    style_aurora: "Aurora",
    style_ring: "Anel",
    styleHint_neon: "Contorno aceso com halo de cor. É o que mais salta num deck cheio.",
    styleHint_aurora: "Ícone branco sobre uma névoa de cor. O mais discreto dos três.",
    styleHint_ring: "Arco na cor em volta do ícone, como um medidor. Cara de instrumento.",

    icon_mic: "Microfone",
    icon_micOff: "Microfone mudo",
    icon_waves: "Ondas sonoras",
    icon_headset: "Fone",
    icon_globe: "Globo",
    icon_translate: "Tradução",
    icon_bubble: "Balão de fala",
    icon_quote: "Aspas",
    icon_doc: "Documento",
    icon_list: "Lista",
    icon_keyboard: "Teclado",
    icon_code: "Código",
    icon_pen: "Caneta",
    icon_wand: "Varinha",
    icon_bolt: "Raio",
    icon_check: "Confirmação",
    icon_mail: "E-mail",
    icon_calendar: "Calendário",
    icon_none: "Nenhum",

    showLabel: "Mostrar rótulo",
    showTimer: "Mostrar cronômetro",
    showWave: "Mostrar as barras de voz",

    apiKey: "Chave OpenAI",
    save: "Salvar",
    keyOk: "Chave configurada no cofre.",
    keyMissing: "Nenhuma chave — a tecla vai mostrar erro.",
    keyEmpty: "Cole a chave antes de salvar.",
    keyBadFormat: "Isso não parece uma chave da OpenAI — ela começa com sk-.",
    keySaving: "guardando no cofre…",
    keyHint:
      "Guardada cifrada por DPAPI (só abre nesta conta do Windows), nunca nas configurações do " +
      "Stream Deck, que ficam em texto plano no disco.",
    keyClear: "Remover chave",
    canonLabel: "Palavras canônicas",
    canonPh: "SRVDRU, EdgeRouter, WireGuard, Grafana, n8n, PostgreSQL, Kubernetes",
    canonHint:
      "A grafia é corrigida no texto final por comparação exata — sem limite de quantidade e " +
      "sem custo. Termos em MAIÚSCULAS são tratados como siglas.",
    ffmpeg: "ffmpeg",
    ffmpegPh: "vazio = procura no PATH",
    saved: "salvo",

    // languages
    langSection: "Idiomas",
    langUi: "Painel",
    langContent: "Presets e prompts",
    langUiTitle: "Idioma do painel",
    langContentAuto: "Segue o idioma falado da tecla",
    // In English on purpose, like the language names next to it: it is the only option
    // in the selector that is not a language, and it has to be legible to someone who
    // opened the panel in a language they cannot read and is looking for how to change it.
    langFollowApp: "Default",
    langHint:
      "São coisas diferentes: o painel é o que VOCÊ lê; os presets e os prompts são o que a IA lê. " +
      "Dá para manter o Stream Deck em inglês e trabalhar em português. " +
      "Em Painel, Default significa acompanhar o idioma do app Stream Deck.",

    // dictionary
    dictOpen: "Abrir dicionário",
    dictTerms: "termos",
    dictNone: "vazio",
    dictTitle: "Dicionário de palavras canônicas",
    dictIntro:
      "Suas siglas, nomes de produto e termos técnicos. Depois de cada etapa, o plugin corrige a " +
      "grafia deles no texto por comparação exata — sem limite de quantidade, sem custo e sem " +
      "chance de a IA inventar termo que você não falou.",
    dictFooter: "Um termo por vírgula ou por linha. MAIÚSCULAS são tratadas como siglas.",
    close: "Fechar",

    // missing key
    noKeyTitle: "Falta a chave da OpenAI",
    noKeyBody: "Sem ela, a tecla mostra erro ao ser apertada. Leva dois minutos para resolver.",
    noKeyHow: "Como consigo uma chave?",
    helpTitle: "Como obter uma chave da OpenAI",
    helpStep1: "Crie uma conta (ou entre) em platform.openai.com.",
    helpStep2:
      "Adicione crédito em Billing. A API é pré-paga e separada da assinatura do ChatGPT — " +
      "ter ChatGPT Plus NÃO dá acesso à API.",
    helpStep3: "Vá em API keys e clique em “Create new secret key”.",
    helpStep4: "Copie a chave (começa com sk- e só aparece uma vez) e cole no campo aqui embaixo.",
    helpCost:
      "Custo aproximado: cerca de US$ 0,003 por minuto de áudio, mais alguns centavos por mil " +
      "palavras reescritas. Um dia inteiro de ditado costuma custar menos que um café.",
    helpSafety:
      "A chave fica cifrada por DPAPI nesta conta do Windows. Não vai para as configurações do " +
      "Stream Deck nem para lugar nenhum além da própria OpenAI.",
    openPlatform: "Abrir platform.openai.com",
    openKeys: "Página de chaves",
    openBilling: "Billing",
    openPricing: "Preços",

    // preset: description and breakdown
    presetDesc_raw:
      "Cru, do jeito que saiu da boca. Não passa por uma segunda chamada, então é o mais rápido " +
      "e o mais barato — bom para anotação solta, lista de compras, ideia que você não quer perder.",
    presetDesc_clean:
      "O arroz com feijão do ditado. Sai pronto para colar: pontuado, sem “né” e “tipo”, com " +
      "números e datas no formato certo. Arruma a escrita, não o conteúdo — as palavras continuam suas.",
    presetDesc_en:
      "Você fala e sai em inglês, direto no campo. Limpa antes de traduzir, então a tradução parte " +
      "de um texto já arrumado. A tecla mostra EN no canto para você reconhecer de longe.",
    presetDesc_es:
      "Você fala e sai em espanhol, direto no campo. Limpa antes de traduzir, então a tradução " +
      "parte de um texto já arrumado. A tecla mostra ES no canto.",
    presetDesc_pt:
      "Você fala em qualquer idioma e sai em português. Útil para ouvir um trecho estrangeiro e " +
      "já ter o texto na sua língua.",
    presetDesc_email:
      "Para quando você quer mandar o e-mail sem escrever o e-mail. Fala o recado de qualquer jeito " +
      "e volta saudação, corpo direto e fecho. Não inventa destinatário, prazo nem assunto que você não disse.",
    presetDesc_topics:
      "Pensou em voz alta, saiu organizado. Cada ideia vira um item, na ordem em que você falou. " +
      "Bom para ata de reunião, pauta e lista de tarefas.",
    presetDesc_rewrite:
      "A tecla que não grava nada. Selecione um texto qualquer na tela, aperte, e ele volta revisado " +
      "por cima — ortografia, acentuação e pontuação. Feito para o que você escreveu com pressa.",
    presetCustom:
      "Molde que você salvou. O resumo abaixo mostra exatamente o que ele aplica quando você clica em Aplicar.",

    detailTitle: "O que este preset configura",
    detailListen: "Ouvir",
    detailWrite: "Escrever",
    detailOn: "ligado",
    detailOff: "desligado",
    detailCleanup: "Limpeza de ditado",
    detailStyle: "Instrução",
    detailTranslate: "Traduzir para",
    detailNothing: "nada além de entregar o texto",
    detailKeyLabel: "Rótulo da tecla",

    uiAuto: "Automático",
    aboutMe: "feito por Felipe Drummond",
  },

  en: {
    _name: "English",

    modeSimple: "Simple",
    modeAdvanced: "Advanced",

    secBasics: "Preset and essentials",
    secPipeline: "What this key does",
    secCapture: "Capture",
    secOutput: "Output",
    secLook: "Appearance",
    secGlobal: "Machine settings",
    globalBadge: "applies to every key",

    preset: "Preset",
    apply: "Apply",
    saveAs: "Save as…",
    delete: "Delete",
    presetHint: "Applying copies the values into this key. From then on it stands alone.",
    presetName: "Preset name:",
    presetSaved: "preset saved",
    presetBuiltinLocked: "built-in presets cannot be deleted",

    label: "Label",
    labelHint: "Two or three words. Break the line to control how it sits on the key — if you do not, it wraps on its own when it does not fit.",
    labelSize: "Font size",
    labelGap: "Line spacing",
    langDetect: "Detect (or I mix languages)",
    labelPh: "Dictate",
    preview: "Key preview",
    previewHint: "The very image Stream Deck receives, at full size. Shows the key while idle.",
    mic: "Microphone",
    micDefault: "System default (first in the list)",
    test: "Test",
    testing: "recording 3 seconds — say something…",
    model: "Model",

    step1Title: "1. LISTEN",
    step1Sub: "your voice becomes text",
    step1Model: "audio model",
    step1On: "Record the microphone and transcribe",
    step1Off: "Off: the key records nothing and works on the selected text instead.",
    step2Title: "2. WRITE",
    step2Sub: "text becomes other text",
    step2Model: "language model",
    step2On: "Process the text after transcribing",
    whyTwo:
      "These are two different models because they are two different jobs: one listens to audio, " +
      "the other writes. Translation belongs to the second — the first only transcribes what was " +
      "said, in the language it was said.",

    cleanup: "Clean up the dictation",
    cleanupHint:
      "Punctuates, removes fillers, honours self-corrections (“I mean…”), turns spoken commands " +
      "(“comma”, “new paragraph”) into marks, and formats numbers and dates. It does not swap your words.",

    andThen: "And on top of that:",
    modeNone: "Nothing — just hand over the text",
    modeTranslate: "Translate into another language",
    modeCustom: "Follow an instruction of mine",
    translateTo: "Translate into",
    translateHint: "The key then shows the language code in the corner.",
    styleLabel: "Your instruction",
    stylePh: "E.g. Rewrite as a formal email. / Summarise in bullets. / Make it more direct.",

    seePrompt: "See what will be sent",
    hidePrompt: "Hide",
    promptTitle: "Exact text sent to OpenAI",
    promptStep1: "Step 1 — transcription prompt",
    promptStep2: "Step 2 — writing instructions",
    promptEmpty: "(empty — nothing is sent in this field)",
    promptOff: "(step disabled)",
    promptDropped: "terms cut by the 224-token limit:",

    captureMode: "Mode",
    modeToggle: "Toggle — press to start, press to stop",
    modePtt: "Hold — records while pressed",
    captureHint: "In toggle mode, holding the key while recording cancels without spending API.",
    silenceStop: "Stop by itself after silence",
    silenceSecs: "Silence (s)",
    silenceHint:
      "Only arms after you start speaking — the initial pause ends nothing. " +
      "Default 10 s; from 2.5 to 30 s. Ignored in Hold mode.",
    maxMin: "Limit (min)",
    maxHint: "Automatic cutoff. 0 disables it. The API ceiling is 25 MB, about 70 minutes.",
    beep: "Beep on start and stop",
    beepHint: "The start beep fires when the microphone is actually capturing — that is your “speak now”.",

    shortcut: "Keyboard shortcut",
    shortcutPh: "no shortcut",
    shortcutHint: "Nickname that identifies this key in a keyboard shortcut. Left blank, the key cannot be triggered from outside — which is the safe position.",
    shortcutUrlLabel: "Address",
    shortcutHow: "Paste the address into PowerToys → Keyboard Manager → Remap a shortcut → “Open URI” action. Inside the apps you set as target, the shortcut starts and stops this key even when it sits on another page.",
    shortcutReady: "Ready: the shortcut triggers this key as “{alias}”.",
    shortcutTaken: "That nickname already belongs to the key “{key}”. First one wins; change it here so you don't keep two.",
    shortcutCopied: "Address copied.",
    shortcutCopyFail: "Could not copy — select the text and press Ctrl+C.",
    copy: "Copy",

    spokenLang: "I will speak in",
    spokenHint: "Telling it the language improves accuracy and speed — OpenAI says so itself. Only leave it on Detect if you genuinely switch languages.",
    mixedHint: "Mixed speech: stray words from another language (deploy, commit, workshop) come out right even with a fixed language — the language is a hint, not a filter. To lock their spelling, add them to the canonical word dictionary.",
    context: "Context for the audio model",
    contextPh: "E.g. Technical meeting about network infrastructure. Fast speech, server names.",
    contextHint:
      "Helps the model hear correctly instead of guessing. Empty on purpose: generic context hurts " +
      "more than it helps. Fill it in when the key has a fixed subject.",
    useCanon: "Also send the canonical word list",
    budgetOf: "of",
    budgetTokens: "tokens",
    budgetOver: "— the excess will be discarded",
    budgetHint:
      "The API drops anything past 224 tokens — and drops the beginning, so the dictionary is cut " +
      "before your context. Correct spelling is guaranteed anyway by the automatic correction.",

    autoPaste: "Paste into the focused field (Ctrl+V)",
    autoPasteHint: "If you switch windows while the text is processed, the plugin copies instead of pasting.",
    history: "Keep history (.md per month)",
    folder: "Folder",
    folderPh: "default: %LOCALAPPDATA%\\transcritranslator\\historico",
    keepAudio: "Keep the recorded audio",
    keepAudioHint: "Audio from a failed upload is preserved regardless of this setting.",

    colorIdle: "Idle",
    colorRec: "Recording",
    colorDone: "Done",
    icon: "Icon",
    keyStyle: "Key style",
    style_neon: "Neon",
    style_aurora: "Aurora",
    style_ring: "Ring",
    styleHint_neon: "Lit outline with a colour halo. The one that stands out most on a full deck.",
    styleHint_aurora: "White icon over a haze of colour. The quietest of the three.",
    styleHint_ring: "A coloured arc around the icon, like a gauge. Instrument-panel look.",

    icon_mic: "Microphone",
    icon_micOff: "Muted microphone",
    icon_waves: "Sound waves",
    icon_headset: "Headphones",
    icon_globe: "Globe",
    icon_translate: "Translation",
    icon_bubble: "Speech bubble",
    icon_quote: "Quotes",
    icon_doc: "Document",
    icon_list: "List",
    icon_keyboard: "Keyboard",
    icon_code: "Code",
    icon_pen: "Pen",
    icon_wand: "Wand",
    icon_bolt: "Bolt",
    icon_check: "Check",
    icon_mail: "Email",
    icon_calendar: "Calendar",
    icon_none: "None",

    showLabel: "Show label",
    showTimer: "Show timer",
    showWave: "Show voice bars",

    apiKey: "OpenAI key",
    save: "Save",
    keyOk: "Key stored in the vault.",
    keyMissing: "No key — the key will show an error.",
    keyEmpty: "Paste the key before saving.",
    keyBadFormat: "That does not look like an OpenAI key — they start with sk-.",
    keySaving: "storing in the vault…",
    keyHint:
      "Stored encrypted with DPAPI (only opens under this Windows account), never in the Stream Deck " +
      "settings, which sit in plain text on disk.",
    keyClear: "Remove key",
    canonLabel: "Canonical words",
    canonPh: "SRVDRU, EdgeRouter, WireGuard, Grafana, n8n, PostgreSQL, Kubernetes",
    canonHint:
      "Spelling is fixed in the final text by exact comparison — no size limit and no cost. " +
      "UPPERCASE terms are treated as acronyms.",
    ffmpeg: "ffmpeg",
    ffmpegPh: "empty = look it up in PATH",
    saved: "saved",

    langSection: "Languages",
    langUi: "Panel",
    langContent: "Presets and prompts",
    langUiTitle: "Panel language",
    langContentAuto: "Follow the key's spoken language",
    langFollowApp: "Default",
    langHint:
      "These are different things: the panel is what YOU read; presets and prompts are what the AI " +
      "reads. You can keep Stream Deck in English and work in another language. " +
      "Under Panel, Default means following the Stream Deck app's language.",

    dictOpen: "Open dictionary",
    dictTerms: "terms",
    dictNone: "empty",
    dictTitle: "Canonical word dictionary",
    dictIntro:
      "Your acronyms, product names and technical terms. After each step the plugin fixes their " +
      "spelling in the text by exact comparison — no size limit, no cost and no chance of the AI " +
      "inventing a term you never said.",
    dictFooter: "One term per comma or per line. UPPERCASE is treated as an acronym.",
    close: "Close",

    noKeyTitle: "OpenAI key missing",
    noKeyBody: "Without it the key shows an error when pressed. It takes two minutes to sort out.",
    noKeyHow: "How do I get a key?",
    helpTitle: "How to get an OpenAI key",
    helpStep1: "Create an account (or sign in) at platform.openai.com.",
    helpStep2:
      "Add credit under Billing. The API is prepaid and separate from the ChatGPT subscription — " +
      "having ChatGPT Plus does NOT grant API access.",
    helpStep3: "Go to API keys and click “Create new secret key”.",
    helpStep4: "Copy the key (it starts with sk- and is shown only once) and paste it in the field just below.",
    helpCost:
      "Rough cost: about US$0.003 per minute of audio, plus a few cents per thousand rewritten words. " +
      "A full day of dictation usually costs less than a coffee.",
    helpSafety:
      "The key is encrypted with DPAPI under this Windows account. It never reaches the Stream Deck " +
      "settings, nor anywhere other than OpenAI itself.",
    openPlatform: "Open platform.openai.com",
    openKeys: "API keys page",
    openBilling: "Billing",
    openPricing: "Pricing",

    presetDesc_raw:
      "Raw, exactly as it left your mouth. No second call, so it is the fastest and the cheapest — " +
      "good for a quick note, a shopping list, an idea you do not want to lose.",
    presetDesc_clean:
      "The bread and butter of dictation. Comes back ready to paste: punctuated, without fillers, " +
      "numbers and dates properly formatted. It fixes the writing, not the content — the words stay yours.",
    presetDesc_en:
      "You speak, it lands in English right in the field. Cleans before translating, so the translation " +
      "starts from tidy text. The key shows EN in the corner so you can tell at a glance.",
    presetDesc_es:
      "You speak, it lands in Spanish right in the field. Cleans before translating, so the translation " +
      "starts from tidy text. The key shows ES in the corner.",
    presetDesc_pt:
      "You speak in any language and it lands in Portuguese. Handy to catch a foreign passage and get " +
      "the text in your own language.",
    presetDesc_email:
      "For when you want to send the email without writing the email. Say the message however it comes " +
      "out and get back a greeting, a direct body and a sign-off. It invents no recipient, deadline or " +
      "subject you did not mention.",
    presetDesc_topics:
      "You thought out loud, it came back organised. Each idea becomes an item, in the order you said " +
      "them. Good for meeting notes, agendas and to-do lists.",
    presetDesc_rewrite:
      "The key that records nothing. Select any text on screen, press it, and the text comes back " +
      "proofread in place — spelling, accents and punctuation. Made for whatever you typed in a hurry.",
    presetCustom:
      "A mould you saved. The summary below shows exactly what it applies when you hit Apply.",

    detailTitle: "What this preset sets",
    detailListen: "Listen",
    detailWrite: "Write",
    detailOn: "on",
    detailOff: "off",
    detailCleanup: "Dictation cleanup",
    detailStyle: "Instruction",
    detailTranslate: "Translate into",
    detailNothing: "nothing beyond handing over the text",
    detailKeyLabel: "Key label",

    uiAuto: "Automatic",
    aboutMe: "made by Felipe Drummond",
  },

  es: {
    _name: "Español",

    modeSimple: "Simple",
    modeAdvanced: "Avanzado",

    secBasics: "Preset y esencial",
    secPipeline: "Qué hace esta tecla",
    secCapture: "Captura",
    secOutput: "Salida",
    secLook: "Apariencia",
    secGlobal: "Configuración de la máquina",
    globalBadge: "vale para todas las teclas",

    preset: "Preset",
    apply: "Aplicar",
    saveAs: "Guardar como…",
    delete: "Eliminar",
    presetHint: "Aplicar copia los valores a esta tecla. A partir de ahí es independiente.",
    presetName: "Nombre del preset:",
    presetSaved: "preset guardado",
    presetBuiltinLocked: "los presets de fábrica no se pueden eliminar",

    label: "Etiqueta",
    labelHint: "Dos o tres palabras. Salta de línea para controlar cómo queda en la tecla — si no lo haces, se ajusta solo cuando no cabe.",
    labelSize: "Tamaño de fuente",
    labelGap: "Espacio entre líneas",
    langDetect: "Detectar (o mezclo idiomas)",
    labelPh: "Dictado",
    preview: "Vista previa de la tecla",
    previewHint: "Es la imagen que recibe el Stream Deck, a tamaño real. Muestra la tecla inactiva.",
    mic: "Micrófono",
    micDefault: "Predeterminado del sistema (el primero de la lista)",
    test: "Probar",
    testing: "grabando 3 segundos — di algo…",
    model: "Modelo",

    step1Title: "1. ESCUCHAR",
    step1Sub: "tu voz se vuelve texto",
    step1Model: "modelo de audio",
    step1On: "Grabar el micrófono y transcribir",
    step1Off: "Apagado: la tecla no graba nada y trabaja sobre el texto seleccionado.",
    step2Title: "2. ESCRIBIR",
    step2Sub: "el texto se vuelve otro texto",
    step2Model: "modelo de lenguaje",
    step2On: "Procesar el texto después de transcribir",
    whyTwo:
      "Son dos modelos distintos porque son dos trabajos distintos: uno escucha audio, el otro " +
      "escribe. Traducir es tarea del segundo — el primero solo transcribe lo que se dijo, en el " +
      "idioma en que se dijo.",

    cleanup: "Limpiar el dictado",
    cleanupHint:
      "Puntúa, quita muletillas, respeta autocorrecciones (“quiero decir…”), convierte comandos " +
      "hablados (“coma”, “nuevo párrafo”) y formatea números y fechas. No cambia tus palabras.",

    andThen: "Y además:",
    modeNone: "Nada — solo entregar el texto",
    modeTranslate: "Traducir a otro idioma",
    modeCustom: "Seguir una instrucción mía",
    translateTo: "Traducir a",
    translateHint: "La tecla pasa a mostrar la sigla del idioma en la esquina.",
    styleLabel: "Tu instrucción",
    stylePh: "Ej.: Reescribe como correo formal. / Resume en viñetas. / Hazlo más directo.",

    seePrompt: "Ver lo que se enviará",
    hidePrompt: "Ocultar",
    promptTitle: "Texto exacto enviado a OpenAI",
    promptStep1: "Paso 1 — prompt de transcripción",
    promptStep2: "Paso 2 — instrucciones de escritura",
    promptEmpty: "(vacío — no se envía nada en este campo)",
    promptOff: "(paso desactivado)",
    promptDropped: "términos cortados por el límite de 224 tokens:",

    captureMode: "Modo",
    modeToggle: "Toggle — pulsa para grabar, pulsa para parar",
    modePtt: "Mantener — graba mientras pulsas",
    captureHint: "En modo toggle, mantener la tecla durante la grabación cancela sin gastar API.",
    silenceStop: "Parar solo tras el silencio",
    silenceSecs: "Silencio (s)",
    silenceHint:
      "Solo se arma después de que empieces a hablar. " +
      "Predeterminado 10 s; de 2,5 a 30 s. Ignorado en modo Mantener.",
    maxMin: "Límite (min)",
    maxHint: "Corte automático. 0 lo desactiva. El techo de la API son 25 MB, unos 70 minutos.",
    beep: "Bip al iniciar y parar",
    beepHint: "El bip inicial suena cuando el micrófono ya está capturando — es tu señal de “habla”.",

    shortcut: "Atajo de teclado",
    shortcutPh: "sin atajo",
    shortcutHint: "Apodo que identifica esta tecla en un atajo de teclado. En blanco, la tecla no puede activarse desde fuera — que es la posición segura.",
    shortcutUrlLabel: "Dirección",
    shortcutHow: "Pega la dirección en PowerToys → Administrador de teclado → Reasignar un atajo → acción “Abrir URI”. Dentro de los programas que definas como destino, el atajo graba y detiene esta tecla aunque esté en otra pantalla.",
    shortcutReady: "Listo: el atajo activa esta tecla como “{alias}”.",
    shortcutTaken: "Ese apodo ya es de la tecla “{key}”. Vale la primera; cámbialo aquí para no tener dos.",
    shortcutCopied: "Dirección copiada.",
    shortcutCopyFail: "No pude copiar — selecciona el texto y pulsa Ctrl+C.",
    copy: "Copiar",

    spokenLang: "Voy a hablar en",
    spokenHint: "Indicar el idioma mejora la precisión y la velocidad — lo dice la propia OpenAI. Deja Detectar solo si realmente cambias de idioma.",
    mixedHint: "Habla mezclada: palabras sueltas de otro idioma (deploy, commit, workshop) salen bien aunque fijes un idioma — el idioma es una pista, no un filtro. Para asegurar su grafía, añádelas al diccionario de palabras canónicas.",
    context: "Contexto para el modelo de audio",
    contextPh: "Ej.: Reunión técnica sobre infraestructura de red. Habla rápida, nombres de servidores.",
    contextHint:
      "Ayuda al modelo a oír bien en vez de adivinar. Nace vacío a propósito: el contexto genérico " +
      "estorba más de lo que ayuda. Rellénalo cuando la tecla tenga un tema fijo.",
    useCanon: "Enviar también el diccionario de palabras canónicas",
    budgetOf: "de",
    budgetTokens: "tokens",
    budgetOver: "— el excedente se descartará",
    budgetHint:
      "La API descarta lo que pase de 224 tokens — y descarta el principio, así que el diccionario " +
      "se corta antes que tu contexto. La grafía correcta está garantizada por la corrección automática.",

    autoPaste: "Pegar en el campo enfocado (Ctrl+V)",
    autoPasteHint: "Si cambias de ventana mientras se procesa, el plugin copia en vez de pegar.",
    history: "Guardar historial (.md por mes)",
    folder: "Carpeta",
    folderPh: "por defecto: %LOCALAPPDATA%\\transcritranslator\\historico",
    keepAudio: "Guardar los audios grabados",
    keepAudioHint: "El audio de un envío fallido se conserva igualmente.",

    colorIdle: "Inactivo",
    colorRec: "Grabando",
    colorDone: "Listo",
    icon: "Icono",
    keyStyle: "Estilo de la tecla",
    style_neon: "Neón",
    style_aurora: "Aurora",
    style_ring: "Anillo",
    styleHint_neon: "Contorno encendido con halo de color. El que más destaca en un deck lleno.",
    styleHint_aurora: "Icono blanco sobre una neblina de color. El más discreto de los tres.",
    styleHint_ring: "Un arco de color alrededor del icono, como un medidor. Aire de instrumento.",

    icon_mic: "Micrófono",
    icon_micOff: "Micrófono silenciado",
    icon_waves: "Ondas sonoras",
    icon_headset: "Auriculares",
    icon_globe: "Globo",
    icon_translate: "Traducción",
    icon_bubble: "Bocadillo",
    icon_quote: "Comillas",
    icon_doc: "Documento",
    icon_list: "Lista",
    icon_keyboard: "Teclado",
    icon_code: "Código",
    icon_pen: "Pluma",
    icon_wand: "Varita",
    icon_bolt: "Rayo",
    icon_check: "Confirmación",
    icon_mail: "Correo",
    icon_calendar: "Calendario",
    icon_none: "Ninguno",

    showLabel: "Mostrar etiqueta",
    showTimer: "Mostrar cronómetro",
    showWave: "Mostrar las barras de voz",

    apiKey: "Clave OpenAI",
    save: "Guardar",
    keyOk: "Clave guardada en la bóveda.",
    keyMissing: "Sin clave — la tecla mostrará error.",
    keyEmpty: "Pega la clave antes de guardar.",
    keyBadFormat: "Eso no parece una clave de OpenAI — empiezan por sk-.",
    keySaving: "guardando en la bóveda…",
    keyHint:
      "Guardada cifrada con DPAPI (solo se abre en esta cuenta de Windows), nunca en la configuración " +
      "de Stream Deck, que queda en texto plano en el disco.",
    keyClear: "Quitar clave",
    canonLabel: "Palabras canónicas",
    canonPh: "SRVDRU, EdgeRouter, WireGuard, Grafana, n8n, PostgreSQL, Kubernetes",
    canonHint:
      "La grafía se corrige en el texto final por comparación exacta — sin límite y sin coste. " +
      "Los términos en MAYÚSCULAS se tratan como siglas.",
    ffmpeg: "ffmpeg",
    ffmpegPh: "vacío = buscar en el PATH",
    saved: "guardado",

    langSection: "Idiomas",
    langUi: "Panel",
    langContent: "Presets y prompts",
    langUiTitle: "Idioma del panel",
    langContentAuto: "Sigue el idioma hablado de la tecla",
    langFollowApp: "Default",
    langHint:
      "Son cosas distintas: el panel es lo que TÚ lees; los presets y prompts son lo que lee la IA. " +
      "Puedes tener Stream Deck en inglés y trabajar en otro idioma. " +
      "En Panel, Default significa seguir el idioma de la app Stream Deck.",

    dictOpen: "Abrir diccionario",
    dictTerms: "términos",
    dictNone: "vacío",
    dictTitle: "Diccionario de palabras canónicas",
    dictIntro:
      "Tus siglas, nombres de producto y términos técnicos. Tras cada etapa el plugin corrige su " +
      "grafía en el texto por comparación exacta — sin límite, sin coste y sin que la IA pueda " +
      "inventar un término que no dijiste.",
    dictFooter: "Un término por coma o por línea. Las MAYÚSCULAS se tratan como siglas.",
    close: "Cerrar",

    noKeyTitle: "Falta la clave de OpenAI",
    noKeyBody: "Sin ella, la tecla muestra un error al pulsarla. Se resuelve en dos minutos.",
    noKeyHow: "¿Cómo consigo una clave?",
    helpTitle: "Cómo obtener una clave de OpenAI",
    helpStep1: "Crea una cuenta (o entra) en platform.openai.com.",
    helpStep2:
      "Añade crédito en Billing. La API es de prepago y va aparte de la suscripción de ChatGPT — " +
      "tener ChatGPT Plus NO da acceso a la API.",
    helpStep3: "Ve a API keys y pulsa “Create new secret key”.",
    helpStep4: "Copia la clave (empieza por sk- y solo se muestra una vez) y pégala en el campo de aquí abajo.",
    helpCost:
      "Coste aproximado: unos US$ 0,003 por minuto de audio, más unos céntimos por cada mil palabras " +
      "reescritas. Un día entero de dictado suele costar menos que un café.",
    helpSafety:
      "La clave queda cifrada con DPAPI en esta cuenta de Windows. No llega a la configuración de " +
      "Stream Deck ni a ningún sitio salvo la propia OpenAI.",
    openPlatform: "Abrir platform.openai.com",
    openKeys: "Página de claves",
    openBilling: "Billing",
    openPricing: "Precios",

    presetDesc_raw:
      "Crudo, tal como salió de tu boca. No pasa por una segunda llamada, así que es lo más rápido y " +
      "lo más barato — bueno para una nota suelta, una lista de compras, una idea que no quieres perder.",
    presetDesc_clean:
      "El pan de cada día del dictado. Sale listo para pegar: puntuado, sin muletillas, con números y " +
      "fechas en el formato correcto. Arregla la escritura, no el contenido — las palabras siguen siendo tuyas.",
    presetDesc_en:
      "Hablas y aterriza en inglés, directo en el campo. Limpia antes de traducir, así que la traducción " +
      "parte de un texto ya ordenado. La tecla muestra EN en la esquina.",
    presetDesc_es:
      "Hablas y aterriza en español, directo en el campo. Limpia antes de traducir, así que la traducción " +
      "parte de un texto ya ordenado. La tecla muestra ES en la esquina.",
    presetDesc_pt:
      "Hablas en cualquier idioma y aterriza en portugués. Útil para captar un pasaje extranjero y tener " +
      "el texto en tu lengua.",
    presetDesc_email:
      "Para cuando quieres mandar el correo sin escribir el correo. Dices el recado como salga y vuelve " +
      "con saludo, cuerpo directo y despedida. No inventa destinatario, plazo ni asunto que no dijiste.",
    presetDesc_topics:
      "Pensaste en voz alta y volvió ordenado. Cada idea es un ítem, en el orden en que hablaste. " +
      "Bueno para actas, agendas y listas de tareas.",
    presetDesc_rewrite:
      "La tecla que no graba nada. Selecciona cualquier texto en pantalla, púlsala, y vuelve corregido " +
      "encima — ortografía, acentos y puntuación. Hecho para lo que escribiste con prisa.",
    presetCustom:
      "Un molde que guardaste. El resumen de abajo muestra exactamente lo que aplica cuando pulsas Aplicar.",

    detailTitle: "Qué configura este preset",
    detailListen: "Escuchar",
    detailWrite: "Escribir",
    detailOn: "activado",
    detailOff: "desactivado",
    detailCleanup: "Limpieza del dictado",
    detailStyle: "Instrucción",
    detailTranslate: "Traducir a",
    detailNothing: "nada más que entregar el texto",
    detailKeyLabel: "Etiqueta de la tecla",

    uiAuto: "Automático",
    aboutMe: "hecho por Felipe Drummond",
  },
};
