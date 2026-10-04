*Idioma: **Português** · [English](CONTRIBUTING.md)*

# Como contribuir

Pull requests são bem-vindos. Esta página é a versão curta; a longa — arquitetura, armadilhas e
as decisões que não devem ser revertidas — está no [CLAUDE.pt-BR.md](CLAUDE.pt-BR.md), e vale
ler antes de mexer em `recorder.ts`, `openai.ts` ou `canon.ts`.

## Colocando para rodar

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

Você precisa de Windows, do app Stream Deck 7.1+, do ffmpeg no PATH e do Node 24+. A chave da
OpenAI só é necessária para exercitar o caminho de rede; todo o resto roda sem ela.

## O ciclo de trabalho

```powershell
npm run check     # tipos
npm run test      # 240 asserções, sem Stream Deck, sem rede, sem microfone
npm run build
streamdeck restart com.felipe.transcritranslator
```

Mexeu em `recorder.ts`, rode `npm run mic` também — é o único teste que exercita o comando real
do ffmpeg, e precisa de microfone. Mexeu na interface, rode `npm run shots` para as imagens do
README pararem de estar desatualizadas.

## Quatro regras que não são negociáveis

**1. Toda alteração sobe a versão.** O [version.json](version.json) é a fonte única; o build
sincroniza o manifest a partir dele. Último dígito em correção pequena, terceiro em mudança de
comportamento, segundo em recurso novo, primeiro em virada grande. Atualize a `date` junto.

**2. Todo texto que o usuário vê existe em três idiomas.** O plugin é para a loja da Elgato,
então não existe "só em português". Rótulo do painel vai em `ui/i18n.js`, regra de prompt em
`src/lib/prompt-text.ts`, nome de preset em `src/lib/preset-text.ts`, palavra na tecla em
`src/lib/key-text.ts` — sempre nos blocos `pt`, `en` e `es` do mesmo arquivo. O `npm run test`
reprova se o painel pedir uma chave que falta em algum idioma.

**3. A documentação é bilíngue.** O arquivo em inglês é o canônico e o em português fica ao lado
com o sufixo `.pt-BR`. Os dois mudam no mesmo commit. Um `.pt-BR` atrasado é pior que tradução
nenhuma, porque parece atual.

**4. Código, comentário e mensagem de commit vão em inglês.** Identificadores também. A exceção é
o *conteúdo* em português — prompts, strings de interface —, que mantém a acentuação completa:
`Configurações`, nunca `Configuracoes`. Mojibake na tela (`Ã§`, `Ã£`) é bug de encoding;
corrija o encoding, não apague o acento.

## Antes de abrir um pull request

- `npm run check` e `npm run test` passando.
- A mudança foi vista numa tecla física, ou você diz com todas as letras que não conseguiu
  testar lá. Build passando não prova que a waveform mexe.
- Se você mexeu em algo listado em *Decisões que não devem ser revertidas*
  ([CLAUDE.pt-BR.md](CLAUDE.pt-BR.md)), explique o porquê no pull request. Cada uma delas custou
  uma medição ou um bug em produção, então a régua é uma medição nova, não uma preferência.

## Relatando um bug

Abra uma issue com o que você fez, o que esperava e o que aconteceu. Para qualquer coisa que
envolva o comportamento do plugin, o log vale ouro:

```
%APPDATA%\Elgato\StreamDeck\logs\StreamDeck.log
```

Procure por `com.felipe.transcritranslator`. Limpe o que você ditou antes de colar — o log não
carrega transcrição, mas a sua descrição do bug pode carregar.

Problema de segurança não vai em issue: veja o [SECURITY.pt-BR.md](SECURITY.pt-BR.md).
