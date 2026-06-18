"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as echarts from "echarts";
import EChart from "./EChart";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0
});

const compactCurrencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2
});

const palette = ["#157f73", "#4d7ea8", "#7f5a83", "#b35d3a", "#6f7d44"];

function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

function formatCompactCurrency(value) {
  return compactCurrencyFormatter.format(value || 0);
}

function formatPercent(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value)}%`;
}

function buildSeries(rows, unitKey) {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row[unitKey])) {
      map.set(row[unitKey], []);
    }
    map.get(row[unitKey]).push(row);
  });

  map.forEach((value) => value.sort((a, b) => a.year - b.year));
  return map;
}

function metricMap(summary) {
  return new Map(summary.map((item) => [item.unit, item]));
}

function mergeRowMetric(row, metric) {
  return {
    ...row,
    cagrPercent: metric?.cagrPercent ?? null,
    basePib: metric?.basePib ?? null
  };
}

function buildMapOption({ rows, mapName, title, minValue, maxValue }) {
  return {
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const data = params.data;
        if (!data) {
          return params.name;
        }

        return [
          `<strong>${params.name}</strong>`,
          `CAGR proj.: ${formatPercent(data.value, 2)}`,
          `PIB 2023: ${formatCompactCurrency(data.basePib)}`,
          `PIB 2030: ${formatCompactCurrency(data.finalPib)}`
        ].join("<br />");
      }
    },
    visualMap: {
      min: minValue,
      max: maxValue,
      left: 12,
      bottom: 12,
      text: ["Maior CAGR", "Menor CAGR"],
      calculable: true,
      inRange: { color: ["#dce8e2", "#85b9a9", "#157f73", "#0d4f48"] },
      textStyle: { color: "#66716b" }
    },
    series: [
      {
        name: title,
        type: "map",
        map: mapName,
        roam: true,
        selectedMode: "single",
        emphasis: {
          label: { show: true, color: "#202523" },
          itemStyle: { areaColor: "#f1c66d" }
        },
        itemStyle: {
          borderColor: "#ffffff",
          borderWidth: 0.8
        },
        data: rows.map((row) => ({
          name: row.name,
          value: row.cagrPercent,
          basePib: row.basePib,
          finalPib: row.finalPib
        }))
      }
    ]
  };
}

function buildTimeSeriesOption({ years, selectedSeries, maxObservedYear }) {
  const series = [];

  selectedSeries.forEach((item, index) => {
    const color = palette[index % palette.length];
    const observedData = years.map((year) => {
      const row = item.rows.find((entry) => entry.year === year);
      return row && year <= maxObservedYear ? row.pib : null;
    });
    const projectedData = years.map((year) => {
      const row = item.rows.find((entry) => entry.year === year);
      if (!row) {
        return null;
      }

      return year >= maxObservedYear ? row.pib : null;
    });

    series.push({
      name: `${item.label} observado`,
      type: "line",
      smooth: true,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: item.isContext ? 2 : 3, color },
      itemStyle: { color },
      data: observedData
    });
    series.push({
      name: `${item.label} projetado`,
      type: "line",
      smooth: true,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: item.isContext ? 2 : 3, type: "dashed", color: "#c97f2d" },
      itemStyle: { color: "#c97f2d" },
      data: projectedData
    });
  });

  return {
    color: palette,
    tooltip: {
      trigger: "axis",
      valueFormatter: (value) => formatCompactCurrency(value)
    },
    legend: {
      type: "scroll",
      top: 0,
      textStyle: { color: "#66716b" }
    },
    grid: { left: 58, right: 24, top: 54, bottom: 36 },
    xAxis: { type: "category", data: years, boundaryGap: false },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: (value) => compactCurrencyFormatter.format(value).replace("R$", "R$ ")
      }
    },
    series
  };
}

function getTableRows({ mode, viewLevel, selectedMesoregion, municipios2023, mesos2023, municipalityMetrics, mesoMetrics }) {
  const source =
    viewLevel === "mesoregions"
      ? mesos2023.map((row) => mergeRowMetric({ name: row.mesoregion, pib: row.pib, type: "mesoregion" }, mesoMetrics.get(row.mesoregion)))
      : municipios2023
          .filter((row) => row.mesoregion === selectedMesoregion)
          .map((row) =>
            mergeRowMetric(
              {
                name: row.municipio,
                pib: row.pib,
                mesoregion: row.mesoregion,
                type: "municipality"
              },
              municipalityMetrics.get(row.municipio)
            )
          );

  return [...source]
    .sort((a, b) => {
      if (mode === "growth") {
        return (b.cagrPercent ?? -Infinity) - (a.cagrPercent ?? -Infinity);
      }

      return b.pib - a.pib;
    })
    .slice(0, 18);
}

export default function PibDashboard({ data }) {
  const { metadata, municipios, mesos, sc, metrics } = data;
  const [viewLevel, setViewLevel] = useState("mesoregions");
  const [selectedMesoregion, setSelectedMesoregion] = useState(metadata.mesoregions[0]);
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [tableMode, setTableMode] = useState("ranking");
  const [mapGeoJson, setMapGeoJson] = useState(null);

  const municipalityMetrics = useMemo(() => metricMap(metrics.municipios.summary), [metrics.municipios.summary]);
  const mesoMetrics = useMemo(() => metricMap(metrics.mesoregions.summary), [metrics.mesoregions.summary]);
  const municipioSeries = useMemo(() => buildSeries(municipios.filter((row) => !row.isStateTotal), "municipio"), [municipios]);
  const mesoSeries = useMemo(() => buildSeries(mesos, "mesoregion"), [mesos]);
  const scSeries = useMemo(() => sc.sort((a, b) => a.year - b.year), [sc]);
  const municipios2023 = useMemo(
    () => municipios.filter((row) => !row.isStateTotal && row.year === metadata.maxObservedYear),
    [metadata.maxObservedYear, municipios]
  );
  const mesos2023 = useMemo(() => mesos.filter((row) => row.year === metadata.maxObservedYear), [metadata.maxObservedYear, mesos]);

  useEffect(() => {
    const file = viewLevel === "mesoregions" ? "/data/sc-mesorregioes.geojson" : "/data/sc-municipios.geojson";

    fetch(file)
      .then((response) => response.json())
      .then((geoJson) => {
        const filtered =
          viewLevel === "municipalities"
            ? {
                ...geoJson,
                features: geoJson.features.filter((feature) => feature.properties.mesoregion === selectedMesoregion)
              }
            : geoJson;
        const mapName = viewLevel === "mesoregions" ? "sc-mesorregioes" : `sc-municipios-${selectedMesoregion}`;
        echarts.registerMap(mapName, filtered);
        setMapGeoJson({ mapName, geoJson: filtered });
      });
  }, [selectedMesoregion, viewLevel]);

  const mapRows = useMemo(() => {
    if (viewLevel === "mesoregions") {
      return metadata.mesoregions.map((name) => ({
        name,
        ...mesoMetrics.get(name)
      }));
    }

    return municipios2023
      .filter((row) => row.mesoregion === selectedMesoregion)
      .map((row) => ({
        name: row.municipio,
        ...municipalityMetrics.get(row.municipio)
      }));
  }, [metadata.mesoregions, mesoMetrics, municipios2023, municipalityMetrics, selectedMesoregion, viewLevel]);

  const mapOption = useMemo(() => {
    if (!mapGeoJson) {
      return null;
    }

    const values = mapRows.map((row) => row.cagrPercent).filter(Number.isFinite);
    return buildMapOption({
      rows: mapRows,
      mapName: mapGeoJson.mapName,
      title: viewLevel === "mesoregions" ? "CAGR por mesorregião" : `CAGR municipal - ${selectedMesoregion}`,
      minValue: Math.min(...values),
      maxValue: Math.max(...values)
    });
  }, [mapGeoJson, mapRows, selectedMesoregion, viewLevel]);

  const tableRows = useMemo(
    () =>
      getTableRows({
        mode: tableMode,
        viewLevel,
        selectedMesoregion,
        municipios2023,
        mesos2023,
        municipalityMetrics,
        mesoMetrics
      }),
    [mesoMetrics, mesos2023, municipios2023, municipalityMetrics, selectedMesoregion, tableMode, viewLevel]
  );

  const selectedSeries = useMemo(() => {
    const context =
      viewLevel === "municipalities"
        ? {
            label: selectedMesoregion,
            rows: mesoSeries.get(selectedMesoregion) ?? [],
            isContext: true
          }
        : {
            label: "Santa Catarina",
            rows: scSeries,
            isContext: true
          };

    const units = selectedUnits
      .map((unit) => {
        if (unit.type === "mesoregion") {
          return { label: unit.name, rows: mesoSeries.get(unit.name) ?? [] };
        }

        return { label: unit.name, rows: municipioSeries.get(unit.name) ?? [] };
      })
      .filter((unit) => unit.rows.length);

    return [context, ...units].slice(0, 5);
  }, [mesoSeries, municipioSeries, scSeries, selectedMesoregion, selectedUnits, viewLevel]);

  const timeSeriesOption = useMemo(
    () =>
      buildTimeSeriesOption({
        years: metadata.years,
        selectedSeries,
        maxObservedYear: metadata.maxObservedYear
      }),
    [metadata.maxObservedYear, metadata.years, selectedSeries]
  );

  const selectedMetric = selectedUnits.at(-1)
    ? selectedUnits.at(-1).type === "mesoregion"
      ? mesoMetrics.get(selectedUnits.at(-1).name)
      : municipalityMetrics.get(selectedUnits.at(-1).name)
    : viewLevel === "municipalities"
      ? mesoMetrics.get(selectedMesoregion)
      : null;

  const addUnit = useCallback((unit) => {
    setSelectedUnits((current) => {
      const withoutDuplicate = current.filter((item) => item.name !== unit.name || item.type !== unit.type);
      return [...withoutDuplicate, unit].slice(-4);
    });
  }, []);

  const mapEvents = useMemo(
    () => ({
      click: (params) => {
        if (!params.name) {
          return;
        }

        if (viewLevel === "mesoregions") {
          setSelectedMesoregion(params.name);
          setViewLevel("municipalities");
          addUnit({ name: params.name, type: "mesoregion" });
          return;
        }

        addUnit({ name: params.name, type: "municipality" });
      }
    }),
    [addUnit, viewLevel]
  );

  function resetMap() {
    setViewLevel("mesoregions");
    setSelectedUnits([]);
  }

  return (
    <main className="page-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Santa Catarina</p>
          <h1>Projeção do PIB municipal</h1>
        </div>
        <button className="ghost-button" onClick={resetMap}>
          Ver mesorregiões
        </button>
      </section>

      <section className="method-panel">
        <div>
          <h2>Leitura das projeções</h2>
          <p>
            O painel compara a trajetória observada do PIB até 2023 com as projeções anuais de 2024 a 2030 para
            municípios, mesorregiões e Santa Catarina.
          </p>
        </div>
        <div className="formula-box">
          <strong>CAGR = (PIB final / PIB base)^(1 / anos) - 1</strong>
          <span>A taxa anual composta usa 2023 como base e 2030 como ano final.</span>
        </div>
      </section>

      <section className="main-dashboard">
        <article className="panel map-panel">
          <div className="panel-heading">
            <div>
              <h2>{viewLevel === "mesoregions" ? "Mapa por mesorregiões" : `Municípios de ${selectedMesoregion}`}</h2>
              <p>Cor pela taxa anual composta projetada entre 2023 e 2030</p>
            </div>
          </div>
          {mapOption ? <EChart option={mapOption} height={510} onEvents={mapEvents} /> : <div className="loading-box" />}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Séries temporais</h2>
              <p>Observado até 2023 e projetado de 2024 a 2030</p>
            </div>
          </div>
          <EChart option={timeSeriesOption} height={330} />
          <div className="metric-strip">
            <div>
              <span>CAGR projetado</span>
              <strong>{formatPercent(selectedMetric?.cagrPercent, 2)}</strong>
            </div>
            <div>
              <span>PIB 2023</span>
              <strong>{formatCurrency(selectedMetric?.basePib)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <h2>{viewLevel === "mesoregions" ? "Ranking de mesorregiões" : `Ranking municipal - ${selectedMesoregion}`}</h2>
            <p>Clique em uma linha para adicionar a unidade ao gráfico</p>
          </div>
          <div className="segmented">
            <button className={tableMode === "ranking" ? "active" : ""} onClick={() => setTableMode("ranking")}>
              PIB 2023
            </button>
            <button className={tableMode === "growth" ? "active" : ""} onClick={() => setTableMode("growth")}>
              CAGR
            </button>
          </div>
        </div>

        <div className="rank-table">
          <div className="rank-row rank-head">
            <span>#</span>
            <span>Unidade</span>
            <span>PIB 2023</span>
            <span>CAGR proj.</span>
          </div>
          {tableRows.map((row, index) => (
            <button
              className="rank-row"
              key={row.name}
              onClick={() => addUnit({ name: row.name, type: row.type })}
            >
              <span>{index + 1}</span>
              <strong>{row.name}</strong>
              <span>{formatCompactCurrency(row.pib)}</span>
              <span>{formatPercent(row.cagrPercent, 2)}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
