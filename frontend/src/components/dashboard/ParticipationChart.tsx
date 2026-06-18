"use client";

import EChart from "../../../components/EChart";
import Card from "../ui/Card";
import type { MesoregionData, MunicipalityData, SelectedLevel } from "../../types/economic-dashboard";
import { formatPercent } from "../../lib/formatters";

type Props = {
  level: SelectedLevel;
  selectedYear: number;
  selectedMesoregion?: MesoregionData;
  selectedMunicipality?: MunicipalityData;
  mesoregions: MesoregionData[];
  municipalities: MunicipalityData[];
  onMesoregionSelect: (name: string) => void;
  onMunicipalitySelect: (name: string) => void;
};

export default function ParticipationChart({
  level,
  selectedYear,
  selectedMesoregion,
  selectedMunicipality,
  mesoregions,
  municipalities,
  onMesoregionSelect,
  onMunicipalitySelect
}: Props) {
  if (level === "municipality" && selectedMunicipality) {
    const regionalRank =
      municipalities
        .filter((item) => item.mesoregionId === selectedMunicipality.mesoregionId)
        .sort((a, b) => (b.mesoregionShareByYear[selectedYear] ?? 0) - (a.mesoregionShareByYear[selectedYear] ?? 0))
        .findIndex((item) => item.id === selectedMunicipality.id) + 1;
    const stateRank =
      [...municipalities]
        .sort((a, b) => (b.stateShareByYear[selectedYear] ?? 0) - (a.stateShareByYear[selectedYear] ?? 0))
        .findIndex((item) => item.id === selectedMunicipality.id) + 1;

    return (
      <Card title="Participação territorial">
        <div className="composition-grid">
          <div>
            <span>Na mesorregião</span>
            <strong>{formatPercent(selectedMunicipality.mesoregionShareByYear[selectedYear])}</strong>
          </div>
          <div>
            <span>No estado</span>
            <strong>{formatPercent(selectedMunicipality.stateShareByYear[selectedYear])}</strong>
          </div>
          <div>
            <span>Ranking regional</span>
            <strong>{regionalRank}º</strong>
          </div>
          <div>
            <span>Ranking estadual</span>
            <strong>{stateRank}º</strong>
          </div>
        </div>
      </Card>
    );
  }

  const rows =
    level === "state"
      ? mesoregions
          .map((item) => ({ name: item.name, value: item.stateShareByYear[selectedYear] }))
          .sort((a, b) => b.value - a.value)
      : municipalities
          .filter((item) => item.mesoregionId === selectedMesoregion?.id)
          .map((item) => ({ name: item.name, value: item.mesoregionShareByYear[selectedYear] }))
          .sort((a, b) => b.value - a.value);
  const option = {
    tooltip: { trigger: "axis", valueFormatter: (value: number) => formatPercent(value) },
    grid: { left: 122, right: 18, top: 16, bottom: 24 },
    xAxis: { type: "value", axisLabel: { formatter: (value: number) => formatPercent(value) } },
    yAxis: { type: "category", data: rows.map((row) => row.name), inverse: true },
    series: [
      {
        type: "bar",
        data: rows.map((row) => row.value),
        itemStyle: { color: "#2b8c7e", borderRadius: [0, 4, 4, 0] }
      }
    ]
  };
  const events = {
    click: (params: any) => {
      const name = rows[params.dataIndex]?.name;
      if (!name) return;
      if (level === "state") onMesoregionSelect(name);
      else onMunicipalitySelect(name);
    }
  };

  return (
    <Card title={level === "state" ? "Participação das mesorregiões" : "Ranking municipal"}>
      <EChart option={option} height={level === "state" ? 260 : 320} onEvents={events} />
    </Card>
  );
}

