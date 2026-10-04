*Idioma: **Português** · [English](SECURITY.md)*

# Segurança

## Relatando uma vulnerabilidade

Por favor, **não** abra uma issue pública. Use o relato privado do GitHub neste repositório —
*Security* → *Report a vulnerability* —, que chega ao mantenedor sem o relato virar público
antes.

Diga o que o atacante consegue e como você chegou lá. Uma prova de conceito ajuda; um stack
trace e a versão do plugin (rodapé do painel) ajudam mais. Espere resposta em alguns dias: é um
projeto de uma pessoa só, então não há plantão, mas vulnerabilidade de verdade passa na frente
de qualquer coisa do roadmap.

Só a última versão é suportada. Se a correção importa para você, rode a partir da `main`.

## O que o plugin faz com os seus segredos

**A chave da OpenAI é cifrada com o DPAPI do Windows**, em
`%LOCALAPPDATA%\transcritranslator\openai-key.xml`. Ela só abre na conta do Windows que salvou,
naquela máquina — copiar o arquivo para outro lugar não rende nada. Ela deliberadamente **não**
fica nas configurações do Stream Deck, que viram um `.json` em texto plano em `%APPDATA%\Elgato`
que qualquer processo seu consegue ler.

A chave viaja para o PowerShell pelo **stdin**, nunca por linha de comando, então não aparece em
lista de processos. Em memória, fica em cache enquanto o processo do plugin viver. Uma variável
de ambiente `OPENAI_API_KEY`, se existir, tem precedência sobre o cofre.

## O que sai da sua máquina

O seu áudio e o seu texto, para a OpenAI, e nada além disso. Não há telemetria, não há analytics
e não há servidor deste projeto — ele não tem backend nenhum. Veja o
[PRIVACY.pt-BR.md](PRIVACY.pt-BR.md) para o que é enviado, quando, e o que fica em disco.

## Superfície de ataque que vale conhecer

**O endereço `streamdeck://`.** Uma tecla com apelido pode ser acionada por qualquer programa da
máquina capaz de abrir uma URL — é assim que o atalho de teclado funciona. O que um atacante
consegue é uma gravação que ele não ouve: o texto é colado na *sua* janela em foco e escrito no
seu histórico, nunca enviado para algum lugar que ele leia. Ainda assim significa gravação
inesperada e gasto de API, e é por isso que o campo do apelido nasce vazio: tecla sem apelido não
é alcançável de fora, e a exposição é um ato deliberado por tecla.

**Injeção de prompt pelo clipboard.** Na modalidade "só reescrever seleção", a entrada é o que
estiver no seu clipboard, que pode ter vindo de qualquer página da internet. O system prompt
declara que o texto do usuário é dado a transformar e nunca ordem a cumprir, e proíbe revelar as
instruções. Trate isso como mitigação, não como garantia: modelo de linguagem não é parser.

**PowerShell.** Detecção de foco, clipboard e colagem passam pelo `powershell.exe`. Todo valor
interpolado nesses scripts é escapado com aspas simples dobradas, e texto sempre viaja por
arquivo UTF-8 em vez de linha de comando — tanto para sobreviver aos acentos quanto para não
montar comando a partir de conteúdo arbitrário.

**Instalando o ffmpeg.** O *Instalar agora* do painel roda `winget install --id
Gyan.FFmpeg.Essentials`, com o id do pacote como constante: nada do que o painel envia chega a
essa linha de comando, então o botão não vira "instale qualquer coisa". A busca por um ffmpeg
já instalado lê o PATH do registro com `reg query` e roda os candidatos com `-version`, nada
mais.

**ffmpeg.** Iniciado com vetor de argumentos, nunca por shell, então nome de dispositivo com
caractere estranho não vira comando.
