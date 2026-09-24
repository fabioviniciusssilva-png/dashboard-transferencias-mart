// Monta uma versao do dashboard apta para publicar como Claude Artifact:
// sem <!doctype>, <html>, <head> ou <body> (o Artifact injeta isso sozinho).
// Mantem <title> e <style> no topo, como o contrato pede.
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', 'site');
const DIST = path.join(__dirname, '..', 'dist');
const OUT = path.join(DIST, 'dashboard-artifact.html');

function main() {
  const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(SITE, 'style.css'), 'utf8');
  const js = fs.readFileSync(path.join(SITE, 'app.js'), 'utf8');
  const data = fs.readFileSync(path.join(SITE, 'data.json'), 'utf8');

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
  const title = titleMatch ? titleMatch[1] : 'Dashboard';

  const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
  let body = bodyMatch[1];
  // Remove os <script> de app.js e Chart.js do corpo - vao ser reinjetados
  // no fim, com o Chart.js carregado do allowlist de CDN do Artifact.
  body = body.replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^>]*><\/script>\s*/g, '');
  body = body.replace(/<script src="app\.js"><\/script>\s*/g, '');

  const out = `<title>${title}</title>
<style>
${css}
</style>
${body}
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<script>window.__DASHBOARD_DATA__ = ${data};</script>
<script>
${js}
</script>
`;

  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(OUT, out);
  console.log('Artifact HTML gerado em', OUT);
}

main();
