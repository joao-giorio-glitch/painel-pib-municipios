import Card from "../ui/Card";
import type { MunicipalityData, SelectedLevel, StateData, VicePresidencyData } from "../../types/economic-dashboard";
import { formatCurrencyBRL, formatPerCapitaBRL, formatPercent } from "../../lib/formatters";

type Props = {
  level: SelectedLevel;
  selectedYear: number;
  state: StateData;
  vicePresidency?: VicePresidencyData;
  municipality?: MunicipalityData;
  vicePresidencies: VicePresidencyData[];
  municipalities: MunicipalityData[];
  isPerCapita?: boolean;
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

export default function KPISection({
  level,
  selectedYear,
  state,
  vicePresidency,
  municipality,
  vicePresidencies,
  municipalities,
  isPerCapita = false
}: Props) {
  const stateRow = rowForYear(state.pibSeries, selectedYear);
  const activeVicePresidency = vicePresidency ?? vicePresidencies[0];
  const activeMunicipality =
    municipality ?? municipalities.find((item) => item.vicePresidencyId === activeVicePresidency.id) ?? municipalities[0];
  const vicePresidencyRow = rowForYear(activeVicePresidency.pibSeries, selectedYear);
  const municipalityRow = rowForYear(activeMunicipality.pibSeries, selectedYear);

  const largestVicePresidency = [...vicePresidencies].sort(
    (a, b) => (b.stateShareByYear[selectedYear] ?? 0) - (a.stateShareByYear[selectedYear] ?? 0)
  )[0];
  const fastestVicePresidency = [...vicePresidencies].sort(
    (a, b) => rowForYear(b.pibSeries, selectedYear).growth - rowForYear(a.pibSeries, selectedYear).growth
  )[0];
  const vicePresidencyMunicipalities = municipalities.filter((item) => item.vicePresidencyId === activeVicePresidency.id);
  const largestMunicipality = [...vicePresidencyMunicipalities].sort(
    (a, b) => (b.vicePresidencyShareByYear[selectedYear] ?? 0) - (a.vicePresidencyShareByYear[selectedYear] ?? 0)
  )[0];
  const vicePresidencyRank = rankByShare(
    vicePresidencyMunicipalities,
    activeMunicipality.id,
    (item) => item.vicePresidencyShareByYear[selectedYear] ?? 0
  );
  const stateRank = rankByShare(municipalities, activeMunicipality.id, (item) => item.stateShareByYear[selectedYear] ?? 0);
  const formatValue = isPerCapita ? formatPerCapitaBRL : formatCurrencyBRL;
  const measureName = isPerCapita ? "PIB per capita" : "PIB";
  const cagrLabel = `CAGR ${state.pibSeries[0]?.year ?? 2023}-${state.pibSeries.at(-1)?.year ?? 2030}`;

  const kpis: KpiItem[] =
    level === "state"
      ? [
          { label: `${measureName} de SC`, value: formatValue(stateRow.pib) },
          { label: "Crescimento anual", value: formatPercent(stateRow.growth), tooltip: "Variação do PIB em relação ao ano anterior." },
          { label: cagrLabel, value: formatPercent(state.cagr2023_2030), tooltip: `Taxa anual composta entre ${state.pibSeries[0]?.year ?? 2023} e ${state.pibSeries.at(-1)?.year ?? 2030}.` },
          { label: "Maior participação", value: largestVicePresidency.name },
          { label: "Maior crescimento", value: fastestVicePresidency.name }
        ]
      : level === "vice-presidency"
        ? [
            { label: `${measureName} da vice-presidência`, value: formatValue(vicePresidencyRow.pib) },
            { label: "Participação em SC", value: formatPercent(activeVicePresidency.stateShareByYear[selectedYear]) },
            { label: "Crescimento anual", value: formatPercent(vicePresidencyRow.growth), tooltip: "Variação do PIB da vice-presidência em relação ao ano anterior." },
            { label: cagrLabel, value: formatPercent(activeVicePresidency.cagr2023_2030), tooltip: `Taxa anual composta entre ${state.pibSeries[0]?.year ?? 2023} e ${state.pibSeries.at(-1)?.year ?? 2030}.` },
            { label: "Município líder", value: largestMunicipality?.name ?? "-" }
          ]
        : [
            { label: `${measureName} do município`, value: formatValue(municipalityRow.pib) },
            { label: "Part. na vice-presidência", value: formatPercent(activeMunicipality.vicePresidencyShareByYear[selectedYear]) },
            { label: "Part. em SC", value: formatPercent(activeMunicipality.stateShareByYear[selectedYear]) },
            { label: "Ranking na vice-presidência", value: formatOrdinal(vicePresidencyRank), tooltip: "Posição do município no PIB da vice-presidência no ano selecionado." },
            { label: "Ranking estadual", value: formatOrdinal(stateRank), tooltip: "Posição do município no PIB de Santa Catarina no ano selecionado." },
            { label: "Crescimento anual", value: formatPercent(municipalityRow.growth), tooltip: "Variação do PIB municipal em relação ao ano anterior." },
            { label: cagrLabel, value: formatPercent(activeMunicipality.cagr2023_2030), tooltip: `Taxa anual composta entre ${state.pibSeries[0]?.year ?? 2023} e ${state.pibSeries.at(-1)?.year ?? 2030}.` }
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
