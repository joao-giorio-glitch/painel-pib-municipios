"use client";

import { useEffect, useMemo, useState } from "react";
import * as echarts from "echarts";
import EChart from "../../../components/EChart";
import type { MunicipalityData, SelectedLevel, StateData, VicePresidencyData, YearValue } from "../../types/economic-dashboard";
import { formatCurrencyBRL, formatPercent } from "../../lib/formatters";
import { geoJsonSources } from "../../data/geojson-placeholders";

type RankingMode = "map" | "vice-presidency-ranking" | "municipality-ranking";

type Props = {
  level: SelectedLevel;
  selectedYear: number;
  selectedVicePresidency?: VicePresidencyData;
  selectedMunicipality?: MunicipalityData;
  state: StateData;
  vicePresidencies: VicePresidencyData[];
  municipalities: MunicipalityData[];
  onYearChange: (year: number) => void;
  onVicePresidencyClick: (name: string) => void;
  onMunicipalityClick: (name: string) => void;
};

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
        return [`<strong>${item.name}</strong>`, `Ranking: ${data.rank}º`, `PIB: ${formatCurrencyBRL(data.value)}`].join("<br />");
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
  selectedVicePresidency,
  selectedMunicipality,
  state,
  vicePresidencies,
  municipalities,
  onYearChange,
  onVicePresidencyClick,
  onMunicipalityClick
}: Props) {
  const [mapState, setMapState] = useState<{ name: string; ready: boolean }>({ name: "sc-vice-presidencias", ready: false });
  const [viewMode, setViewMode] = useState<RankingMode>("map");
  const [rankingAutoPlay, setRankingAutoPlay] = useState(false);
  const [municipalitySearch, setMunicipalitySearch] = useState("");

  useEffect(() => {
    setViewMode("map");
    setRankingAutoPlay(false);
    setMunicipalitySearch("");
  }, [level, selectedVicePresidency?.id]);

  useEffect(() => {
    const source = level === "state" ? geoJsonSources.vicePresidencies : geoJsonSources.municipalities;
    fetch(source)
      .then((response) => response.json())
      .then((geoJson) => {
        const filtered =
          level === "state" || !selectedVicePresidency
            ? geoJson
            : {
                ...geoJson,
                features: geoJson.features.filter(
                  (feature: any) => feature.properties.vicePresidency === selectedVicePresidency.name
                )
              };
        const name = level === "state" ? "sc-vice-presidencias" : `municipios-${selectedVicePresidency?.id ?? "sc"}`;
        echarts.registerMap(name, filtered);
        setMapState({ name, ready: true });
      });
  }, [level, selectedVicePresidency]);

  useEffect(() => {
    if (!rankingAutoPlay) return undefined;

    const interval = window.setInterval(() => {
      if (selectedYear >= 2030) {
        setRankingAutoPlay(false);
        onYearChange(2030);
        return;
      }
      onYearChange(selectedYear + 1);
    }, 1100);

    return () => window.clearInterval(interval);
  }, [onYearChange, rankingAutoPlay, selectedYear]);

  const years = state.pibSeries.map((row) => row.year).filter((year) => year >= 2023 && year <= 2030);
  const rows = useMemo(() => {
    if (level === "state") {
      return vicePresidencies.map((item) => {
        const row = item.pibSeries.find((entry) => entry.year === selectedYear)!;
        return {
          name: item.name,
          value: row.growth,
          pib: row.pib,
          share: item.stateShareByYear[selectedYear],
          growth: row.growth,
          cagr: item.cagr2023_2030
        };
      });
    }

    const scope = municipalities.filter((item) => item.vicePresidencyId === selectedVicePresidency?.id);
    return scope.map((item) => {
      const row = item.pibSeries.find((entry) => entry.year === selectedYear)!;
      return {
        name: item.name,
        selected: item.id === selectedMunicipality?.id,
        value: row.growth,
        pib: row.pib,
        share: item.vicePresidencyShareByYear[selectedYear],
        growth: row.growth,
        cagr: item.cagr2023_2030
      };
    });
  }, [level, municipalities, selectedMunicipality, selectedVicePresidency, selectedYear, vicePresidencies]);

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
      text: ["Maior crescimento", "Menor crescimento"],
      inRange: { color: ["#f3f8f5", "#bfe4d4", "#4db6a2", "#0e554d"] },
      textStyle: { color: "#5f6d66" }
    },
    animationDuration: 450,
    animationDurationUpdate: 650,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicOut",
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
    viewMode === "vice-presidency-ranking"
      ? vicePresidencies.map((item) => ({ name: item.name, series: item.pibSeries }))
      : municipalities
          .filter((item) => level === "state" || item.vicePresidencyId === selectedVicePresidency?.id)
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
          selectedYear,
          visibleCount: viewMode === "municipality-ranking" ? 25 : 12,
          title:
            viewMode === "vice-presidency-ranking"
              ? "PIB das vice-presidências por ano"
              : level === "state"
                ? "PIB dos municípios de Santa Catarina por ano"
                : `PIB dos municípios de ${selectedVicePresidency?.name ?? ""} por ano`
        });

  const mapEvents = useMemo(
    () => ({
      click: (params: any) => {
        if (!params.name) return;
        if (level === "state") onVicePresidencyClick(params.name);
        else onMunicipalityClick(params.name);
      }
    }),
    [level, onMunicipalityClick, onVicePresidencyClick]
  );

  const rankingEvents = useMemo(
    () => ({
      click: (params: any) => {
        if (!params.name) return;
        if (viewMode === "vice-presidency-ranking") onVicePresidencyClick(params.name);
        else onMunicipalityClick(params.name);
      }
    }),
    [onMunicipalityClick, onVicePresidencyClick, viewMode]
  );

  return (
    <section className="map-card">
      <div className="section-heading map-heading">
        <div>
          <div className="section-title-row">
            <h2>
              {viewMode === "map"
                ? level === "state"
                  ? "Mapa por vice-presidência"
                  : `Municípios de ${selectedVicePresidency?.name}`
                : viewMode === "vice-presidency-ranking"
                  ? "Ranking de vice-presidências"
                  : "Ranking municipal"}
            </h2>
            {viewMode === "map" ? (
              <span className="info-tooltip" tabIndex={0} aria-label="O mapa de calor usa a taxa de crescimento anual do PIB no ano selecionado.">
                i
              </span>
            ) : null}
          </div>
          <p>{viewMode === "map" ? "Cor por crescimento anual no ano selecionado" : "Barras por PIB anual, com animação temporal até 2030"}</p>
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
              Mapa
            </button>
            {level === "state" ? (
              <button
                className={viewMode === "vice-presidency-ranking" ? "active" : ""}
                onClick={() => {
                  onYearChange(2023);
                  setRankingAutoPlay(true);
                  setMunicipalitySearch("");
                  setViewMode("vice-presidency-ranking");
                }}
              >
                Ranking de vice-presidências
              </button>
            ) : null}
            <button
              className={viewMode === "municipality-ranking" ? "active" : ""}
              onClick={() => {
                onYearChange(2023);
                setRankingAutoPlay(true);
                setViewMode("municipality-ranking");
              }}
            >
              Ranking municipal
            </button>
          </div>
          <button
            className={rankingAutoPlay ? "active" : ""}
            onClick={() => {
              if (selectedYear >= 2030) onYearChange(2023);
              setRankingAutoPlay(true);
            }}
          >
            Animar anos
          </button>
          <select
            value={selectedYear}
            onChange={(event) => {
              setRankingAutoPlay(false);
              onYearChange(Number(event.target.value));
            }}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          {viewMode === "municipality-ranking" ? (
            <input
              className="map-search"
              type="search"
              value={municipalitySearch}
              onChange={(event) => {
                setRankingAutoPlay(false);
                setMunicipalitySearch(event.target.value);
              }}
              placeholder="Buscar município"
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
        <div className="ranking-empty">Nenhum município encontrado para a busca.</div>
      ) : rankingOption ? (
        <EChart option={rankingOption} height={620} onEvents={rankingEvents} />
      ) : (
        <div className="map-loading" />
      )}
    </section>
  );
}
