"use client";

import { useEffect, useMemo, useState } from "react";
import * as echarts from "echarts";
import EChart from "../../../components/EChart";
import type { MesoregionData, MunicipalityData, SelectedLevel, SelectedMetric, StateData, YearValue } from "../../types/economic-dashboard";
import { formatCurrencyBRL, formatPercent } from "../../lib/formatters";
import { geoJsonSources } from "../../data/geojson-placeholders";

type RankingMode = "map" | "mesoregion-ranking" | "municipality-ranking";

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
  return "participacao";
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function rowByYear(series: YearValue[], year: number) {
  return series.find((row) => row.year === year) ?? series[0];
}

function buildRankingOption({
  rows,
  selectedYear,
  visibleCount,
  title
}: {
  rows: Array<{ name: string; series: YearValue[] }>;
  selectedYear: number;
  visibleCount: number;
  title: string;
}) {
  const rankingRows = rows
    .map((item) => ({ name: item.name, value: rowByYear(item.series, selectedYear).pib }))
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => b.value - a.value);
  const zoomEnd = rows.length > visibleCount ? Math.max(1, (visibleCount / rows.length) * 100) : 100;
  const dataZoom =
    rows.length > visibleCount
      ? [
          {
            type: "slider",
            yAxisIndex: 0,
            right: 4,
            width: 16,
            start: 0,
            end: zoomEnd,
            brushSelect: false,
            borderColor: "#dce5df",
            fillerColor: "rgba(43, 140, 126, 0.16)",
            handleStyle: { color: "#2b8c7e" }
          },
          {
            type: "inside",
            yAxisIndex: 0,
            start: 0,
            end: zoomEnd,
            zoomOnMouseWheel: false,
            moveOnMouseWheel: true,
            moveOnMouseMove: true
          }
        ]
      : [];

  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: any[]) => {
        const item = params[0];
        const data = item?.data;
        if (!item || !data) return "";
        return [
          `<strong>${item.name}</strong>`,
          `Ranking: ${data.rank}o`,
          `PIB: ${formatCurrencyBRL(data.value)}`
        ].join("<br />");
      }
    },
    title: {
      text: `${title} - ${selectedYear}`,
      left: 0,
      top: 0,
      textStyle: { color: "#123f39", fontSize: 14 }
    },
    grid: { left: 144, right: 150, top: 46, bottom: 34 },
    dataZoom,
    xAxis: {
      type: "value",
      max: (value: { max: number }) => value.max * 1.18,
      axisLabel: { formatter: (value: number) => formatCurrencyBRL(value).replace("R$", "R$ ") }
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: rankingRows.map((row) => row.name),
      axisLabel: { color: "#3f4f48", interval: 0, overflow: "truncate", width: 126 }
    },
    series: [
      {
        type: "bar",
        data: rankingRows.map((row, index) => ({ value: row.value, rank: index + 1 })),
        itemStyle: { color: "#2b8c7e", borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: "right",
          distance: 8,
          color: "#1f2724",
          formatter: (params: any) => formatCurrencyBRL(params.value)
        },
        labelLayout: { hideOverlap: false }
      }
    ],
    animationDuration: 450,
    animationDurationUpdate: 650,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicOut"
  };
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
  const [viewMode, setViewMode] = useState<RankingMode>("map");
  const [rankingYear, setRankingYear] = useState(2030);
  const [rankingAutoPlay, setRankingAutoPlay] = useState(false);
  const [municipalitySearch, setMunicipalitySearch] = useState("");

  useEffect(() => {
    setViewMode("map");
    setRankingAutoPlay(false);
    setMunicipalitySearch("");
  }, [level, selectedMesoregion?.id]);

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

  useEffect(() => {
    if (!rankingAutoPlay || viewMode === "map") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setRankingYear((current) => {
        if (current >= 2030) {
          setRankingAutoPlay(false);
          return 2030;
        }
        return current + 1;
      });
    }, 1100);

    return () => window.clearInterval(interval);
  }, [rankingAutoPlay, viewMode]);

  const years = state.pibSeries.map((row) => row.year).filter((year) => year >= 2023 && year <= 2030);
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
  const mapOption = {
    tooltip: {
      trigger: "item",
      formatter: (params: any) => {
        const data = params.data;
        if (!data) return params.name;
        return [
          `<strong>${params.name}</strong>`,
          `PIB: ${formatCurrencyBRL(data.pib)}`,
          `Participacao: ${formatPercent(data.share)}`,
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

  const rankingRows =
    viewMode === "mesoregion-ranking"
      ? mesoregions.map((item) => ({ name: item.name, series: item.pibSeries }))
      : municipalities
          .filter((item) => level === "state" || item.mesoregionId === selectedMesoregion?.id)
          .filter((item) => {
            const search = normalizeSearch(municipalitySearch.trim());
            return !search || normalizeSearch(item.name).includes(search);
          })
          .map((item) => ({ name: item.name, series: item.pibSeries }));
  const rankingOption =
    viewMode === "map"
      ? null
      : buildRankingOption({
          rows: rankingRows,
          selectedYear: rankingYear,
          visibleCount: viewMode === "municipality-ranking" ? 25 : 12,
          title:
            viewMode === "mesoregion-ranking"
              ? "PIB das mesorregioes por ano"
              : level === "state"
                ? "PIB dos municipios de Santa Catarina por ano"
                : `PIB dos municipios de ${selectedMesoregion?.name ?? ""} por ano`
        });

  const mapEvents = useMemo(
    () => ({
      click: (params: any) => {
        if (!params.name) return;
        if (level === "state") onMesoregionClick(params.name);
        else onMunicipalityClick(params.name);
      }
    }),
    [level, onMesoregionClick, onMunicipalityClick]
  );

  const rankingEvents = useMemo(
    () => ({
      click: (params: any) => {
        if (!params.name) return;
        if (viewMode === "mesoregion-ranking") onMesoregionClick(params.name);
        else onMunicipalityClick(params.name);
      }
    }),
    [onMesoregionClick, onMunicipalityClick, viewMode]
  );

  return (
    <section className="map-card">
      <div className="section-heading map-heading">
        <div>
          <h2>
            {viewMode === "map"
              ? level === "state"
                ? "Mapa por mesorregioes"
                : `Municipios de ${selectedMesoregion?.name}`
              : viewMode === "mesoregion-ranking"
                ? "Ranking mesorregional"
                : "Ranking municipal"}
          </h2>
          <p>
            {viewMode === "map"
              ? `Cor por ${metricLabel(selectedMetric)} no ano selecionado`
              : "Barras por PIB anual, com animacao temporal ate 2030"}
          </p>
        </div>
        <div className="map-controls">
          <div className="mini-toggle">
            <button
              className={viewMode === "map" ? "active" : ""}
              onClick={() => {
                setRankingAutoPlay(false);
                setViewMode("map");
              }}
            >
              Mapa geografico
            </button>
            {level === "state" ? (
              <button
                className={viewMode === "mesoregion-ranking" ? "active" : ""}
                onClick={() => {
                  setRankingYear(2023);
                  setRankingAutoPlay(true);
                  setMunicipalitySearch("");
                  setViewMode("mesoregion-ranking");
                }}
              >
                Ranking mesorregional
              </button>
            ) : null}
            <button
              className={viewMode === "municipality-ranking" ? "active" : ""}
              onClick={() => {
                setRankingYear(2023);
                setRankingAutoPlay(true);
                setViewMode("municipality-ranking");
              }}
            >
              Ranking municipal
            </button>
          </div>
          {viewMode !== "map" ? (
            <select
              value={rankingYear}
              onChange={(event) => {
                setRankingAutoPlay(false);
                setRankingYear(Number(event.target.value));
              }}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          ) : null}
          {viewMode === "municipality-ranking" ? (
            <input
              className="map-search"
              type="search"
              value={municipalitySearch}
              onChange={(event) => {
                setRankingAutoPlay(false);
                setMunicipalitySearch(event.target.value);
              }}
              placeholder="Buscar municipio"
            />
          ) : null}
        </div>
      </div>
      {viewMode === "map" ? (
        mapState.ready ? (
          <EChart option={mapOption} height={620} onEvents={mapEvents} />
        ) : (
          <div className="map-loading" />
        )
      ) : rankingRows.length === 0 ? (
        <div className="ranking-empty">Nenhum municipio encontrado para a busca.</div>
      ) : rankingOption ? (
        <EChart option={rankingOption} height={620} onEvents={rankingEvents} />
      ) : (
        <div className="map-loading" />
      )}
    </section>
  );
}
