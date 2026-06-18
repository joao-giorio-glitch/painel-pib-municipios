"use client";

import EChart from "../../../components/EChart";
import Card from "../ui/Card";
import type { MesoregionData, MunicipalityData, SelectedLevel, StateData } from "../../types/economic-dashboard";
import { classifyElasticity } from "../../lib/economic-calculations";
import { elasticityInterpretations, elasticityLabels } from "../../data/elasticities";

type Props = {
  level: SelectedLevel;
  state: StateData;
  mesoregion?: MesoregionData;
  municipality?: MunicipalityData;
};

export default function ElasticityRadarChart({ level, state, mesoregion, municipality }: Props) {
  const source =
    level === "municipality" && municipality
      ? municipality.elasticitySource
      : level === "mesoregion" && mesoregion
        ? mesoregion.elasticitySource
        : state.elasticitySource;
  const elasticity =
    level === "municipality" && municipality
      ? municipality.elasticities
      : level === "mesoregion" && mesoregion
        ? mesoregion.elasticities
        : state.elasticities;
  const entries = Object.entries(elasticity).filter(([, value]) => typeof value === "number");

  const option = {
    tooltip: {},
    radar: {
      radius: "62%",
      indicator: entries.map(([key]) => ({ name: elasticityLabels[key as keyof typeof elasticityLabels], max: 1.8 }))
    },
    series: [
      {
        type: "radar",
        areaStyle: { opacity: 0.12 },
        data: [{ value: entries.map(([, value]) => Math.abs(value)), name: "Elasticidade" }]
      }
    ]
  };

  return (
    <Card title="Elasticidades econômicas">
      {source === "synthetic" ? (
        <p className="data-note">
          Coeficientes sintéticos para prototipação; substitua por elasticidades estimadas quando o modelo econométrico
          estiver integrado.
        </p>
      ) : null}
      <EChart option={option} height={260} />
      <div className="elasticity-table">
        {entries.map(([key, value]) => (
          <div key={key}>
            <strong>{elasticityLabels[key as keyof typeof elasticityLabels]}</strong>
            <span>{Number(value).toFixed(2)}</span>
            <p>
              {classifyElasticity(Number(value))}; {elasticityInterpretations[key as keyof typeof elasticityInterpretations]}.
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
