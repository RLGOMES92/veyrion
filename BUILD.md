# Build e validação — VEYRION OS

## Requisitos
- Node.js 22
- npm

## Instalação
```bash
npm install
```

## Validação de tipos e build de produção
```bash
npm run build
```

O script `build` executa primeiro `tsc --noEmit` e, se a verificação de TypeScript passar, executa `next build`.

## Execução local
```bash
npm run dev
```

Antes de publicar alterações, confirme que o comando `npm run build` termina sem erros. A implantação de produção deve ser conferida no painel de Deployments da Vercel.
