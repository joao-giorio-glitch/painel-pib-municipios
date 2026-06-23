"use client";

import { useMemo, useState } from "react";
import Header from "./Header";
import MapPanel from "./MapPanel";
import KPISection from "./KPISection";
import PibEvolutionChart from "./PibEvolutionChart";
import GrowthAndCagrChart from "./GrowthAndCagrChart";
import ContributionToGrowthChart from "./ContributionToGrowthChart";
import type { SelectedLevel } from "../../types/economic-dashboard";
import { buildDashboardDataset } from "../../lib/build-dashboard-dataset";

export default function EconomicDashboard({ data }: { data: any }) {
  const [mode, setMode] = useState<"pib" | "per-capita">("pib");
  const dataset = useMemo(() => buildDashboardDataset(mode === "per-capita" ? data.perCapita : data.pib), [data, mode]);
  const { state, vicePresidencies, municipalities } = dataset;
  const [selectedYear, setSelectedYear] = useState(2023);
  const [selectedLevel, setSelectedLevel] = useState<SelectedLevel>("state");
  const [selectedVicePresidencyId, setSelectedVicePresidencyId] = useState<string | undefined>();
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string | undefined>();

  const selectedVicePresidency = useMemo(
    () => vicePresidencies.find((item) => item.id === selectedVicePresidencyId),
    [selectedVicePresidencyId, vicePresidencies]
  );
  const selectedMunicipality = useMemo(
    () => municipalities.find((item) => item.id === selectedMunicipalityId),
    [selectedMunicipalityId, municipalities]
  );

  function selectVicePresidency(name: string) {
    const vicePresidency = vicePresidencies.find((item) => item.name === name);
    if (!vicePresidency) return;
    setSelectedVicePresidencyId(vicePresidency.id);
    setSelectedMunicipalityId(undefined);
    setSelectedLevel("vice-presidency");
  }

  function changeMode(nextMode: "pib" | "per-capita") {
    setMode(nextMode);
    setSelectedYear(nextMode === "per-capita" ? 2025 : 2023);
  }

  function selectMunicipality(name: string) {
    const municipality = municipalities.find((item) => item.name === name);
    if (!municipality) return;
    setSelectedVicePresidencyId(municipality.vicePresidencyId);
    setSelectedMunicipalityId(municipality.id);
    setSelectedLevel("municipality");
  }

  function goBack() {
    if (selectedLevel === "municipality") {
      setSelectedMunicipalityId(undefined);
      setSelectedLevel("vice-presidency");
      return;
    }
    setSelectedMunicipalityId(undefined);
    setSelectedVicePresidencyId(undefined);
    setSelectedLevel("state");
  }

  function goToLevel(level: SelectedLevel) {
    if (level === "state") {
      setSelectedLevel("state");
      setSelectedVicePresidencyId(undefined);
      setSelectedMunicipalityId(undefined);
    } else if (level === "vice-presidency" && selectedVicePresidencyId) {
      setSelectedLevel("vice-presidency");
      setSelectedMunicipalityId(undefined);
    }
  }

  return (
    <main className="economic-dashboard">
      <Header
        selectedLevel={selectedLevel}
        mode={mode}
        selectedVicePresidency={selectedVicePresidency?.name}
        selectedMunicipality={selectedMunicipality?.name}
        onModeChange={changeMode}
        onBreadcrumbClick={goToLevel}
        onBack={goBack}
      />

      <section className="dashboard-grid">
        <MapPanel
          level={selectedLevel}
          selectedYear={selectedYear}
          selectedVicePresidency={selectedVicePresidency}
          selectedMunicipality={selectedMunicipality}
          state={state}
          vicePresidencies={vicePresidencies}
          municipalities={municipalities}
          isPerCapita={mode === "per-capita"}
          onYearChange={setSelectedYear}
          onVicePresidencyClick={selectVicePresidency}
          onMunicipalityClick={selectMunicipality}
        />

        <aside className="analysis-panel">
          <KPISection
            level={selectedLevel}
            selectedYear={selectedYear}
            state={state}
            vicePresidency={selectedVicePresidency}
            municipality={selectedMunicipality}
            vicePresidencies={vicePresidencies}
            municipalities={municipalities}
            isPerCapita={mode === "per-capita"}
          />
          <PibEvolutionChart level={selectedLevel} state={state} vicePresidency={selectedVicePresidency} municipality={selectedMunicipality} isPerCapita={mode === "per-capita"} />
          <GrowthAndCagrChart level={selectedLevel} state={state} vicePresidency={selectedVicePresidency} municipality={selectedMunicipality} isPerCapita={mode === "per-capita"} />
          <ContributionToGrowthChart
            level={selectedLevel}
            state={state}
            selectedVicePresidency={selectedVicePresidency}
            selectedMunicipality={selectedMunicipality}
            vicePresidencies={vicePresidencies}
            municipalities={municipalities}
            isPerCapita={mode === "per-capita"}
          />
        </aside>
      </section>
    </main>
  );
}
