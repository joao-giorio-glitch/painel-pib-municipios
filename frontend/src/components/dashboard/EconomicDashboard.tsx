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
  const dataset = useMemo(() => buildDashboardDataset(data), [data]);
  const { state, mesoregions, municipalities } = dataset;
  const [selectedYear, setSelectedYear] = useState(2023);
  const [selectedLevel, setSelectedLevel] = useState<SelectedLevel>("state");
  const [selectedMesoregionId, setSelectedMesoregionId] = useState<string | undefined>();
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string | undefined>();

  const selectedMesoregion = useMemo(
    () => mesoregions.find((item) => item.id === selectedMesoregionId),
    [selectedMesoregionId]
  );
  const selectedMunicipality = useMemo(
    () => municipalities.find((item) => item.id === selectedMunicipalityId),
    [selectedMunicipalityId]
  );

  function selectMesoregion(name: string) {
    const mesoregion = mesoregions.find((item) => item.name === name);
    if (!mesoregion) return;
    setSelectedMesoregionId(mesoregion.id);
    setSelectedMunicipalityId(undefined);
    setSelectedLevel("mesoregion");
  }

  function selectMunicipality(name: string) {
    const municipality = municipalities.find((item) => item.name === name);
    if (!municipality) return;
    setSelectedMesoregionId(municipality.mesoregionId);
    setSelectedMunicipalityId(municipality.id);
    setSelectedLevel("municipality");
  }

  function goBack() {
    if (selectedLevel === "municipality") {
      setSelectedMunicipalityId(undefined);
      setSelectedLevel("mesoregion");
      return;
    }
    setSelectedMunicipalityId(undefined);
    setSelectedMesoregionId(undefined);
    setSelectedLevel("state");
  }

  function goToLevel(level: SelectedLevel) {
    if (level === "state") {
      setSelectedLevel("state");
      setSelectedMesoregionId(undefined);
      setSelectedMunicipalityId(undefined);
    } else if (level === "mesoregion" && selectedMesoregionId) {
      setSelectedLevel("mesoregion");
      setSelectedMunicipalityId(undefined);
    }
  }

  return (
    <main className="economic-dashboard">
      <Header
        selectedLevel={selectedLevel}
        selectedMesoregion={selectedMesoregion?.name}
        selectedMunicipality={selectedMunicipality?.name}
        onBreadcrumbClick={goToLevel}
        onBack={goBack}
      />

      <section className="dashboard-grid">
        <MapPanel
          level={selectedLevel}
          selectedYear={selectedYear}
          selectedMesoregion={selectedMesoregion}
          selectedMunicipality={selectedMunicipality}
          state={state}
          mesoregions={mesoregions}
          municipalities={municipalities}
          onYearChange={setSelectedYear}
          onMesoregionClick={selectMesoregion}
          onMunicipalityClick={selectMunicipality}
        />

        <aside className="analysis-panel">
          <KPISection
            level={selectedLevel}
            selectedYear={selectedYear}
            state={state}
            mesoregion={selectedMesoregion}
            municipality={selectedMunicipality}
            mesoregions={mesoregions}
            municipalities={municipalities}
          />
          <PibEvolutionChart level={selectedLevel} state={state} mesoregion={selectedMesoregion} municipality={selectedMunicipality} />
          <GrowthAndCagrChart level={selectedLevel} state={state} mesoregion={selectedMesoregion} municipality={selectedMunicipality} />
          <ContributionToGrowthChart
            level={selectedLevel}
            state={state}
            selectedMesoregion={selectedMesoregion}
            selectedMunicipality={selectedMunicipality}
            mesoregions={mesoregions}
            municipalities={municipalities}
          />
        </aside>
      </section>
    </main>
  );
}
