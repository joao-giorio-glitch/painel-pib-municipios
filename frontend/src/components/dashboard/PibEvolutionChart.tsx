"use client";

import EChart from "../../../components/EChart";
import Card from "../ui/Card";
import type { MesoregionData, MunicipalityData, SelectedLevel, StateData, YearValue } from "../../types/economic-dashboard";
import { formatCurrencyBRL, formatPercent } from "../../lib/formatters";

type Props = {
  level: SelectedLevel;
  state: StateData;
  mesoregion?: MesoregionData;
  municipality?: MunicipalityData;
};

function normalize(series: YearValue[]) {
  const base = series[0].pib;
  return series.map((row) => (row.pib / base) * 100);
}

export default function PibEvolutionChart({ level, state, mesoregion, municipality }: Props) {
  const primary =
    level === "municipality" && municipality
      ? { label: municipality.name, series: municipality.pibSeries }
      : level === "mesoregion" && mesoregion
        ? { label: mesoregion.name, series: mesoregion.pibSeries }
        : { label: "Santa Catarina", series: state.pibSeries };
  const comparison =
    level === "municipality" && mesoregion
      ? { label: `${mesoregion.name} (base 100)`, series: normalize(mesoregion.pibSeries), normalized: true }
      : level === "mesoregion"
        ? { label: "Santa Catarina (base 100)", series: normalize(state.pibSeries), normalized: true }
        : null;
  const years = primary.series.map((row) => row.year);

  const option = {
    tooltip: {
      trigger: "axis",
      formatter: (params: any[]) =>
        params
          .map((param) => {
            const row = primary.series[param.dataIndex];
            const value = param.seriesName.includes("base 100") ? param.value.toFixed(1) : formatCurrencyBRL(param.value);
            return `${param.marker}${param.seriesName}: ${value}<br/>Crescimento: ${formatPercent(row.growth)}<br/>Status: ${
              row.isProjected ? "projetado" : "observado"
            }`;
          })
          .join("<br/>")
    },
    legend: { top: 0 },
    grid: { left: 54, right: 18, top: 48, bottom: 28 },
    xAxis: { type: "category", data: years },
    yAxis: { type: "value", axisLabel: { formatter: (value: number) => formatCurrencyBRL(value).replace("R$", "R$ ") } },
    series: [
      {
        name: primary.label,
        type: "line",
        smooth: true,
        showSymbol: false,
        areaStyle: { opacity: 0.08 },
        markLine: { symbol: "none", data: [{ xAxis: 2023, label: { formatter: "último observado" } }] },
        data: primary.series.map((row) => row.pib)
      },
      ...(comparison
        ? [
            {
              name: comparison.label,
              type: "line",
              smooth: true,
              showSymbol: false,
              yAxisIndex: 0,
              lineStyle: { type: "dashed" },
              data: comparison.series
            }
          ]
        : [])
    ]
  };

  return (
    <Card title="Evolução do PIB">
      <EChart option={option} height={300} />
    </Card>
  );
}

