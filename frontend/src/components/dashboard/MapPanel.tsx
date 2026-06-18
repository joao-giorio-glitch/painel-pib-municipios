"use client";

import { useEffect, useMemo, useState } from "react";
import * as echarts from "echarts";
import EChart from "../../../components/EChart";
import type { MesoregionData, MunicipalityData, SelectedLevel, SelectedMetric, StateData } from "../../types/economic-dashboard";
import { formatCurrencyBRL, formatPercent } from "../../lib/formatters";
import { geoJsonSources } from "../../data/geojson-placeholders";

type Props = {
  level: SelectedLevel;
  selectedYear: number;
  selectedMesoregion?: MesoregionData;
  selectedMunicipality?: MunicipalityData;
  selectedMetric: SelectedMetric;
  state: StateData;
  mesoregions: MesoregionData[];
  municipalities: MunicipalityData[];
  onMesoregionClick: (name: string) => void;
  onMunicipalityClick: (name: string) => void;
};

function metricLabel(metric: SelectedMetric) {
  if (metric === "pib") return "PIB";
  if (metric === "growth") return "crescimento anual";
  return "participação";
}

export default function MapPanel({
  level,
  selectedYear,
  selectedMesoregion,
  selectedMunicipality,
  selectedMetric,
  state,
  mesoregions,
  municipalities,
  onMesoregionClick,
  onMunicipalityClick
}: Props) {
  const [mapState, setMapState] = useState<{ name: string; ready: boolean }>({ name: "sc-mesorregioes", ready: false });

  useEffect(() => {
    const source = level === "state" ? geoJsonSources.mesoregions : geoJsonSources.municipalities;
    fetch(source)
      .then((response) => response.json())
      .then((geoJson) => {
        const filtered =
          level === "state" || !selectedMesoregion
            ? geoJson
            : {
                ...geoJson,
                features: geoJson.features.filter((feature: any) => feature.properties.mesoregion === selectedMesoregion.name)
              };
        const name = level === "state" ? "sc-mesorregioes" : `municipios-${selectedMesoregion?.id ?? "sc"}`;
        echarts.registerMap(name, filtered);
        setMapState({ name, ready: true });
      });
  }, [level, selectedMesoregion]);

  const rows = useMemo(() => {
    if (level === "state") {
      return mesoregions.map((item) => {
        const row = item.pibSeries.find((entry) => entry.year === selectedYear)!;
        return {
          name: item.name,
          value:
            selectedMetric === "pib"
              ? row.pib
              : selectedMetric === "growth"
                ? row.growth
                : item.stateShareByYear[selectedYear],
          pib: row.pib,
          share: item.stateShareByYear[selectedYear],
          growth: row.growth,
          cagr: item.cagr2023_2030
        };
      });
    }

    const scope = municipalities.filter((item) => item.mesoregionId === selectedMesoregion?.id);
    return scope.map((item) => {
      const row = item.pibSeries.find((entry) => entry.year === selectedYear)!;
      return {
        name: item.name,
        selected: item.id === selectedMunicipality?.id,
        value:
          selectedMetric === "pib"
            ? row.pib
            : selectedMetric === "growth"
              ? row.growth
              : item.mesoregionShareByYear[selectedYear],
        pib: row.pib,
        share: item.mesoregionShareByYear[selectedYear],
        growth: row.growth,
        cagr: item.cagr2023_2030
      };
    });
  }, [level, mesoregions, municipalities, selectedMesoregion, selectedMetric, selectedMunicipality, selectedYear]);

  const values = rows.map((row) => row.value).filter(Number.isFinite);
  const option = {
    tooltip: {
      trigger: "item",
      formatter: (params: any) => {
        const data = params.data;
        if (!data) return params.name;
        return [
          `<strong>${params.name}</strong>`,
          `PIB: ${formatCurrencyBRL(data.pib)}`,
          `Participação: ${formatPercent(data.share)}`,
          `Crescimento anual: ${formatPercent(data.growth)}`,
          `CAGR 2023-2030: ${formatPercent(data.cagr)}`
        ].join("<br />");
      }
    },
    visualMap: {
      min: Math.min(...values),
      max: Math.max(...values),
      left: 14,
      bottom: 14,
      calculable: true,
      text: [`Maior ${metricLabel(selectedMetric)}`, `Menor ${metricLabel(selectedMetric)}`],
      inRange: { color: ["#e7efe9", "#9cc9b9", "#2b8c7e", "#0e554d"] },
      textStyle: { color: "#5f6d66" }
    },
    series: [
      {
        type: "map",
        map: mapState.name,
        roam: true,
        selectedMode: "single",
        itemStyle: { borderColor: "#fff", borderWidth: 0.8 },
        emphasis: { itemStyle: { areaColor: "#d8a23a" }, label: { show: true, color: "#1f2724" } },
        select: { itemStyle: { areaColor: "#d8a23a" } },
        data: rows
      }
    ]
  };

  const events = useMemo(
    () => ({
      click: (params: any) => {
        if (!params.name) return;
        if (level === "state") onMesoregionClick(params.name);
        else onMunicipalityClick(params.name);
      }
    }),
    [level, onMesoregionClick, onMunicipalityClick]
  );

  return (
    <section className="map-card">
      <div className="section-heading">
        <div>
          <h2>{level === "state" ? "Mapa por mesorregiões" : `Municípios de ${selectedMesoregion?.name}`}</h2>
          <p>Cor por {metricLabel(selectedMetric)} no ano selecionado</p>
        </div>
      </div>
      {mapState.ready ? <EChart option={option} height={620} onEvents={events} /> : <div className="map-loading" />}
    </section>
  );
}
