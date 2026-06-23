import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dissolve from "@turf/dissolve";
import xlsx from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");
const projectDir = path.resolve(frontendDir, "..");
const processedDir = path.join(projectDir, "Dados", "Processado");
const rawDir = path.join(projectDir, "Dados", "Bruto");
const outputDir = path.join(frontendDir, "public", "data");

const MAX_OBSERVED_YEAR = 2023;
const PROJECTION_START_YEAR = 2024;
const SC_CODE = "42";
const IBGE_SC_MUNICIPIOS_URL =
  "https://servicodados.ibge.gov.br/api/v3/malhas/estados/42?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio";

const files = {
  municipios: path.join(processedDir, "PIB municipios long.xlsx"),
  municipalityVicePresidency: path.join(rawDir, "dim_municipio_vice_presidencia.xlsx"),
  geoMunicipios: path.join(outputDir, "sc-municipios.geojson"),
  geoVicePresidencies: path.join(outputDir, "sc-vice-presidencias.geojson"),
  pib: path.join(outputDir, "pib.json")
};

function getValue(row, key) {
  if (Object.hasOwn(row, key)) return row[key];

  const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const foundKey = Object.keys(row).find(
    (candidate) => candidate.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedKey
  );
  return foundKey ? row[foundKey] : null;
}

function parseDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeCode(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return (digits.length > 6 ? digits.slice(0, 6) : digits).padStart(6, "0");
}

function readRows(filePath, options = {}) {
  const workbook = xlsx.readFile(filePath, options);
  return xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null });
}

function readMunicipalityVicePresidencies(filePath) {
  const byCode = new Map();

  readRows(filePath).forEach((row) => {
    const code = normalizeCode(getValue(row, "cd_municipio_6d"));
    const name = getValue(row, "nm_vice_presidencia");
    if (code && name) byCode.set(code, name);
  });

  return byCode;
}

function readMunicipios(filePath, vicePresidencyByCode) {
  return readRows(filePath, { cellDates: true }).map((row) => {
    const date = parseDate(getValue(row, "Data de Referência"));
    const rawMunicipio = getValue(row, "Município");
    const isStateTotal = rawMunicipio === "-";
    const code = isStateTotal ? "" : normalizeCode(getValue(row, "Cód. Munic"));
    const vicePresidency = isStateTotal ? "Santa Catarina" : vicePresidencyByCode.get(code);

    if (!isStateTotal && !vicePresidency) {
      throw new Error(`Município sem vice-presidência na dimensão: código ${code}, nome ${rawMunicipio}`);
    }

    return {
      date,
      year: Number(date.slice(0, 4)),
      code,
      municipio: isStateTotal ? "Santa Catarina" : rawMunicipio,
      isStateTotal,
      vicePresidency,
      type: getValue(row, "Tipo PIB"),
      pib: Number(getValue(row, "PIB") ?? 0)
    };
  });
}

function aggregateVicePresidenciesFromMunicipios(municipios) {
  const grouped = new Map();

  municipios
    .filter((row) => !row.isStateTotal)
    .forEach((row) => {
      const key = `${row.vicePresidency}|${row.year}`;
      const current = grouped.get(key) ?? {
        date: row.date,
        year: row.year,
        vicePresidency: row.vicePresidency,
        type: row.type,
        pib: 0
      };

      current.pib += row.pib;
      grouped.set(key, current);
    });

  return [...grouped.values()].sort(
    (a, b) => String(a.vicePresidency).localeCompare(String(b.vicePresidency), "pt-BR") || a.year - b.year
  );
}

function uniqueSorted(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "pt-BR")
  );
}

function indexByUnitYear(rows, unitKey) {
  const map = new Map();
  rows.forEach((row) => map.set(`${row[unitKey]}|${row.year}`, row));
  return map;
}

function addProjectionMetrics(rows, unitKey) {
  const byUnitYear = indexByUnitYear(rows, unitKey);
  const units = uniqueSorted(rows, unitKey);
  const finalYear = Math.max(...rows.map((row) => row.year));

  return {
    summary: units.map((unit) => {
      const base = byUnitYear.get(`${unit}|${MAX_OBSERVED_YEAR}`);
      const final = byUnitYear.get(`${unit}|${finalYear}`);
      const cagr =
        base && final && final.year > base.year ? (final.pib / base.pib) ** (1 / (final.year - base.year)) - 1 : null;

      return {
        unit,
        baseYear: base?.year ?? null,
        finalYear: final?.year ?? null,
        basePib: base?.pib ?? null,
        finalPib: final?.pib ?? null,
        cagr,
        cagrPercent: cagr === null ? null : cagr * 100
      };
    })
  };
}

