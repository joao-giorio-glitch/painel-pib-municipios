"use client";

import type { SelectedLevel } from "../../types/economic-dashboard";

type Props = {
  selectedLevel: SelectedLevel;
  selectedMesoregion?: string;
  selectedMunicipality?: string;
  onBreadcrumbClick: (level: SelectedLevel) => void;
  onBack: () => void;
};

export default function Header({
  selectedLevel,
  selectedMesoregion,
  selectedMunicipality,
  onBreadcrumbClick,
  onBack
}: Props) {
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
      </div>
    </header>
  );
}