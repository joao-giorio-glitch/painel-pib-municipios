import type { MesoregionData, MunicipalityData, StateData, YearValue } from "../types/economic-dashboard";
import { calculateCAGR, calculateGrowth, calculateShare } from "./economic-calculations";

type PibRow = {
  year: number;
  municipio?: string;
  mesoregion?: string;
  isStateTotal?: boolean;
  pib: number;
  type?: string;
};

type RawPibPayload = {
  metadata: {
    maxObservedYear: number;
    finalProjectionYear: number;
    mesoregions: string[];
  };
  municipios: PibRow[];
  mesos: PibRow[];
  sc: PibRow[];
};

export type DashboardDataset = {
  state: StateData;
  mesoregions: MesoregionData[];
  municipalities: MunicipalityData[];
};

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function byYear(rows: PibRow[]) {
  return [...rows].sort((a, b) => a.year - b.year);
}

function toSeries(rows: PibRow[], startYear: number, maxObservedYear: number): YearValue[] {
  const ordered = byYear(rows).filter((row) => row.year >= startYear);
  return ordered.map((row, index) => {
    const previous = ordered[index - 1];
    return {
      year: row.year,
      pib: Number(row.pib ?? 0),
      growth: previous ? calculateGrowth(Number(row.pib ?? 0), Number(previous.pib ?? 0)) : 0,
      isProjected: row.year > maxObservedYear
    };
  });
}

export function buildDashboardDataset(payload: RawPibPayload): DashboardDataset {
  const startYear = payload.metadata.maxObservedYear;
  const stateSeries = toSeries(payload.sc, startYear, payload.metadata.maxObservedYear);
  const stateByYear = new Map(stateSeries.map((row) => [row.year, row]));

  const state: StateData = {
    name: "Santa Catarina",
    pibSeries: stateSeries,
    cagr2023_2030: calculateCAGR(stateSeries[0]?.pib ?? 0, stateSeries.at(-1)?.pib ?? 0, stateSeries.length - 1)
  };

  const mesoregions: MesoregionData[] = payload.metadata.mesoregions.map((name) => {
    const pibSeries = toSeries(
      payload.mesos.filter((row) => row.mesoregion === name),
      startYear,
      payload.metadata.maxObservedYear
    );
    const stateShareByYear = Object.fromEntries(
      pibSeries.map((row) => [row.year, calculateShare(row.pib, stateByYear.get(row.year)?.pib ?? 0)])
    );

    return {
      id: slug(name),
      name,
      pibSeries,
      cagr2023_2030: calculateCAGR(pibSeries[0]?.pib ?? 0, pibSeries.at(-1)?.pib ?? 0, pibSeries.length - 1),
      stateShareByYear
    };
  });

  const mesoByName = new Map(mesoregions.map((item) => [item.name, item]));
  const mesoByYear = new Map(
    mesoregions.flatMap((meso) => meso.pibSeries.map((row) => [`${meso.id}|${row.year}`, row] as const))
  );

  const municipalityNames = [
    ...new Set(
      payload.municipios
        .filter((row) => !row.isStateTotal && row.municipio)
        .map((row) => row.municipio as string)
    )
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const municipalities: MunicipalityData[] = municipalityNames.map((name) => {
    const rows = payload.municipios.filter((row) => row.municipio === name);
    const mesoregion = mesoByName.get(rows.find((row) => row.mesoregion)?.mesoregion ?? "") ?? mesoregions[0];
    const pibSeries = toSeries(rows, startYear, payload.metadata.maxObservedYear);
    const mesoregionShareByYear = Object.fromEntries(
      pibSeries.map((row) => [row.year, calculateShare(row.pib, mesoByYear.get(`${mesoregion.id}|${row.year}`)?.pib ?? 0)])
    );
    const stateShareByYear = Object.fromEntries(
      pibSeries.map((row) => [row.year, calculateShare(row.pib, stateByYear.get(row.year)?.pib ?? 0)])
    );

    return {
      id: slug(name),
      name,
      mesoregionId: mesoregion.id,
      pibSeries,
      cagr2023_2030: calculateCAGR(pibSeries[0]?.pib ?? 0, pibSeries.at(-1)?.pib ?? 0, pibSeries.length - 1),
      mesoregionShareByYear,
      stateShareByYear
    };
  });

  return { state, mesoregions, municipalities };
}
