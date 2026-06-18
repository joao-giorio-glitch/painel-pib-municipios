"use client";

import type { SelectedLevel, SelectedMetric } from "../../types/economic-dashboard";

type Props = {
  selectedYear: number;
  selectedLevel: SelectedLevel;
  selectedMetric: SelectedMetric;
  selectedMesoregion?: string;
  selectedMunicipality?: string;
  onYearChange: (year: number) => void;
  onMetricChange: (metric: SelectedMetric) => void;
  onBreadcrumbClick: (level: SelectedLevel) => void;
  onBack: () => void;
};

export default function Header({
  selectedYear,
  selectedLevel,
  selectedMetric,
  selectedMesoregion,
  selectedMunicipality,
  onYearChange,
  onMetricChange,
  onBreadcrumbClick,
  onBack
}: Props) {
  const years = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
  const metrics: Array<{ value: SelectedMetric; label: string }> = [
    { value: "pib", label: "PIB" },
    { value: "share", label: "Participação" },
    { value: "growth", label: "Crescimento" }
  ];

  return (
    <header className="economic-header">
      <div className="economic-title-block">
        <p>Santa Catarina</p>
        <h1>Projeções do PIB Municipal de Santa Catarina</h1>
        <span>Painel top-down: Estado → Mesorregião → Município</span>
      </div>

      <div className="economic-toolbar">
        <nav className="breadcrumb" aria-label="Navegação territorial">
          <button onClick={() => onBreadcrumbClick("state")}>Santa Catarina</button>
          {selectedMesoregion ? (
            <>
              <span>/</span>
              <button onClick={() => onBreadcrumbClick("mesoregion")}>{selectedMesoregion}</button>
            </>
          ) : null}
          {selectedMunicipality ? (
            <>
              <span>/</span>
              <button onClick={() => onBreadcrumbClick("municipality")}>{selectedMunicipality}</button>
            </>
          ) : null}
        </nav>

        {selectedLevel !== "state" ? (
          <button className="outline-action" onClick={onBack}>
            Voltar nível
          </button>
        ) : null}

        <select value={selectedYear} onChange={(event) => onYearChange(Number(event.target.value))}>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <div className="metric-toggle">
          {metrics.map((metric) => (
            <button
              key={metric.value}
              className={selectedMetric === metric.value ? "active" : ""}
              onClick={() => onMetricChange(metric.value)}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