async function downloadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro ao baixar ${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

async function loadMunicipalityGeometry() {
  if (fs.existsSync(files.geoMunicipios)) {
    return JSON.parse(fs.readFileSync(files.geoMunicipios, "utf8"));
  }
  return downloadJson(IBGE_SC_MUNICIPIOS_URL);
}

function buildMunicipalityGeoJson(geoJson, municipios) {
  const metadataByCode = new Map(
    municipios
      .filter((row) => !row.isStateTotal && row.year === MAX_OBSERVED_YEAR)
      .map((row) => [row.code, row])
  );

  return {
    type: "FeatureCollection",
    features: geoJson.features
      .map((feature) => {
        const code = normalizeCode(feature.properties.code ?? feature.properties.codarea);
        const metadata = metadataByCode.get(code);
        if (!metadata) return null;

        return {
          ...feature,
          properties: {
            ...feature.properties,
            id: code,
            name: metadata.municipio,
            code,
            vicePresidency: metadata.vicePresidency
          }
        };
      })
      .filter(Boolean)
  };
}

function buildVicePresidencyGeoJson(municipalityGeoJson) {
  const dissolved = dissolve(municipalityGeoJson, { propertyName: "vicePresidency" });
  const byVicePresidency = new Map();

  dissolved.features.forEach((feature) => {
    const vicePresidency = feature.properties.vicePresidency;
    const polygons =
      feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;

    if (!byVicePresidency.has(vicePresidency)) byVicePresidency.set(vicePresidency, []);
    byVicePresidency.get(vicePresidency).push(...polygons);
  });

  return {
    type: "FeatureCollection",
    features: [...byVicePresidency.entries()].map(([vicePresidency, coordinates]) => ({
      type: "Feature",
      properties: { vicePresidency, name: vicePresidency },
      geometry: { type: "MultiPolygon", coordinates }
    }))
  };
}

function buildMetadata(municipios, vicePresidencies) {
  const years = [...new Set([...municipios, ...vicePresidencies].map((row) => row.year))].sort((a, b) => a - b);

  return {
    generatedAt: new Date().toISOString(),
    years,
    maxObservedYear: MAX_OBSERVED_YEAR,
    projectionStartYear: PROJECTION_START_YEAR,
    finalProjectionYear: Math.max(...years),
    scCode: SC_CODE,
    municipios: uniqueSorted(
      municipios.filter((row) => !row.isStateTotal),
      "municipio"
    ),
    vicePresidencies: uniqueSorted(municipios, "vicePresidency").filter((value) => value !== "Santa Catarina")
  };
}

fs.mkdirSync(outputDir, { recursive: true });

const vicePresidencyByCode = readMunicipalityVicePresidencies(files.municipalityVicePresidency);
const municipios = readMunicipios(files.municipios, vicePresidencyByCode);
const vicePresidencies = aggregateVicePresidenciesFromMunicipios(municipios);
const scByYear = new Map(municipios.filter((row) => row.isStateTotal).map((row) => [row.year, row]));

const municipalityMetrics = addProjectionMetrics(
  municipios.filter((row) => !row.isStateTotal),
  "municipio"
);
const vicePresidencyMetrics = addProjectionMetrics(vicePresidencies, "vicePresidency");

const rawMunicipalityGeoJson = await loadMunicipalityGeometry();
const municipalityGeoJson = buildMunicipalityGeoJson(rawMunicipalityGeoJson, municipios);
const vicePresidencyGeoJson = buildVicePresidencyGeoJson(municipalityGeoJson);

const payload = {
  metadata: buildMetadata(municipios, vicePresidencies),
  municipios,
  vicePresidencies,
  sc: [...scByYear.values()].sort((a, b) => a.year - b.year),
  metrics: {
    municipios: municipalityMetrics,
    vicePresidencies: vicePresidencyMetrics
  }
};

fs.writeFileSync(files.pib, JSON.stringify(payload));
fs.writeFileSync(files.geoMunicipios, JSON.stringify(municipalityGeoJson));
fs.writeFileSync(files.geoVicePresidencies, JSON.stringify(vicePresidencyGeoJson));

console.log(`Arquivo salvo: ${files.pib}`);
console.log(`GeoJSON municípios: ${files.geoMunicipios}`);
console.log(`GeoJSON vice-presidências: ${files.geoVicePresidencies}`);
console.log(`Municípios: ${municipios.length} registros`);
console.log(`Vice-presidências: ${vicePresidencies.length} registros`);
