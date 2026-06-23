"use client";

import EChart from "../../../components/EChart";
import Card from "../ui/Card";
import type { MunicipalityData, SelectedLevel, StateData, VicePresidencyData } from "../../types/economic-dashboard";
import { formatCurrencyBRL, formatPerCapitaBRL, formatPercent } from "../../lib/formatters";

type Props = {
  level: SelectedLevel;
  state: StateData;
  vicePresidency?: VicePresidencyData;
  municipality?: MunicipalityData;
  isPerCapita?: boolean;
};

export default function PibEvolutionChart({ level, state, vicePresidency, municipality, isPerCapita = false }: Props) {
  const primary =
    level === "municipality" && municipality
      ? { label: municipality.name, series: municipality.pibSeries }
      : level === "vice-presidency" && vicePresidency
        ? { label: vicePresidency.name, series: vicePresidency.pibSeries }
        : { label: "Santa Catarina", series: state.pibSeries };
  const years = primary.series.map((row) => row.year);

  const option = {
    tooltip: {
      trigger: "axis",
      formatter: (params: any[]) =>
        params
          .map((param) => {
            const row = primary.series[param.dataIndex];
            const formattedValue = isPerCapita ? formatPerCapitaBRL(param.value) : formatCurrencyBRL(param.value);
            return `${param.marker}${param.seriesName}: ${formattedValue}<br/>Crescimento: ${formatPercent(
              row.growth
            )}<br/>Status: ${row.isProjected ? "projetado" : "observado"}`;
          })
          .join("<br/>")
    },
    legend: { top: 0 },
    grid: { left: 54, right: 18, top: 48, bottom: 28 },
    xAxis: { type: "category", data: years },
    yAxis: { type: "value", axisLabel: { formatter: (value: number) => (isPerCapita ? formatPerCapitaBRL(value) : formatCurrencyBRL(value)).replace("R$", "R$ ") } },
    series: [
      {
        name: primary.label,
        type: "line",
        smooth: true,
        showSymbol: false,
        areaStyle: { opacity: 0.08 },
        markLine: isPerCapita ? undefined : { symbol: "none", data: [{ xAxis: 2023, label: { formatter: "último observado" } }] },
        data: primary.series.map((row) => row.pib)
      }
    ]
  };

  return (
    <Card title={isPerCapita ? "Evolução do PIB per capita" : "Evolução do PIB"} tooltip="Série anual no território selecionado. A linha vertical indica o último ano observado antes das projeções.">
      <EChart option={option} height={300} />
    </Card>
  );
}
