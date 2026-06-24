"use client";

import { useEffect, useState } from "react";
import EChart from "../../../components/EChart";
import Card from "../ui/Card";
import type { MunicipalityData, SelectedLevel, StateData, VicePresidencyData } from "../../types/economic-dashboard";
import { formatPercent } from "../../lib/formatters";

type Mode = "growth" | "pib-population";

type Props = {
  level: SelectedLevel;
  state: StateData;
  vicePresidency?: VicePresidencyData;
  municipality?: MunicipalityData;
  isPerCapita?: boolean;
};

export default function GrowthAndCagrChart({ level, state, vicePresidency, municipality, isPerCapita = false }: Props) {
  const [mode, setMode] = useState<Mode>("growth");
  useEffect(() => {
    if (!isPerCapita && mode === "pib-population") setMode("growth");
  }, [isPerCapita, mode]);
  const primary =
    level === "municipality" && municipality
      ? { label: municipality.name, series: municipality.pibSeries }
      : level === "vice-presidency" && vicePresidency
        ? { label: vicePresidency.name, series: vicePresidency.pibSeries }
        : { label: "Santa Catarina", series: state.pibSeries };
  const peers = [
    primary,
    ...(level === "municipality" && vicePresidency ? [{ label: vicePresidency.name, series: vicePresidency.pibSeries }] : []),
    ...(level !== "state" ? [{ label: "Santa Catarina", series: state.pibSeries }] : [])
  ];

  const years = primary.series.map((row) => row.year);
  const isPibPopulation = mode === "pib-population";
  const option = {
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: number) => formatPercent(value)
    },
    legend: { top: 0 },
    grid: { left: 44, right: 16, top: 48, bottom: 30 },
    xAxis: { type: "category", data: years },
    yAxis: { type: "value" },
    series:
      isPibPopulation
        ? [
            {
              name: "PIB",
              type: "bar",
              data: primary.series.map((row) => row.totalPibGrowth ?? 0),
              itemStyle: { color: "#2b8c7e" }
            },
            {
              name: "Popula\u00e7\u00e3o",
              type: "bar",
              data: primary.series.map((row) => row.populationGrowth ?? 0),
              itemStyle: { color: "#d8a23a" }
            }
          ]
        : peers.map((item) => ({
            name: item.label,
            type: "bar",
            data: item.series.map((row) => row.growth)
          }))
  };

  return (
    <Card
      title={isPerCapita ? "Visualizações de Crescimento do PIB per capita" : "Visualizações de Crescimento"}
      tooltip={isPerCapita ? "Compara a variação do PIB e da população para contextualizar o crescimento do PIB per capita." : undefined}
    >
      <div className="mini-toggle growth-view-toggle" aria-label="Selecionar visualização de crescimento">
        <button className={mode === "growth" ? "active" : ""} onClick={() => setMode("growth")}>
          Crescimento anual
        </button>
        {isPerCapita ? (
          <button className={mode === "pib-population" ? "active" : ""} onClick={() => setMode("pib-population")}>
            PIB vs População
          </button>
        ) : null}
      </div>
      <EChart option={option} height={280} />
    </Card>
  );
}
