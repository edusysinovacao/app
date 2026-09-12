# Reels Editor

Editor de vídeo no navegador focado em criar Reels para o Instagram (formato
vertical 9:16, 1080×1920). Todo o processamento acontece localmente no
navegador — nada é enviado para um servidor.

## Funcionalidades

- **Upload** de vídeo (mp4, mov, webm, ...) por clique ou arrastar-e-soltar.
- **Corte (trim)** do vídeo pela timeline, com playhead e prévia sincronizada.
- **Enquadramento 9:16**: zoom e arraste do vídeo dentro do quadro vertical,
  com prévia WYSIWYG idêntica ao resultado exportado.
- **Textos**: múltiplas camadas de texto, com posição arrastável, cor, tamanho,
  negrito, alinhamento, fundo e janela de tempo (início/fim) em que aparecem.
- **Áudio**: mute/volume do som original do vídeo e adição de uma trilha
  sonora de fundo, com controle de volume e do trecho usado do arquivo.
- **Filtros**: brilho, contraste, saturação, preto-e-branco, sépia e presets
  rápidos (Vívido, P&B, Sépia, Contraste+, Suave).
- **Exportação** para MP4 1080×1920 (H.264/AAC) direto no navegador via
  [ffmpeg.wasm](https://ffmpegwasm.netlify.app/), com barra de progresso e
  download do resultado.

## Rodando localmente

```bash
npm install   # também copia o runtime do ffmpeg.wasm para public/ffmpeg-core
npm run dev
```

Abra o endereço exibido pelo Vite (por padrão http://localhost:5173).

## Build de produção

```bash
npm run build
npm run preview
```

## Como funciona a exportação

O editor usa `@ffmpeg/ffmpeg` (ffmpeg compilado para WebAssembly) rodando
inteiramente no navegador do usuário. O núcleo (`@ffmpeg/core`) é copiado de
`node_modules` para `public/ffmpeg-core` pelo script
`scripts/copy-ffmpeg-core.mjs` (executado automaticamente no `postinstall`),
para que o app funcione sem depender de um CDN externo em tempo de execução.

O corte, o enquadramento (zoom/posição), os filtros de cor e as legendas são
todos aplicados através de um `filter_complex` do ffmpeg, e a trilha de áudio
de fundo é mixada com o som original (quando não estiver mudo) via `amix`.

Uma fonte [Inter](https://rsms.me/inter/) (licença OFL, incluída em
`public/fonts`) é usada para desenhar o texto durante a exportação.

## Estrutura do código

```
src/
  components/   Componentes de UI (prévia, timeline, painéis de ferramentas)
  lib/           Utilitários de mídia e a lógica de exportação com ffmpeg
  store/         Estado global do editor (Zustand)
  types.ts       Tipos compartilhados
```
