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

type KpiItem = {
  label: string;
  value: string;
  tooltip?: string;
};

function rowForYear(series: { year: number; pib: number; growth: number }[], year: number) {
  return series.find((row) => row.year === year) ?? series[0];
}

function rankByShare<T extends { id: string }>(rows: T[], selectedId: string, getShare: (row: T) => number) {
  return [...rows].sort((a, b) => getShare(b) - getShare(a)).findIndex((item) => item.id === selectedId) + 1;
}

function formatOrdinal(value: number) {
  return value > 0 ? `${value}º` : "-";
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
  const fastestMeso = [...mesoregions].sort(
    (a, b) => rowForYear(b.pibSeries, selectedYear).growth - rowForYear(a.pibSeries, selectedYear).growth
  )[0];
  const regionalMunicipalities = municipalities.filter((item) => item.mesoregionId === activeMeso.id);
  const largestMunicipality = [...regionalMunicipalities].sort(
    (a, b) => (b.mesoregionShareByYear[selectedYear] ?? 0) - (a.mesoregionShareByYear[selectedYear] ?? 0)
  )[0];
  const regionalRank = rankByShare(
    regionalMunicipalities,
    activeMunicipality.id,
    (item) => item.mesoregionShareByYear[selectedYear] ?? 0
  );
  const stateRank = rankByShare(municipalities, activeMunicipality.id, (item) => item.stateShareByYear[selectedYear] ?? 0);

  const kpis: KpiItem[] =
    level === "state"
      ? [
          { label: "PIB de SC", value: formatCurrencyBRL(stateRow.pib) },
          { label: "Crescimento anual", value: formatPercent(stateRow.growth), tooltip: "Variação do PIB em relação ao ano anterior." },
          { label: "CAGR 2023-2030", value: formatPercent(state.cagr2023_2030), tooltip: "Taxa anual composta entre 2023 e 2030." },
          { label: "Maior participação", value: largestMeso.name },
          { label: "Maior crescimento", value: fastestMeso.name }
        ]
      : level === "mesoregion"
        ? [
            { label: "PIB da mesorregião", value: formatCurrencyBRL(mesoRow.pib) },
            { label: "Participação em SC", value: formatPercent(activeMeso.stateShareByYear[selectedYear]) },
            { label: "Crescimento anual", value: formatPercent(mesoRow.growth), tooltip: "Variação do PIB da mesorregião em relação ao ano anterior." },
            { label: "CAGR 2023-2030", value: formatPercent(activeMeso.cagr2023_2030), tooltip: "Taxa anual composta entre 2023 e 2030." },
            { label: "Município líder", value: largestMunicipality?.name ?? "-" }
          ]
        : [
            { label: "PIB do município", value: formatCurrencyBRL(muniRow.pib) },
            { label: "Part. na mesorregião", value: formatPercent(activeMunicipality.mesoregionShareByYear[selectedYear]) },
            { label: "Part. em SC", value: formatPercent(activeMunicipality.stateShareByYear[selectedYear]) },
            { label: "Ranking regional", value: formatOrdinal(regionalRank), tooltip: "Posição do município no PIB da mesorregião no ano selecionado." },
            { label: "Ranking estadual", value: formatOrdinal(stateRank), tooltip: "Posição do município no PIB de Santa Catarina no ano selecionado." },
            { label: "Crescimento anual", value: formatPercent(muniRow.growth), tooltip: "Variação do PIB municipal em relação ao ano anterior." },
            { label: "CAGR 2023-2030", value: formatPercent(activeMunicipality.cagr2023_2030), tooltip: "Taxa anual composta entre 2023 e 2030." }
          ];

  return (
    <div className="kpi-grid">
      {kpis.map((item) => (
        <Card key={item.label} className="kpi-card">
          <span className="kpi-label-row">
            {item.label}
            {item.tooltip ? (
              <span className="info-tooltip" tabIndex={0} aria-label={item.tooltip}>
                i
              </span>
            ) : null}
          </span>
          <strong>{item.value}</strong>
        </Card>
      ))}
    </div>
  );
}