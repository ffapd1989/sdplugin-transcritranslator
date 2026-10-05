*Idioma: **Português** · [English](LISTING.md)*

# Listagem no Marketplace

O que vai para o Maker Console, pronto para colar. A loja quer nome, descrição e mídia em
inglês; a fonte é o [LISTING.md](LISTING.md), e este arquivo é uma tradução para leitura, não
para a loja. Os blocos de texto abaixo ficam em inglês de propósito — são eles que se colam.

As imagens desta pasta são geradas pelo `npm run shots`, como as do readme — mudou a interface,
rode de novo.

## Produto

| Campo | Valor |
|---|---|
| Tipo de produto | Stream Deck → Plugin |
| Nome | TranscriTranslator |
| Preço | Gratuito |
| Ícone do app | [app-icon.png](app-icon.png) — 288×288 |
| Thumbnail | [thumbnail.png](thumbnail.png) — 1920×960 |
| Galeria | [gallery-1-dictate.png](gallery-1-dictate.png), [gallery-2-jobs.png](gallery-2-jobs.png), [gallery-3-setup.png](gallery-3-setup.png), [gallery-4-prompts.png](gallery-4-prompts.png), [gallery-5-look.png](gallery-5-look.png) — 1920×960, mais o vídeo de demonstração |
| Pacote | `npx streamdeck pack com.felipe.transcritranslator.sdPlugin` → `com.felipe.transcritranslator.streamDeckPlugin` |

## Descrição

Entre 250 e 1.500 caracteres; os primeiros 250 têm de ser texto corrido, porque viram o trecho
que aparece na busca. Cole tudo o que está dentro do bloco.

```text
Turn a Stream Deck key into a dictation microphone. Press, speak, press again: what you said is transcribed by OpenAI and pasted into the field you were typing in, cleaned up, translated into one of 28 languages, or rewritten in the tone you set for that key.

What it does
• Dictates into any app, pasting only if you are still in the same window
• Cleans up speech: punctuation, no fillers, spoken commands like "comma"
• Translates as you speak into a language picked from a list
• Rewrites with your own instruction per key: formal email, bullet points, anything
• Keeps your spelling with a dictionary (GitHub, PostgreSQL…)
• Works from a keyboard shortcut, even when the key is on another page
• Shows the exact text sent to OpenAI: no hidden prompts
• Panel in English, Portuguese and Spanish

Requirements
• Windows 10 or 11 and Stream Deck 7.1 or later
• Your own OpenAI API key, pay as you go (about US$0.003 per minute of audio)
• ffmpeg: the plugin finds it, or installs it for you with one click

Setup, all inside the panel
1. Drag Dictate onto a key and open its settings.
2. If ffmpeg is missing, click Install now. No terminal, no administrator password.
3. Paste your OpenAI API key. The panel links to where you create one, and it is stored encrypted on your PC.
4. Tap the key, speak, tap again. Every key starts as Clean dictation; pick another preset to translate or rewrite.

Open source, MIT License: https://github.com/ffapd1989/sdplugin-transcritranslator
```

Em português, para conferir o que diz: transforma uma tecla num microfone de ditado — aperta,
fala, aperta de novo, e o texto aparece no campo em que você estava, limpo, traduzido para um de
28 idiomas ou reescrito no tom definido para a tecla. Lista o que faz, os requisitos (Windows
10/11, Stream Deck 7.1+, chave própria da OpenAI, ffmpeg encontrado ou instalado com um clique),
como começar em quatro passos, e fecha dizendo que é código aberto sob a licença MIT, com o link
do repositório no GitHub.

## Tags

O vocabulário de tags só aparece dentro do Maker Console. O que escolher lá:

- **Dispositivos:** todo Stream Deck com teclas — o plugin tem uma ação de tecla e nenhum layout
  de dial ou touch strip.
- **Sistema operacional:** só Windows.
- **Tema:** produtividade, ditado, transcrição, tradução, IA, acessibilidade.

## Links adicionais

| Rótulo | URL |
|---|---|
| Source code and documentation | https://github.com/ffapd1989/sdplugin-transcritranslator |
| Privacy policy | https://github.com/ffapd1989/sdplugin-transcritranslator/blob/main/PRIVACY.md |
| Support | https://github.com/ffapd1989/sdplugin-transcritranslator/issues |
| Security | https://github.com/ffapd1989/sdplugin-transcritranslator/blob/main/SECURITY.md |

## Notas da versão — a primeira versão no Marketplace

O número da versão é o que o `version.json` disser na hora de empacotar.

```text
First Marketplace release.
• Dictate, translate into 28 languages or rewrite with your own instruction, per key
• ffmpeg is found automatically, or installed from the settings panel in one click
• Spoken language detected by default; panel in English, Portuguese and Spanish
• Three key styles and eighteen icons, with a live preview
```

## Vídeo de demonstração

A Elgato exige vídeo de plugin que depende de serviço pago ("you will be required to submit a
video demonstrating the plugin is fully functional" — página do processo de revisão). O único
lugar para vídeo no envio é um item da galeria, então ele vai lá, ao lado das cinco imagens. MP4,
1920×1080, **menos de 50 MB**: a página de envio diz 50, as diretrizes de produto dizem 250, e o
mais restrito é o que não volta.
Uma lista de cenas que cobre o que o revisor precisa ver funcionando, em uns 90 segundos:

1. Máquina limpa: arrastar **Dictate** para uma tecla, abrir o painel, aparece o aviso do
   ffmpeg, **Instalar agora**, a confirmação verde.
2. Colar a chave da OpenAI na janela de ajuda.
3. Abrir o Bloco de Notas, tocar a tecla, falar uma frase com uma autocorreção e "vírgula",
   tocar de novo — o texto limpo cai no Bloco de Notas.
4. Aplicar **Translate → Spanish**, falar, e o texto em espanhol cai.
5. Uma tecla de reescrita (e-mail formal) sobre uma frase bagunçada.
6. Segurar a tecla durante a gravação: *solte para cancelar*, nada é enviado.
7. Trocar de janela durante o envio: o texto é copiado, não colado.

Para o revisor, que lê em inglês, vale gravar com o painel em inglês.

## Antes de apertar enviar

- [ ] A organização no Maker Console está criada e o Maker Agreement assinado
- [ ] `npm run build`, `npx streamdeck validate`, `npx streamdeck pack` no commit que vai
- [ ] O primeiro envio vai com *Publish after review* desmarcado; baixar o build protegido da aba
      Versions e instalá-lo antes de publicar
- [ ] O nome não muda depois do envio sem escrever para maker@elgato.com
