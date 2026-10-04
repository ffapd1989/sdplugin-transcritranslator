*Idioma: **Português** · [English](PRIVACY.md)*

# Privacidade

Este plugin não tem backend. Não há conta, não há telemetria, não há analytics e não há servidor
deste projeto. A única coisa com que ele conversa é a **OpenAI, com a sua própria chave de API**
— e, só se você apertar *Instalar agora*, o winget, para buscar o ffmpeg.

## O que é enviado, e quando

Nada é enviado até você apertar uma tecla. Quando aperta:

| Etapa | O que sai | Para |
|---|---|---|
| 1 — Ouvir | o áudio gravado, em MP3; o idioma falado; o prompt de transcrição (o seu dicionário e o seu campo *Contexto*, se você preencheu) | `api.openai.com/v1/audio/transcriptions` |
| 2 — Escrever | o texto transcrito, mais as instruções que você pode ler em *Ver o que será enviado* | `api.openai.com/v1/chat/completions` |

A etapa 2 só acontece se você ligou. Uma tecla de ditado cru faz exatamente uma chamada. Uma
tecla com a gravação desligada faz só a segunda chamada, e a entrada dela é o que estiver
selecionado ou no clipboard — vale lembrar antes de apertá-la em cima de algo sensível.

Áudio com menos de 0,8 s, ou sem fala, **não é enviado**. Nada mais é: o plugin não liga para
casa ao iniciar, não checa atualização e não reporta uso.

O que a OpenAI faz com o que recebe é entre você e ela, sob os termos da conta cuja chave você
configurou. Na data em que isto foi escrito, o tráfego de API não é usado para treinar os
modelos deles por padrão — mas essa política é deles para declarar e mudar, não nossa. Leia por
conta própria.

## Instalando o ffmpeg

O plugin grava pelo ffmpeg, que ele não embute. Se o ffmpeg faltar, o botão **Instalar agora** do
painel roda o winget — o instalador que já vem no Windows — para um pacote fixo,
`Gyan.FFmpeg.Essentials`. O winget o baixa da própria fonte, sob os termos dele e da Microsoft;
nada seu vai nesse pedido. Só acontece quando você aperta o botão. Encontrar um ffmpeg que já
está instalado lê o seu PATH e não usa a rede.

## O que fica na sua máquina

| Caminho | O quê | Por quanto tempo |
|---|---|---|
| `%LOCALAPPDATA%\transcritranslator\openai-key.xml` | sua chave de API, cifrada com o DPAPI do Windows | até você apagá-la pelo painel |
| `…\historico\AAAA-MM.md` | uma entrada por ditado: a transcrição crua, o texto final, os modelos usados e a duração | para sempre, a menos que você apague — dá para desligar o histórico no painel |
| `…\audio\` | os arquivos MP3 | só se você marcar *guardar áudio*; caso contrário são apagados logo após a entrega |
| `…\audio\falhou\` | áudio cujo envio falhou | guardado **mesmo com *guardar áudio* desligado**, para um erro de rede não custar a gravação. Ninguém apaga esses além de você |
| `…\presets.json` | os moldes que você salvou | até você apagar |
| `…\atalhos.json` | apelido → tecla, para o atalho de teclado, incluindo uma cópia das configurações dessas teclas | reconstruído conforme as teclas aparecem |

O clipboard é usado para entregar o texto, então o que você dita passa por ele e fica lá até
outra coisa substituir.

## Apagando tudo

Feche o app do Stream Deck e apague `%LOCALAPPDATA%\transcritranslator`. Isso leva junto a
chave, o histórico, os áudios, os presets e o índice de atalhos. As configurações por tecla
moram com o perfil do Stream Deck, em `%APPDATA%\Elgato`, e somem quando você apaga as teclas.

Revogar a chave de API em si é na OpenAI, não aqui.
