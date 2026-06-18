import Card from "../ui/Card";
import type { MesoregionData, MunicipalityData, SelectedLevel, StateData } from "../../types/economic-dashboard";
import { formatCurrencyBRL, formatPercent } from "../../lib/formatters";

type Props = {
  level: SelectedLevel;
  selectedYear: number;
  state: StateData;
  mesoregion?: MesoregionData;
  municipality?: MunicipalityData;
  mesoregions: MesoregionData[];
  municipalities: MunicipalityData[];
};

function rowForYear(series: { year: number; pib: number; growth: number }[], year: number) {
  return series.find((row) => row.year === year) ?? series[0];
}

export default function KPISection({ level, selectedYear, state, mesoregion, municipality, mesoregions, municipalities }: Props) {
  const stateRow = rowForYear(state.pibSeries, selectedYear);
  const activeMeso = mesoregion ?? mesoregions[0];
  const activeMunicipality = municipality ?? municipalities.find((item) => item.mesoregionId === activeMeso.id) ?? municipalities[0];
  const mesoRow = rowForYear(activeMeso.pibSeries, selectedYear);
  const muniRow = rowForYear(activeMunicipality.pibSeries, selectedYear);

  const largestMeso = [...mesoregions].sort(
    (a, b) => (b.stateShareByYear[selectedYear] ?? 0) - (a.stateShareByYear[selectedYear] ?? 0)
  )[0];
  const fastestMeso = [...mesoregions].sort((a, b) => b.cagr2023_2030 - a.cagr2023_2030)[0];
  const regionalMunicipalities = municipalities.filter((item) => item.mesoregionId === activeMeso.id);
  const largestMunicipality = [...regionalMunicipalities].sort(
    (a, b) => (b.mesoregionShareByYear[selectedYear] ?? 0) - (a.mesoregionShareByYear[selectedYear] ?? 0)
  )[0];

  const kpis =
    level === "state"
      ? [
          ["PIB de SC", formatCurrencyBRL(stateRow.pib)],
          ["Crescimento anual", formatPercent(stateRow.growth)],
          ["CAGR 2023-2030", formatPercent(state.cagr2023_2030)],
          ["Maior participação", largestMeso.name],
          ["Maior crescimento", fastestMeso.name]
        ]
      : level === "mesoregion"
        ? [
            ["PIB da mesorregião", formatCurrencyBRL(mesoRow.pib)],
            ["Participação em SC", formatPercent(activeMeso.stateShareByYear[selectedYear])],
            ["Crescimento anual", formatPercent(mesoRow.growth)],
            ["CAGR 2023-2030", formatPercent(activeMeso.cagr2023_2030)],
            ["Município líder", largestMunicipality?.name ?? "-"]
          ]
        : [
            ["PIB do município", formatCurrencyBRL(muniRow.pib)],
            ["Part. na mesorregião", formatPercent(activeMunicipality.mesoregionShareByYear[selectedYear])],
            ["Part. em SC", formatPercent(activeMunicipality.stateShareByYear[selectedYear])],
            ["Crescimento anual", formatPercent(muniRow.growth)],
            ["CAGR 2023-2030", formatPercent(activeMunicipality.cagr2023_2030)]
          ];

  return (
    <div className="kpi-grid">
      {kpis.map(([label, value]) => (
        <Card key={label} className="kpi-card">
          <span>{label}</span>
          <strong>{value}</strong>
        </Card>
      ))}
    </div>
  );
}

