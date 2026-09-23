# Dashboard de Custos — Transferências CD Mart

Site estático (HTML/CSS/JS) que lê `site/data.json`, gerado a partir da planilha:
`C:\Users\fabio.silva\Grupo Moas\Filial - Guarulhos - Logística\Público Transportes - Expedição\TRANSFERENCIAS\CONTROLE TRANSFERENCIA CD MART.xlsx`

## Estrutura
- `site/` — o site publicado no Netlify (index.html, style.css, app.js, data.json)
- `scripts/generate_data.js` — lê a planilha e regenera `site/data.json`
- `deploy.ps1` — roda o script acima e publica no Netlify
- `netlify.toml` — diz ao Netlify para publicar a pasta `site`

## Configuração inicial (uma vez só, feita por você)

1. Login no Netlify (abre o navegador):
   ```
   npx netlify login
   ```
2. Conectar esta pasta a um site do Netlify (novo ou existente):
   ```
   npx netlify init
   ```
   Escolha "Create & configure a new site" (ou "Link this directory to an existing site" se já tiver um).
   Quando perguntar o publish directory, responda `site`.

Depois disso, o arquivo `.netlify/state.json` guarda o vínculo com o site — não precisa repetir esse passo.

## Publicar manualmente
```
powershell -File deploy.ps1
```

## Atualização automática diária
Depois do passo de configuração inicial, peça para o Claude configurar a tarefa agendada do Windows
que roda `deploy.ps1` todos os dias (ex: 7h da manhã). O computador precisa estar ligado nesse horário,
já que a planilha fica numa pasta de rede só acessível por aqui.
