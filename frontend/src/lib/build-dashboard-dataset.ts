import type { MunicipalityData, StateData, VicePresidencyData, YearValue } from "../types/economic-dashboard";
import { calculateCAGR, calculateGrowth, calculateShare } from "./economic-calculations";

type PibRow = {
  year: number;
  municipio?: string;
  vicePresidency?: string;
  isStateTotal?: boolean;
  pib: number;
  totalPib?: number;
  population?: number;
  type?: string;
};

type RawPibPayload = {
  metadata: {
    maxObservedYear: number;
    dashboardStartYear?: number;
    finalProjectionYear: number;
    vicePresidencies: string[];
  };
  municipios: PibRow[];
  vicePresidencies: PibRow[];
  sc: PibRow[];
};

export type DashboardDataset = {
  state: StateData;
  vicePresidencies: VicePresidencyData[];
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
  const ordered = byYear(rows);
  return ordered
    .map((row, index) => {
      const previous = ordered[index - 1];
      return {
        year: row.year,
        pib: Number(row.pib ?? 0),
        totalPib: Number(row.totalPib ?? row.pib ?? 0),
        population: Number(row.population ?? 0) || undefined,
        totalPibGrowth: previous
          ? calculateGrowth(Number(row.totalPib ?? row.pib ?? 0), Number(previous.totalPib ?? previous.pib ?? 0))
          : 0,
        populationGrowth:
          previous && Number(row.population ?? 0) && Number(previous.population ?? 0)
            ? calculateGrowth(Number(row.population), Number(previous.population))
            : undefined,
        growth: previous ? calculateGrowth(Number(row.pib ?? 0), Number(previous.pib ?? 0)) : 0,
        isProjected: row.year > maxObservedYear
      };
    })
    .filter((row) => row.year >= startYear);
}

export function buildDashboardDataset(payload: RawPibPayload): DashboardDataset {
  const startYear = payload.metadata.dashboardStartYear ?? payload.metadata.maxObservedYear;
  const stateSeries = toSeries(payload.sc, startYear, payload.metadata.maxObservedYear);
  const stateByYear = new Map(stateSeries.map((row) => [row.year, row]));

  const state: StateData = {
    name: "Santa Catarina",
    pibSeries: stateSeries,
    cagr2023_2030: calculateCAGR(stateSeries[0]?.pib ?? 0, stateSeries.at(-1)?.pib ?? 0, stateSeries.length - 1)
  };

  const vicePresidencies: VicePresidencyData[] = payload.metadata.vicePresidencies.map((name) => {
    const pibSeries = toSeries(
      payload.vicePresidencies.filter((row) => row.vicePresidency === name),
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

  const vicePresidencyByName = new Map(vicePresidencies.map((item) => [item.name, item]));
  const vicePresidencyByYear = new Map(
    vicePresidencies.flatMap((item) => item.pibSeries.map((row) => [`${item.id}|${row.year}`, row] as const))
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
    const vicePresidency =
      vicePresidencyByName.get(rows.find((row) => row.vicePresidency)?.vicePresidency ?? "") ?? vicePresidencies[0];
    const pibSeries = toSeries(rows, startYear, payload.metadata.maxObservedYear);
    const vicePresidencyShareByYear = Object.fromEntries(
      pibSeries.map((row) => [
        row.year,
        calculateShare(row.pib, vicePresidencyByYear.get(`${vicePresidency.id}|${row.year}`)?.pib ?? 0)
      ])
    );
    const stateShareByYear = Object.fromEntries(
      pibSeries.map((row) => [row.year, calculateShare(row.pib, stateByYear.get(row.year)?.pib ?? 0)])
    );

    return {
      id: slug(name),
      name,
      vicePresidencyId: vicePresidency.id,
      pibSeries,
      cagr2023_2030: calculateCAGR(pibSeries[0]?.pib ?? 0, pibSeries.at(-1)?.pib ?? 0, pibSeries.length - 1),
      vicePresidencyShareByYear,
      stateShareByYear
    };
  });

  return { state, vicePresidencies, municipalities };
}
