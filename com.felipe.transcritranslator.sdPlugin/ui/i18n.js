// Textos da interface, em três idiomas.
//
// O idioma segue o do app Stream Deck (vem em `inInfo.application.language`) e pode
// ser trocado à mão no topo do painel. Chave ausente cai para o português.

window.TT_I18N = {
  pt: {
    _name: "Português",

    modeSimple: "Simples",
    modeAdvanced: "Avançado",
    modeHint: "O modo Simples mostra só o essencial. O Avançado abre todos os ajustes.",

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
    labelPh: "Ditado",
    mic: "Microfone",
    micDefault: "Padrão do sistema (primeiro da lista)",
    test: "Testar",
    testing: "gravando 3 segundos — fale alguma coisa…",

    // pipeline
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
    promptEmpty: "(vazio)",
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
      "Ignorado no modo Segurar.",
    maxMin: "Limite (min)",
    maxHint: "Corte automático. 0 desliga. O teto da API são 25 MB, cerca de 70 minutos.",
    beep: "Bip ao iniciar e parar",
    beepHint: "O bip de início toca quando o microfone está de fato capturando — é o sinal de “pode falar”.",

    spokenLang: "Idioma falado",
    context: "Contexto para o modelo de áudio",
    contextPh: "Ex.: Reunião técnica sobre infraestrutura de rede.",
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
    iconMic: "Microfone",
    iconGlobe: "Globo",
    iconBubble: "Balão de fala",
    iconPen: "Caneta",
    iconNone: "Nenhum",
    showLabel: "Mostrar rótulo",
    showTimer: "Mostrar cronômetro",
    showWave: "Mostrar as barras de voz",

    apiKey: "Chave OpenAI",
    save: "Salvar",
    keyOk: "Chave configurada no cofre.",
    keyMissing: "Nenhuma chave — a tecla vai mostrar erro.",
    keyHint:
      "Guardada cifrada por DPAPI (só abre nesta conta do Windows), nunca nas configurações do " +
      "Stream Deck, que ficam em texto plano no disco.",
    keyClear: "Remover chave",
    canonLabel: "Palavras canônicas — suas siglas e termos, separados por vírgula",
    canonPh: "Ex.: SRVDRU, EdgeRouter, WireGuard, Grafana, n8n",
    canonHint:
      "A grafia é corrigida no texto final por comparação exata — sem limite de quantidade e " +
      "sem custo. Termos em MAIÚSCULAS são tratados como siglas.",
    ffmpeg: "ffmpeg",
    ffmpegPh: "vazio = procura no PATH",
    saved: "salvo",
    uiLang: "Idioma do painel",
    uiAuto: "Automático",
  },

  en: {
    _name: "English",

    modeSimple: "Simple",
    modeAdvanced: "Advanced",
    modeHint: "Simple shows only the essentials. Advanced opens every setting.",

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
    labelPh: "Dictate",
    mic: "Microphone",
    micDefault: "System default (first in the list)",
    test: "Test",
    testing: "recording 3 seconds — say something…",

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
      "These are two different models because they are two different jobs: one listens to " +
      "audio, the other writes. Translation belongs to the second — the first only transcribes " +
      "what was said, in the language it was said.",

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
    promptEmpty: "(empty)",
    promptOff: "(step disabled)",
    promptDropped: "terms cut by the 224-token limit:",

    captureMode: "Mode",
    modeToggle: "Toggle — press to start, press to stop",
    modePtt: "Hold — records while pressed",
    captureHint: "In toggle mode, holding the key while recording cancels without spending API.",
    silenceStop: "Stop by itself after silence",
    silenceSecs: "Silence (s)",
    silenceHint: "Only arms after you start speaking — the initial pause ends nothing. Ignored in Hold mode.",
    maxMin: "Limit (min)",
    maxHint: "Automatic cutoff. 0 disables it. The API ceiling is 25 MB, about 70 minutes.",
    beep: "Beep on start and stop",
    beepHint: "The start beep fires when the microphone is actually capturing — that is your “speak now”.",

    spokenLang: "Spoken language",
    context: "Context for the audio model",
    contextPh: "E.g. Technical meeting about network infrastructure.",
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
    iconMic: "Microphone",
    iconGlobe: "Globe",
    iconBubble: "Speech bubble",
    iconPen: "Pen",
    iconNone: "None",
    showLabel: "Show label",
    showTimer: "Show timer",
    showWave: "Show voice bars",

    apiKey: "OpenAI key",
    save: "Save",
    keyOk: "Key stored in the vault.",
    keyMissing: "No key — the key will show an error.",
    keyHint:
      "Stored encrypted with DPAPI (only opens under this Windows account), never in the Stream Deck " +
      "settings, which sit in plain text on disk.",
    keyClear: "Remove key",
    canonLabel: "Canonical words — your acronyms and terms, comma separated",
    canonPh: "E.g. SRVDRU, EdgeRouter, WireGuard, Grafana, n8n",
    canonHint:
      "Spelling is fixed in the final text by exact comparison — no size limit and no cost. " +
      "UPPERCASE terms are treated as acronyms.",
    ffmpeg: "ffmpeg",
    ffmpegPh: "empty = look it up in PATH",
    saved: "saved",
    uiLang: "Panel language",
    uiAuto: "Automatic",
  },

  es: {
    _name: "Español",

    modeSimple: "Simple",
    modeAdvanced: "Avanzado",
    modeHint: "El modo Simple muestra solo lo esencial. El Avanzado abre todos los ajustes.",

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
    labelPh: "Dictado",
    mic: "Micrófono",
    micDefault: "Predeterminado del sistema (el primero de la lista)",
    test: "Probar",
    testing: "grabando 3 segundos — di algo…",

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
    promptEmpty: "(vacío)",
    promptOff: "(paso desactivado)",
    promptDropped: "términos cortados por el límite de 224 tokens:",

    captureMode: "Modo",
    modeToggle: "Toggle — pulsa para grabar, pulsa para parar",
    modePtt: "Mantener — graba mientras pulsas",
    captureHint: "En modo toggle, mantener la tecla durante la grabación cancela sin gastar API.",
    silenceStop: "Parar solo tras el silencio",
    silenceSecs: "Silencio (s)",
    silenceHint: "Solo se arma después de que empieces a hablar. Ignorado en modo Mantener.",
    maxMin: "Límite (min)",
    maxHint: "Corte automático. 0 lo desactiva. El techo de la API son 25 MB, unos 70 minutos.",
    beep: "Bip al iniciar y parar",
    beepHint: "El bip inicial suena cuando el micrófono ya está capturando — es tu señal de “habla”.",

    spokenLang: "Idioma hablado",
    context: "Contexto para el modelo de audio",
    contextPh: "Ej.: Reunión técnica sobre infraestructura de red.",
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
    iconMic: "Micrófono",
    iconGlobe: "Globo",
    iconBubble: "Bocadillo",
    iconPen: "Pluma",
    iconNone: "Ninguno",
    showLabel: "Mostrar etiqueta",
    showTimer: "Mostrar cronómetro",
    showWave: "Mostrar las barras de voz",

    apiKey: "Clave OpenAI",
    save: "Guardar",
    keyOk: "Clave guardada en la bóveda.",
    keyMissing: "Sin clave — la tecla mostrará error.",
    keyHint:
      "Guardada cifrada con DPAPI (solo se abre en esta cuenta de Windows), nunca en la configuración " +
      "del Stream Deck, que queda en texto plano en el disco.",
    keyClear: "Quitar clave",
    canonLabel: "Palabras canónicas — tus siglas y términos, separados por comas",
    canonPh: "Ej.: SRVDRU, EdgeRouter, WireGuard, Grafana, n8n",
    canonHint:
      "La grafía se corrige en el texto final por comparación exacta — sin límite y sin coste. " +
      "Los términos en MAYÚSCULAS se tratan como siglas.",
    ffmpeg: "ffmpeg",
    ffmpegPh: "vacío = buscar en el PATH",
    saved: "guardado",
    uiLang: "Idioma del panel",
    uiAuto: "Automático",
  },
};
