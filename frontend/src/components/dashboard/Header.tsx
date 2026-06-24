"use client";

import type { SelectedLevel } from "../../types/economic-dashboard";

type Props = {
  selectedLevel: SelectedLevel;
  mode: "pib" | "per-capita";
  selectedVicePresidency?: string;
  selectedMunicipality?: string;
  onModeChange: (mode: "pib" | "per-capita") => void;
  onBreadcrumbClick: (level: SelectedLevel) => void;
  onBack: () => void;
};

export default function Header({
  selectedLevel,
  mode,
  selectedVicePresidency,
  selectedMunicipality,
  onModeChange,
  onBreadcrumbClick,
  onBack
}: Props) {
  return (
    <header className="economic-header">
      <div className="economic-title-block">
        <p>Santa Catarina</p>
        <h1>{mode === "per-capita" ? "PIB per capita Municipal de Santa Catarina" : "Projeções do PIB Municipal de Santa Catarina"}</h1>
        <span>Painel top-down: Estado → Vice-presidência → Município</span>
      </div>

      <div className="economic-toolbar">
        <nav className="breadcrumb" aria-label="Navegação territorial">
          <button onClick={() => onBreadcrumbClick("state")}>Santa Catarina</button>
          {selectedVicePresidency ? (
            <>
              <span>/</span>
              <button onClick={() => onBreadcrumbClick("vice-presidency")}>{selectedVicePresidency}</button>
            </>
          ) : null}
          {selectedMunicipality ? (
            <>
              <span>/</span>
              <button onClick={() => onBreadcrumbClick("municipality")}>{selectedMunicipality}</button>
            </>
          ) : null}
        </nav>

        <div className="dashboard-mode-toggle mini-toggle" aria-label="Selecionar versão do painel">
          <button className={mode === "pib" ? "active" : ""} onClick={() => onModeChange("pib")}>
            PIB
          </button>
          <button className={mode === "per-capita" ? "active" : ""} onClick={() => onModeChange("per-capita")}>
            PIB per capita
          </button>
        </div>

        {selectedLevel !== "state" ? (
          <button className="outline-action" onClick={onBack}>
            Voltar nível
          </button>
        ) : null}
      </div>
    </header>
  );
}
