# design/

Gitignored. Source art + drafts + screenshots. Keep out of build.

## Structure

- `source/` — originais de alta resolução usados para derivar `public/` assets.
  - `Logo Quic Festival Branco.png` → exportado como `public/logo.png`
  - `Apenas Detalhes.png` (scenery) → `public/scenery.png`
  - `Apenas Texto com Datas.png` → `public/datas.png`
- `drafts/` — rascunhos (capa, mockups antigos). Não usar em produção.
- `screenshots/` — capturas de ecrã de referência/QA.

## Regenerar public/

Se atualizares `source/`, copia/exporta para `public/` com o mesmo nome:

```bash
cp "design/source/Logo Quic Festival Branco.png" public/logo.png
cp "design/source/Apenas Detalhes.png"           public/scenery.png
cp "design/source/Apenas Texto com Datas.png"    public/datas.png
```

Mockup standalone (`/mockup/index.html`) tem cópias locais próprias.
