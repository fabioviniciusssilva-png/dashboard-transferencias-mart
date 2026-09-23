const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const TRANSFERENCIAS_DIR =
  'C:\\Users\\fabio.silva\\Grupo Moas\\Filial - Guarulhos - Logística\\Público Transportes - Expedição\\TRANSFERENCIAS';

const OUT_PATH = path.join(__dirname, '..', 'site', 'data.json');

// A equipe às vezes acaba editando uma cópia/backup em vez do arquivo
// "principal" (já aconteceu mais de uma vez), então em vez de fixar um único
// caminho, pegamos sempre o arquivo "CONTROLE TRANSFERENCIA CD MART*.xlsx"
// modificado mais recentemente na pasta — é sempre o que tem os lançamentos
// mais atuais, seja qual for o nome exato.
function resolveXlsxPath() {
  if (process.env.XLSX_PATH) return process.env.XLSX_PATH;

  const candidates = fs.readdirSync(TRANSFERENCIAS_DIR)
    .filter(f => /^CONTROLE TRANSFERENCIA CD MART.*\.xlsx$/i.test(f) && !f.startsWith('~$'))
    .map(f => {
      const full = path.join(TRANSFERENCIAS_DIR, f);
      return { full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (candidates.length === 0) {
    throw new Error(`Nenhum arquivo "CONTROLE TRANSFERENCIA CD MART*.xlsx" encontrado em ${TRANSFERENCIAS_DIR}`);
  }
  return candidates[0].full;
}

const XLSX_PATH = resolveXlsxPath();

function unwrap(v) {
  if (v && typeof v === 'object' && v.result !== undefined) return v.result;
  return v;
}

async function main() {
  console.log('Lendo (somente leitura):', XLSX_PATH);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const ws = wb.getWorksheet('RELAÇÃO DE PEDIDOS');

  const seenCarga = new Set();
  const rows = [];

  for (let r = 4; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const ref = unwrap(row.getCell(3).value);
    const prod = unwrap(row.getCell(4).value);
    const paletes = unwrap(row.getCell(10).value);
    const carga = unwrap(row.getCell(12).value);
    const dataHora = unwrap(row.getCell(15).value);
    const transp = unwrap(row.getCell(17).value);
    const frete = unwrap(row.getCell(18).value);
    const valor = unwrap(row.getCell(19).value);

    if (carga == null && dataHora == null && frete == null && valor == null) continue;

    let dateKey = null, dd, mm, yyyy;
    if (dataHora != null) {
      const datePart = String(dataHora).split(' - ')[0].trim();
      const parts = datePart.split('/').map(Number);
      if (parts.length === 3 && !parts.some(Number.isNaN)) {
        [dd, mm, yyyy] = parts;
        dateKey = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      }
    }

    // FRETE já vem rateado por linha de produto dentro da carga (a soma
    // direta da coluna bate com o total já usado na planilha original) —
    // não deduplicar. Só "viagem" (nº de cargas) conta 1x por carga.
    const cargaKey = carga != null ? String(carga) : null;
    let viagemUnica = 0;
    if (cargaKey != null && !seenCarga.has(cargaKey)) {
      seenCarga.add(cargaKey);
      viagemUnica = 1;
    }

    rows.push({
      ref, prod, carga: cargaKey, dateKey,
      transp: transp ? String(transp).trim() : null,
      frete: Number(frete) || 0,
      valor: Number(valor) || 0,
      paletes: Number(paletes) || 0,
      viagemUnica,
    });
  }

  // ---- Per day ----
  const byDay = new Map();
  for (const row of rows) {
    if (!row.dateKey) continue;
    const cur = byDay.get(row.dateKey) || { date: row.dateKey, viagens: 0, frete: 0, valor: 0, paletes: 0 };
    cur.viagens += row.viagemUnica;
    cur.frete += row.frete;
    cur.valor += row.valor;
    cur.paletes += row.paletes;
    byDay.set(row.dateKey, cur);
  }
  const daily = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  daily.forEach((d, idx) => {
    d.freteMedioPorViagem = d.viagens ? d.frete / d.viagens : 0;
    d.custoFretePorPalete = d.paletes ? d.frete / d.paletes : 0;
    d.pctFreteMercadoria = d.valor ? d.frete / d.valor : 0;
    d.custoTotal = d.frete + d.valor;
    if (idx === 0) {
      d.variacaoFreteMedio = null;
    } else {
      const prev = daily[idx - 1].freteMedioPorViagem;
      d.variacaoFreteMedio = prev ? (d.freteMedioPorViagem - prev) / prev : null;
    }
  });

  // ---- Pending (no date yet) ----
  const noDate = { viagens: 0, frete: 0, valor: 0, paletes: 0 };
  for (const row of rows) {
    if (row.dateKey) continue;
    noDate.viagens += row.viagemUnica;
    noDate.frete += row.frete;
    noDate.valor += row.valor;
    noDate.paletes += row.paletes;
  }

  // ---- Per carrier ----
  const byCarrier = new Map();
  for (const row of rows) {
    if (!row.transp) continue;
    const cur = byCarrier.get(row.transp) || { transportadora: row.transp, viagens: 0, frete: 0 };
    cur.viagens += row.viagemUnica;
    cur.frete += row.frete;
    byCarrier.set(row.transp, cur);
  }
  const carriers = [...byCarrier.values()].sort((a, b) => b.frete - a.frete);

  // ---- Per product ----
  const byProduct = new Map();
  for (const row of rows) {
    if (row.ref == null) continue;
    const key = String(row.ref);
    const cur = byProduct.get(key) || { ref: key, produto: row.prod, valor: 0 };
    cur.valor += row.valor;
    byProduct.set(key, cur);
  }
  const products = [...byProduct.values()].sort((a, b) => b.valor - a.valor).slice(0, 15);

  const totalViagens = rows.reduce((s, r) => s + r.viagemUnica, 0);
  const totalFrete = rows.reduce((s, r) => s + r.frete, 0);
  const totalValor = rows.reduce((s, r) => s + r.valor, 0);
  const totalPaletes = rows.reduce((s, r) => s + r.paletes, 0);

  carriers.forEach(c => {
    c.freteMedioPorViagem = c.viagens ? c.frete / c.viagens : 0;
    c.pctDoFreteTotal = totalFrete ? c.frete / totalFrete : 0;
  });

  const out = {
    geradoEm: new Date().toISOString(),
    kpis: {
      totalViagens,
      totalFrete,
      totalValor,
      totalGeral: totalFrete + totalValor,
      freteMedioPorViagem: totalViagens ? totalFrete / totalViagens : 0,
      pctFreteSobreMercadoria: totalValor ? totalFrete / totalValor : 0,
      freteMedioPorPalete: totalPaletes ? totalFrete / totalPaletes : 0,
    },
    daily,
    noDate,
    carriers,
    products,
    totalProdutosDistintos: byProduct.size,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log('data.json gerado em', OUT_PATH);
  console.log('Viagens:', totalViagens, '| Frete:', totalFrete.toFixed(2), '| Mercadoria:', totalValor.toFixed(2));
}

main().catch(e => { console.error('Falha ao gerar data.json:', e); process.exit(1); });
