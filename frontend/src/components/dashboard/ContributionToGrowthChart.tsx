"use client";

import EChart from "../../../components/EChart";
import Card from "../ui/Card";
import type { MunicipalityData, SelectedLevel, StateData, VicePresidencyData } from "../../types/economic-dashboard";
import { calculateContributionToGrowth } from "../../lib/economic-calculations";
import { formatCurrencyBRL, formatPercent } from "../../lib/formatters";

type ContributorSeries = {
  name: string;
  values: Array<number | { value: number; municipality?: string; municipalityChange?: number; referenceBase?: number }>;
  color?: string;
};

const cityPalette = [
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
  "#2dd4bf",
  "#f97316",
  "#60a5fa",
  "#84cc16",
  "#f472b6",
  "#22c55e",
  "#e879f9",
  "#06b6d4",
  "#fde047",
  "#c084fc",
  "#4ade80"
];
const otherColor = "#94a3b8";

function calculateRateContribution(
  municipalityPib: number,
  previousMunicipalityPib: number,
  previousReferencePib: number
) {
  const municipalityChange = municipalityPib - previousMunicipalityPib;

  return {
    value: previousReferencePib === 0 ? 0 : municipalityChange / previousReferencePib,
    municipalityChange,
    referenceBase: previousReferencePib
  };
}
function buildTopMunicipalityContributors(
  selectedVicePresidency: VicePresidencyData,
  municipalities: MunicipalityData[],
  years: number[]
): ContributorSeries[] {
  const scope = municipalities.filter((item) => item.vicePresidencyId === selectedVicePresidency.id);
  const yearlyContributions = years.map((year) =>
    scope
      .map((item) => {
        const previousShare = item.vicePresidencyShareByYear[year - 1];
        const growth = item.pibSeries.find((row) => row.year === year)?.growth ?? 0;
        return {
          name: item.name,
          value: calculateContributionToGrowth(previousShare, growth)
        };
      })
      .sort((a, b) => b.value - a.value)
  );
  const topNames = Array.from(
    new Set(yearlyContributions.flatMap((rows) => rows.slice(0, 6).map((row) => row.name)))
  );

  return [
    ...topNames.map((name, index) => ({
      name,
      color: cityPalette[index % cityPalette.length],
      values: yearlyContributions.map((rows) => {
        const topRows = rows.slice(0, 6);
        const item = topRows.find((row) => row.name === name);
        return item ? { value: item.value, municipality: item.name } : 0;
      })
    })),
    {
      name: "Outros",
      color: otherColor,
      values: yearlyContributions.map((rows) => ({
        value: rows.slice(6).reduce((sum, row) => sum + row.value, 0),
        municipality: "Outros"
      }))
    }
  ];
}

type Props = {
  level: SelectedLevel;
  state: StateData;
  selectedVicePresidency?: VicePresidencyData;
  selectedMunicipality?: MunicipalityData;
  vicePresidencies: VicePresidencyData[];
  municipalities: MunicipalityData[];
};

function tooltipFormatter(params: any[]) {
  const visibleParams = params.filter((item) => {
    const rawValue = typeof item.data === "object" ? item.data.value : item.value;
    return item.seriesType === "line" || Math.abs(Number(rawValue)) > 1e-12;
  });

  return [
    `<strong>${params[0]?.axisValue ?? ""}</strong>`,
    ...visibleParams.map((item) => {
      const rawValue = typeof item.data === "object" ? item.data.value : item.value;
      const label = typeof item.data === "object" && item.data.municipality ? item.data.municipality : item.seriesName;
      const calculation =
        typeof item.data === "object" && Number.isFinite(item.data.municipalityChange) && Number.isFinite(item.data.referenceBase)
          ? ` (${formatCurrencyBRL(item.data.municipalityChange)} / ${formatCurrencyBRL(item.data.referenceBase)} no ano anterior)`
          : "";
      return `${item.marker}${label}: ${formatPercent(Number(rawValue))}${calculation}`;
    })
  ].join("<br />");
}

export default function ContributionToGrowthChart({
  level,
  state,
  selectedVicePresidency,
  selectedMunicipality,
  vicePresidencies,
  municipalities
}: Props) {
  const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
  const contributors: ContributorSeries[] =
    level === "state"
      ? vicePresidencies.map((item) => ({
          name: item.name,
          values: years.map((year) => {
            const previousShare = item.stateShareByYear[year - 1];
            const growth = item.pibSeries.find((row) => row.year === year)?.growth ?? 0;
            return calculateContributionToGrowth(previousShare, growth);
          })
        }))
      : level === "vice-presidency" && selectedVicePresidency
        ? buildTopMunicipalityContributors(selectedVicePresidency, municipalities, years)
        : selectedMunicipality
          ? [
              {
                name: "Para vice-presidência",
                values: years.map((year) => {
                  const municipalityRow = selectedMunicipality.pibSeries.find((row) => row.year === year);
                  const previousMunicipalityRow = selectedMunicipality.pibSeries.find((row) => row.year === year - 1);
                  const previousVicePresidencyRow = selectedVicePresidency?.pibSeries.find((row) => row.year === year - 1);
                  return calculateRateContribution(
                    municipalityRow?.pib ?? 0,
                    previousMunicipalityRow?.pib ?? 0,
                    previousVicePresidencyRow?.pib ?? 0
                  );
                })
              },
              {
                name: "Para SC",
                values: years.map((year) => {
                  const municipalityRow = selectedMunicipality.pibSeries.find((row) => row.year === year);
                  const previousMunicipalityRow = selectedMunicipality.pibSeries.find((row) => row.year === year - 1);
                  const previousStateRow = state.pibSeries.find((row) => row.year === year - 1);
                  return calculateRateContribution(
                    municipalityRow?.pib ?? 0,
                    previousMunicipalityRow?.pib ?? 0,
                    previousStateRow?.pib ?? 0
                  );
                })
              }
            ]
          : [];

  const lineSeries =
    level === "state"
      ? [
          {
            name: "Crescimento SC",
            type: "line",
            data: years.map((year) => state.pibSeries.find((row) => row.year === year)?.growth ?? 0),
            symbolSize: 7,
            lineStyle: { width: 2.5, color: "#1f2724" },
            itemStyle: { color: "#1f2724" },
            z: 3
          }
        ]
      : level === "vice-presidency" && selectedVicePresidency
        ? [
            {
              name: "Crescimento da vice-presidência",
              type: "line",
              data: years.map((year) => selectedVicePresidency.pibSeries.find((row) => row.year === year)?.growth ?? 0),
              symbolSize: 7,
              lineStyle: { width: 2.5, color: "#1f2724" },
              itemStyle: { color: "#1f2724" },
              z: 3
            }
          ]
        : [];

  const option = {
    tooltip: { trigger: "axis", formatter: tooltipFormatter },
    legend: { type: "scroll", top: 0 },
    grid: { left: 44, right: 16, top: 52, bottom: 30 },
    xAxis: { type: "category", data: years },
    yAxis: { type: "value", axisLabel: { formatter: (value: number) => formatPercent(value) } },
    series: [
      ...contributors.map((item) => ({
        name: item.name,
        type: "bar",
        stack: level === "municipality" ? undefined : "total",
        data: item.values,
        itemStyle: item.color ? { color: item.color } : undefined
      })),
      ...lineSeries
    ]
  };

  return (
    <Card title="Contribuição ao crescimento" tooltip="Mostra quanto cada território contribui para a variação anual do PIB do território de referência.">
      <EChart option={option} height={300} />
    </Card>
  );
}
