"use client";

import { useState } from "react";
import EChart from "../../../components/EChart";
import Card from "../ui/Card";
import type { MesoregionData, MunicipalityData, SelectedLevel, StateData, YearValue } from "../../types/economic-dashboard";
import { formatPercent } from "../../lib/formatters";

type Mode = "growth" | "cagr" | "base";

type Props = {
  level: SelectedLevel;
  state: StateData;
  mesoregion?: MesoregionData;
  municipality?: MunicipalityData;
};

function base100(series: YearValue[]) {
  const base = series[0].pib;
  return series.map((row) => (row.pib / base) * 100);
}

export default function GrowthAndCagrChart({ level, state, mesoregion, municipality }: Props) {
  const [mode, setMode] = useState<Mode>("growth");
  const primary =
    level === "municipality" && municipality
      ? { label: municipality.name, series: municipality.pibSeries, cagr: municipality.cagr2023_2030 }
      : level === "mesoregion" && mesoregion
        ? { label: mesoregion.name, series: mesoregion.pibSeries, cagr: mesoregion.cagr2023_2030 }
        : { label: "Santa Catarina", series: state.pibSeries, cagr: state.cagr2023_2030 };
  const peers = [
    primary,
    ...(level === "municipality" && mesoregion ? [{ label: mesoregion.name, series: mesoregion.pibSeries, cagr: mesoregion.cagr2023_2030 }] : []),
    ...(level !== "state" ? [{ label: "Santa Catarina", series: state.pibSeries, cagr: state.cagr2023_2030 }] : [])
  ];

  const years = primary.series.map((row) => row.year);
  const option = {
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: number) => (mode === "base" ? value.toFixed(1) : formatPercent(value))
    },
    legend: { top: 0 },
    grid: { left: 44, right: 16, top: 48, bottom: 30 },
    xAxis: { type: "category", data: years },
    yAxis: { type: "value" },
    series:
      mode === "cagr"
        ? peers.map((item) => ({
            name: item.label,
            type: "bar",
            data: years.map(() => item.cagr)
          }))
        : peers.map((item) => ({
            name: item.label,
            type: mode === "growth" ? "bar" : "line",
            smooth: true,
            data: mode === "growth" ? item.series.map((row) => row.growth) : base100(item.series)
          }))
  };

  return (
    <Card title="Crescimento e CAGR">
      <div className="mini-toggle">
        <button className={mode === "growth" ? "active" : ""} onClick={() => setMode("growth")}>
          Crescimento anual
        </button>
        <button className={mode === "cagr" ? "active" : ""} onClick={() => setMode("cagr")}>
          CAGR acumulado
        </button>
        <button className={mode === "base" ? "active" : ""} onClick={() => setMode("base")}>
          Base 2023 = 100
        </button>
      </div>
      <EChart option={option} height={280} />
    </Card>
  );
}

