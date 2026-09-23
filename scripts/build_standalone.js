// Empacota site/index.html + style.css + app.js + data.json em um único
// arquivo HTML autônomo (dist/dashboard.html), que pode ser aberto direto
// com duplo-clique, sem servidor (o fetch() do data.json é substituído por
// uma variável global embutida).
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', 'site');
const DIST = path.join(__dirname, '..', 'dist');
const OUT = path.join(DIST, 'dashboard.html');

function main() {
  const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(SITE, 'style.css'), 'utf8');
  const js = fs.readFileSync(path.join(SITE, 'app.js'), 'utf8');
  const data = fs.readFileSync(path.join(SITE, 'data.json'), 'utf8');

  // A logo já vai inline como <svg> dentro do index.html (não depende de
  // arquivo externo), então não precisa de nenhum tratamento aqui.
  const out = html
    .replace('<link rel="stylesheet" href="style.css" />', `<style>\n${css}\n</style>`)
    .replace(
      '<script src="app.js"></script>',
      `<script>window.__DASHBOARD_DATA__ = ${data};</script>\n<script>\n${js}\n</script>`
    );

  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(OUT, out);
  console.log('Arquivo autônomo gerado em', OUT);
}

main();
