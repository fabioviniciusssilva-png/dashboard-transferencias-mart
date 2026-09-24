const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const INT = new Intl.NumberFormat('pt-BR');
const PCT = (v) => (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
const PCT1 = (v) => (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function kpiCard(label, value) {
  const div = document.createElement('div');
  div.className = 'kpi-card';
  div.innerHTML = `<div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>`;
  return div;
}

function heroStat(label, value) {
  const div = document.createElement('div');
  div.className = 'hero-stat';
  div.innerHTML = `<div class="hero-stat-label">${label}</div><div class="hero-stat-value">${value}</div>`;
  return div;
}

function polarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx, cy, r, fromDeg, toDeg) {
  const p1 = polarPoint(cx, cy, r, fromDeg);
  const p2 = polarPoint(cx, cy, r, toDeg);
  const largeArc = Math.abs(fromDeg - toDeg) > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 0 ${p2.x} ${p2.y}`;
}

// Velocímetro de "% Frete sobre Mercadoria" - a escala é calculada a partir
// do próprio histórico de dados (maior valor diário já visto), não é um
// benchmark externo do setor.
function buildGaugeSvg(value, historicalMax) {
  const scaleMax = Math.max(historicalMax * 1.15, 0.01);
  const frac = Math.min(Math.max(value / scaleMax, 0), 1);
  const cx = 100, cy = 104, r = 82, sw = 16;

  const zoneStops = [0, 1 / 3, 2 / 3, 1].map(f => 180 - f * 180);
  const zoneColors = ['var(--good)', 'var(--warn)', 'var(--bad)'];
  const zones = zoneColors.map((color, i) =>
    `<path d="${arcPath(cx, cy, r, zoneStops[i], zoneStops[i + 1])}" stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="butt" opacity="0.85"/>`
  ).join('');

  const needleAngle = 180 - frac * 180;
  const tip = polarPoint(cx, cy, r - sw / 2 - 6, needleAngle);
  const tail = polarPoint(cx, cy, 14, needleAngle + 180);

  return `
    <svg viewBox="0 0 200 118" width="200" height="118" role="img" aria-label="Velocímetro de frete sobre mercadoria">
      ${zones}
      <line x1="${tail.x}" y1="${tail.y}" x2="${tip.x}" y2="${tip.y}" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="7" fill="var(--ink)"/>
      <text x="10" y="116" font-size="9" fill="var(--ink-soft)" font-family="var(--font-body)">0%</text>
      <text x="190" y="116" font-size="9" fill="var(--ink-soft)" font-family="var(--font-body)" text-anchor="end">${PCT1(scaleMax)}</text>
    </svg>`;
}

function renderGauge(data) {
  const el = document.getElementById('gaugeBlock');
  const value = data.kpis.pctFreteSobreMercadoria;
  const historicalMax = Math.max(...data.daily.map(d => d.pctFreteMercadoria), value, 0.01);
  el.innerHTML = `
    <div class="gauge-title">% Frete sobre Mercadoria</div>
    ${buildGaugeSvg(value, historicalMax)}
    <div class="gauge-value">${PCT(value)}</div>
    <div class="gauge-caption">Frete total dividido pelo valor total de mercadoria transferida. Escala ajustada ao maior valor diário já registrado — quanto mais à esquerda, mais eficiente.</div>
  `;
}

function trendCell(v) {
  if (v === null || v === undefined) return '<span class="trend-na">—</span>';
  const cls = v > 0 ? 'trend-up' : (v < 0 ? 'trend-down' : '');
  const arrow = v > 0 ? '▲' : (v < 0 ? '▼' : '');
  return `<span class="${cls}">${arrow} ${PCT1(v)}</span>`;
}

async function loadData() {
  if (window.__DASHBOARD_DATA__) return window.__DASHBOARD_DATA__;
  const res = await fetch('data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Não foi possível carregar data.json (' + res.status + ')');
  return res.json();
}

function renderHeroStats(data) {
  const el = document.getElementById('heroStats');
  el.innerHTML = '';
  el.appendChild(heroStat('Total de Viagens', INT.format(data.kpis.totalViagens)));
  el.appendChild(heroStat('Custo Total de Frete', BRL.format(data.kpis.totalFrete)));
  el.appendChild(heroStat('Custo Total de Mercadoria', BRL.format(data.kpis.totalValor)));
  el.appendChild(heroStat('Custo Total Geral', BRL.format(data.kpis.totalGeral)));
  el.appendChild(heroStat('Frete Médio por Viagem', BRL.format(data.kpis.freteMedioPorViagem)));
  el.appendChild(heroStat('Frete por Palete Enviado', BRL.format(data.kpis.freteMedioPorPalete)));
}

function renderDailyTable(data) {
  const tbody = document.querySelector('#tableDaily tbody');
  tbody.innerHTML = '';
  let totViagens = 0, totFrete = 0, totValor = 0, totPaletes = 0;

  data.daily.forEach(d => {
    totViagens += d.viagens; totFrete += d.frete; totValor += d.valor; totPaletes += d.paletes;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(d.date)}</td>
      <td>${INT.format(d.viagens)}</td>
      <td>${BRL.format(d.frete)}</td>
      <td>${BRL.format(d.freteMedioPorViagem)}</td>
      <td>${BRL.format(d.valor)}</td>
      <td>${BRL.format(d.custoTotal)}</td>
      <td>${PCT(d.pctFreteMercadoria)}</td>
      <td>${INT.format(d.paletes)}</td>
      <td>${BRL.format(d.custoFretePorPalete)}</td>
      <td>${trendCell(d.variacaoFreteMedio)}</td>
    `;
    tbody.appendChild(tr);
  });

  if (data.noDate && data.noDate.viagens > 0) {
    totViagens += data.noDate.viagens; totFrete += data.noDate.frete;
    totValor += data.noDate.valor; totPaletes += data.noDate.paletes;
    const tr = document.createElement('tr');
    tr.className = 'pending-row';
    const freteMedio = data.noDate.viagens ? data.noDate.frete / data.noDate.viagens : 0;
    const fretePalete = data.noDate.paletes ? data.noDate.frete / data.noDate.paletes : 0;
    const pct = data.noDate.valor ? data.noDate.frete / data.noDate.valor : 0;
    tr.innerHTML = `
      <td>Sem data registrada (pendente)</td>
      <td>${INT.format(data.noDate.viagens)}</td>
      <td>${BRL.format(data.noDate.frete)}</td>
      <td>${BRL.format(freteMedio)}</td>
      <td>${BRL.format(data.noDate.valor)}</td>
      <td>${BRL.format(data.noDate.frete + data.noDate.valor)}</td>
      <td>${PCT(pct)}</td>
      <td>${INT.format(data.noDate.paletes)}</td>
      <td>${BRL.format(fretePalete)}</td>
      <td class="trend-na">—</td>
    `;
    tbody.appendChild(tr);
  }

  const trTotal = document.createElement('tr');
  trTotal.className = 'total-row';
  const freteMedioTotal = totViagens ? totFrete / totViagens : 0;
  const fretePaleteTotal = totPaletes ? totFrete / totPaletes : 0;
  const pctTotal = totValor ? totFrete / totValor : 0;
  trTotal.innerHTML = `
    <td>TOTAL</td>
    <td>${INT.format(totViagens)}</td>
    <td>${BRL.format(totFrete)}</td>
    <td>${BRL.format(freteMedioTotal)}</td>
    <td>${BRL.format(totValor)}</td>
    <td>${BRL.format(totFrete + totValor)}</td>
    <td>${PCT(pctTotal)}</td>
    <td>${INT.format(totPaletes)}</td>
    <td>${BRL.format(fretePaleteTotal)}</td>
    <td class="trend-na">—</td>
  `;
  tbody.appendChild(trTotal);
}

