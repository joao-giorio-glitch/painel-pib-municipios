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
const outputDir = path.join(frontendDir, "public", "data");

const MAX_OBSERVED_YEAR = 2023;
const PROJECTION_START_YEAR = 2024;
const SC_CODE = "42";
const IBGE_SC_MUNICIPIOS_URL =
  "https://servicodados.ibge.gov.br/api/v3/malhas/estados/42?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio";

const files = {
  municipios: path.join(processedDir, "PIB municipios long.xlsx"),
  mesos: path.join(processedDir, "PIB mesos long.xlsx"),
  geoMunicipios: path.join(outputDir, "sc-municipios.geojson"),
  geoMesos: path.join(outputDir, "sc-mesorregioes.geojson"),
  pib: path.join(outputDir, "pib.json")
};

const MESOREGION_OVERRIDES_BY_CODE = new Map([
  ["421935", "Vale do Itajai"],
  ["421690", "Oeste Catarinense"]
]);

function getValue(row, key) {
  if (Object.hasOwn(row, key)) {
    return row[key];
  }

  const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const foundKey = Object.keys(row).find(
    (candidate) => candidate.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedKey
  );
  return foundKey ? row[foundKey] : null;
}

function parseDate(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}

function readMunicipios(filePath) {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  return xlsx.utils.sheet_to_json(firstSheet, { defval: null }).map((row) => {
    const date = parseDate(getValue(row, "Data de Referência"));
    const code = String(getValue(row, "Cód. Munic") ?? "").replace(/\D/g, "");
    const municipio = getValue(row, "Município");
    const mesoregion = MESOREGION_OVERRIDES_BY_CODE.get(code) ?? getValue(row, "Mesorregião");

    return {
      date,
      year: Number(date.slice(0, 4)),
      code,
      municipio: municipio === "-" ? "Santa Catarina" : municipio,
      isStateTotal: municipio === "-",
      mesoregion,
      vp: getValue(row, "VPs"),
      type: getValue(row, "Tipo PIB"),
      pib: Number(getValue(row, "PIB") ?? 0)
    };
  });
}

function aggregateMesosFromMunicipios(municipios) {
  const grouped = new Map();

  municipios
    .filter((row) => !row.isStateTotal)
    .forEach((row) => {
      const key = `${row.mesoregion}|${row.year}`;
      const current = grouped.get(key) ?? {
        date: row.date,
        year: row.year,
        mesoregion: row.mesoregion,
        type: row.type,
        pib: 0
      };

      current.pib += row.pib;
      grouped.set(key, current);
    });

  return [...grouped.values()].sort(
    (a, b) => String(a.mesoregion).localeCompare(String(b.mesoregion), "pt-BR") || a.year - b.year
  );
}

function readMesos(filePath) {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  return xlsx.utils.sheet_to_json(firstSheet, { defval: null }).map((row) => {
    const date = parseDate(getValue(row, "Data de Referência"));

    return {
      date,
      year: Number(date.slice(0, 4)),
      mesoregion: getValue(row, "Mesos"),
      type: getValue(row, "Tipo PIB"),
      pib: Number(getValue(row, "PIB") ?? 0)
    };
  });
}

function uniqueSorted(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "pt-BR")
  );
}

function indexByUnitYear(rows, unitKey) {
  const map = new Map();
  rows.forEach((row) => {
    map.set(`${row[unitKey]}|${row.year}`, row);
  });
  return map;
}

function addProjectionMetrics(rows, unitKey) {
  const byUnitYear = indexByUnitYear(rows, unitKey);
  const units = uniqueSorted(rows, unitKey);

  const summary = units.map((unit) => {
    const base = byUnitYear.get(`${unit}|${MAX_OBSERVED_YEAR}`);
    const final = byUnitYear.get(`${unit}|${Math.max(...rows.map((row) => row.year))}`);

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
  });

  return { summary };
}

async function downloadJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erro ao baixar ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
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
        const code7 = String(feature.properties.codarea);
        const code = code7.slice(0, 6);
        const metadata = metadataByCode.get(code);

        if (!metadata) {
          return null;
        }

        return {
          ...feature,
          properties: {
            ...feature.properties,
            id: code,
            name: metadata.municipio,
            code,
            mesoregion: metadata.mesoregion,
            vp: metadata.vp
          }
        };
      })
      .filter(Boolean)
  };
}

function buildMesoGeoJson(municipalityGeoJson) {
  const dissolved = dissolve(municipalityGeoJson, { propertyName: "mesoregion" });
  const byMeso = new Map();

  dissolved.features.forEach((feature) => {
    const mesoregion = feature.properties.mesoregion;
    const polygons =
      feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;

    if (!byMeso.has(mesoregion)) {
      byMeso.set(mesoregion, []);
    }

    byMeso.get(mesoregion).push(...polygons);
  });

  return {
    type: "FeatureCollection",
    features: [...byMeso.entries()].map(([mesoregion, coordinates]) => ({
      type: "Feature",
      properties: {
        mesoregion,
        name: mesoregion
      },
      geometry: {
        type: "MultiPolygon",
        coordinates
      }
    }))
  };
}

function buildMetadata(municipios, mesos) {
  const years = [...new Set([...municipios, ...mesos].map((row) => row.year))].sort((a, b) => a - b);
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
    mesoregions: uniqueSorted(municipios, "mesoregion").filter((value) => value !== "-"),
    vps: uniqueSorted(municipios, "vp").filter((value) => value !== "-")
  };
}

fs.mkdirSync(outputDir, { recursive: true });

const municipios = readMunicipios(files.municipios);
const mesos = aggregateMesosFromMunicipios(municipios);
const scByYear = new Map(municipios.filter((row) => row.isStateTotal).map((row) => [row.year, row]));

const municipalityMetrics = addProjectionMetrics(
  municipios.filter((row) => !row.isStateTotal),
  "municipio"
);
const mesoregionMetrics = addProjectionMetrics(mesos, "mesoregion");

const rawMunicipalityGeoJson = await downloadJson(IBGE_SC_MUNICIPIOS_URL);
const municipalityGeoJson = buildMunicipalityGeoJson(rawMunicipalityGeoJson, municipios);
const mesoGeoJson = buildMesoGeoJson(municipalityGeoJson);

const payload = {
  metadata: buildMetadata(municipios, mesos),
  municipios,
  mesos,
  sc: [...scByYear.values()].sort((a, b) => a.year - b.year),
  metrics: {
    municipios: municipalityMetrics,
    mesoregions: mesoregionMetrics
  }
};

fs.writeFileSync(files.pib, JSON.stringify(payload));
fs.writeFileSync(files.geoMunicipios, JSON.stringify(municipalityGeoJson));
fs.writeFileSync(files.geoMesos, JSON.stringify(mesoGeoJson));

console.log(`Arquivo salvo: ${files.pib}`);
console.log(`GeoJSON municipios: ${files.geoMunicipios}`);
console.log(`GeoJSON mesorregioes: ${files.geoMesos}`);
console.log(`Municipios: ${municipios.length} registros`);
console.log(`Mesos: ${mesos.length} registros`);
