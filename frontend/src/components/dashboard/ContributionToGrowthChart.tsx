"use client";

import EChart from "../../../components/EChart";
import Card from "../ui/Card";
import type { MesoregionData, MunicipalityData, SelectedLevel, StateData } from "../../types/economic-dashboard";
import { calculateContributionToGrowth } from "../../lib/economic-calculations";
import { formatPercent } from "../../lib/formatters";

type Props = {
  level: SelectedLevel;
  state: StateData;
  selectedMesoregion?: MesoregionData;
  selectedMunicipality?: MunicipalityData;
  mesoregions: MesoregionData[];
  municipalities: MunicipalityData[];
};

export default function ContributionToGrowthChart({
  level,
  state,
  selectedMesoregion,
  selectedMunicipality,
  mesoregions,
  municipalities
}: Props) {
  const years = [2024, 2025, 2026, 2027, 2028, 2029, 2030];
  const contributors =
    level === "state"
      ? mesoregions.map((item) => ({
          name: item.name,
          values: years.map((year) => {
            const previousShare = item.stateShareByYear[year - 1];
            const growth = item.pibSeries.find((row) => row.year === year)?.growth ?? 0;
            return calculateContributionToGrowth(previousShare, growth);
          })
        }))
      : level === "mesoregion" && selectedMesoregion
        ? municipalities
            .filter((item) => item.mesoregionId === selectedMesoregion.id)
            .map((item) => ({
              name: item.name,
              values: years.map((year) => {
                const previousShare = item.mesoregionShareByYear[year - 1];
                const growth = item.pibSeries.find((row) => row.year === year)?.growth ?? 0;
                return calculateContributionToGrowth(previousShare, growth);
              })
            }))
        : selectedMunicipality
          ? [
              {
                name: "Para mesorregião",
                values: years.map((year) =>
                  calculateContributionToGrowth(
                    selectedMunicipality.mesoregionShareByYear[year - 1],
                    selectedMunicipality.pibSeries.find((row) => row.year === year)?.growth ?? 0
                  )
                )
              },
              {
                name: "Para SC",
                values: years.map((year) =>
                  calculateContributionToGrowth(
                    selectedMunicipality.stateShareByYear[year - 1],
                    selectedMunicipality.pibSeries.find((row) => row.year === year)?.growth ?? 0
                  )
                )
              }
            ]
          : [];

  const option = {
    tooltip: { trigger: "axis", valueFormatter: (value: number) => formatPercent(value) },
    legend: { type: "scroll", top: 0 },
    grid: { left: 44, right: 16, top: 52, bottom: 30 },
    xAxis: { type: "category", data: years },
    yAxis: { type: "value", axisLabel: { formatter: (value: number) => formatPercent(value) } },
    series: [
      ...contributors.map((item) => ({
        name: item.name,
        type: "bar",
        stack: level === "municipality" ? undefined : "total",
        data: item.values
      })),
      ...(level === "state"
        ? [
            {
              name: "Crescimento SC",
              type: "line",
              data: years.map((year) => state.pibSeries.find((row) => row.year === year)?.growth ?? 0)
            }
          ]
        : [])
    ]
  };

  return (
    <Card title="Contribuição ao crescimento">
      <EChart option={option} height={300} />
    </Card>
  );
}