function renderCarriersTable(data) {
  const tbody = document.querySelector('#tableCarriers tbody');
  tbody.innerHTML = '';
  data.carriers.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.transportadora}</td>
      <td>${INT.format(c.viagens)}</td>
      <td>${BRL.format(c.frete)}</td>
      <td>${BRL.format(c.freteMedioPorViagem)}</td>
      <td>${PCT(c.pctDoFreteTotal)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderProductsTable(data) {
  const tbody = document.querySelector('#tableProducts tbody');
  tbody.innerHTML = '';
  data.products.forEach(p => {
    const pct = data.kpis.totalValor ? p.valor / data.kpis.totalValor : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.ref}</td>
      <td style="text-align:left; white-space:normal;">${p.produto}</td>
      <td>${BRL.format(p.valor)}</td>
      <td>${PCT(pct)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCharts(data) {
  const labels = data.daily.map(d => fmtDate(d.date));

  new Chart(document.getElementById('chartDaily'), {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Nº de Viagens',
          data: data.daily.map(d => d.viagens),
          backgroundColor: '#8fa28a',
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Frete Médio / Viagem (R$)',
          data: data.daily.map(d => d.freteMedioPorViagem),
          borderColor: '#4b5d47',
          backgroundColor: '#4b5d47',
          yAxisID: 'y1',
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { position: 'left', title: { display: true, text: 'Nº de Viagens' }, beginAtZero: true },
        y1: { position: 'right', title: { display: true, text: 'Frete Médio / Viagem (R$)' }, beginAtZero: true, grid: { drawOnChartArea: false } },
      },
    },
  });

  new Chart(document.getElementById('chartPalete'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Custo de Frete por Palete (R$)',
        data: data.daily.map(d => d.custoFretePorPalete),
        backgroundColor: '#7d9a76',
      }],
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, title: { display: true, text: 'R$ / palete' } } },
    },
  });
}

async function init() {
  try {
    const data = await loadData();
    document.getElementById('lastUpdated').textContent =
      'Dados gerados em ' + new Date(data.geradoEm).toLocaleString('pt-BR');
    renderGauge(data);
    renderHeroStats(data);
    renderDailyTable(data);
    renderCarriersTable(data);
    renderProductsTable(data);
    renderCharts(data);
  } catch (err) {
    const main = document.querySelector('main.container');
    const div = document.createElement('div');
    div.className = 'error-banner';
    div.textContent = 'Erro ao carregar os dados do dashboard: ' + err.message;
    main.prepend(div);
    console.error(err);
  }
}

init();
