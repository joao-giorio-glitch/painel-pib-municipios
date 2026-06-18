"use client";

import { useMemo, useState } from "react";
import Header from "./Header";
import MapPanel from "./MapPanel";
import KPISection from "./KPISection";
import PibEvolutionChart from "./PibEvolutionChart";
import GrowthAndCagrChart from "./GrowthAndCagrChart";
import ParticipationChart from "./ParticipationChart";
import ContributionToGrowthChart from "./ContributionToGrowthChart";
import NarrativeInsightCard from "./NarrativeInsightCard";
import type { SelectedLevel, SelectedMetric } from "../../types/economic-dashboard";
import { buildDashboardDataset } from "../../lib/build-dashboard-dataset";

export default function EconomicDashboard({ data }: { data: any }) {
  const dataset = useMemo(() => buildDashboardDataset(data), [data]);
  const { state, mesoregions, municipalities } = dataset;
  const [selectedYear, setSelectedYear] = useState(2023);
  const [selectedLevel, setSelectedLevel] = useState<SelectedLevel>("state");
  const [selectedMesoregionId, setSelectedMesoregionId] = useState<string | undefined>();
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string | undefined>();
  const [selectedMetric, setSelectedMetric] = useState<SelectedMetric>("share");

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
        selectedYear={selectedYear}
        selectedLevel={selectedLevel}
        selectedMetric={selectedMetric}
        selectedMesoregion={selectedMesoregion?.name}
        selectedMunicipality={selectedMunicipality?.name}
        onYearChange={setSelectedYear}
        onMetricChange={setSelectedMetric}
        onBreadcrumbClick={goToLevel}
        onBack={goBack}
      />

      <section className="dashboard-grid">
        <MapPanel
          level={selectedLevel}
          selectedYear={selectedYear}
          selectedMesoregion={selectedMesoregion}
          selectedMunicipality={selectedMunicipality}
          selectedMetric={selectedMetric}
          state={state}
          mesoregions={mesoregions}
          municipalities={municipalities}
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
          <ParticipationChart
            level={selectedLevel}
            selectedYear={selectedYear}
            selectedMesoregion={selectedMesoregion}
            selectedMunicipality={selectedMunicipality}
            mesoregions={mesoregions}
            municipalities={municipalities}
            onMesoregionSelect={selectMesoregion}
            onMunicipalitySelect={selectMunicipality}
          />
          <ContributionToGrowthChart
            level={selectedLevel}
            state={state}
            selectedMesoregion={selectedMesoregion}
            selectedMunicipality={selectedMunicipality}
            mesoregions={mesoregions}
            municipalities={municipalities}
          />
          <NarrativeInsightCard
            level={selectedLevel}
            selectedYear={selectedYear}
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
