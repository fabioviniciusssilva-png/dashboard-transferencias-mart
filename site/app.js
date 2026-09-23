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

function renderKpis(data) {
  const el = document.getElementById('kpis');
  el.innerHTML = '';
  el.appendChild(kpiCard('Total de Viagens', INT.format(data.kpis.totalViagens)));
  el.appendChild(kpiCard('Custo Total de Frete', BRL.format(data.kpis.totalFrete)));
  el.appendChild(kpiCard('Custo Total de Mercadoria', BRL.format(data.kpis.totalValor)));
  el.appendChild(kpiCard('Custo Total Geral', BRL.format(data.kpis.totalGeral)));
  el.appendChild(kpiCard('Frete Médio por Viagem', BRL.format(data.kpis.freteMedioPorViagem)));
  el.appendChild(kpiCard('% Frete sobre Mercadoria', PCT(data.kpis.pctFreteSobreMercadoria)));
  el.appendChild(kpiCard('Frete por Palete Enviado', BRL.format(data.kpis.freteMedioPorPalete)));
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
    renderKpis(data);
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
