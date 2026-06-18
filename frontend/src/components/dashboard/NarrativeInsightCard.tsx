import Card from "../ui/Card";
import type { MesoregionData, MunicipalityData, SelectedLevel, StateData } from "../../types/economic-dashboard";
import { formatPercent } from "../../lib/formatters";

type Props = {
  level: SelectedLevel;
  selectedYear: number;
  state: StateData;
  selectedMesoregion?: MesoregionData;
  selectedMunicipality?: MunicipalityData;
  mesoregions: MesoregionData[];
  municipalities: MunicipalityData[];
};

export default function NarrativeInsightCard({
  level,
  selectedYear,
  state,
  selectedMesoregion,
  selectedMunicipality,
  mesoregions,
  municipalities
}: Props) {
  const leaderMeso = [...mesoregions].sort((a, b) => (b.stateShareByYear[selectedYear] ?? 0) - (a.stateShareByYear[selectedYear] ?? 0))[0];
  const growthMeso = [...mesoregions].sort((a, b) => b.cagr2023_2030 - a.cagr2023_2030)[0];

  const text =
    level === "state"
      ? `Em ${selectedYear}, ${leaderMeso.name} concentra ${formatPercent(
          leaderMeso.stateShareByYear[selectedYear]
        )} do PIB estadual. Entre 2023 e 2030, o PIB catarinense cresce a ${formatPercent(
          state.cagr2023_2030
        )} ao ano, com maior dinamismo projetado em ${growthMeso.name}.`
      : level === "mesoregion" && selectedMesoregion
        ? (() => {
            const scope = municipalities.filter((item) => item.mesoregionId === selectedMesoregion.id);
            const shareLeader = [...scope].sort((a, b) => (b.mesoregionShareByYear[selectedYear] ?? 0) - (a.mesoregionShareByYear[selectedYear] ?? 0))[0];
            const growthLeader = [...scope].sort((a, b) => b.cagr2023_2030 - a.cagr2023_2030)[0];
            return `${selectedMesoregion.name} representa ${formatPercent(
              selectedMesoregion.stateShareByYear[selectedYear]
            )} do PIB de Santa Catarina. ${shareLeader.name} lidera a participacao regional, enquanto ${
              growthLeader.name
            } apresenta a maior taxa composta de crescimento projetada.`;
          })()
        : selectedMunicipality
          ? `${selectedMunicipality.name} representa ${formatPercent(
              selectedMunicipality.mesoregionShareByYear[selectedYear]
            )} do PIB da mesorregiao e ${formatPercent(
              selectedMunicipality.stateShareByYear[selectedYear]
            )} do PIB estadual. Seu crescimento projetado pode ser comparado a trajetoria regional e estadual nos graficos acima.`
          : "";

  return (
    <Card title="Leitura economica automatica" className="narrative-card">
      <p>{text}</p>
    </Card>
  );
}
