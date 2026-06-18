export type SelectedLevel = "state" | "mesoregion" | "municipality";
export type SelectedMetric = "pib" | "share" | "growth";

export type YearValue = {
  year: number;
  pib: number;
  growth: number;
  isProjected: boolean;
};

export type ElasticitySet = {
  toState?: number;
  toMesoregion?: number;
  pibBrazil: number;
  pibUSA: number;
  pibChina: number;
  selic: number;
  exchangeRate: number;
};

export type MesoregionData = {
  id: string;
  name: string;
  pibSeries: YearValue[];
  betaToState: number;
  cagr2023_2030: number;
  stateShareByYear: Record<number, number>;
  elasticities: ElasticitySet & { toState: number };
  elasticitySource?: "synthetic" | "estimated" | "provided";
};

export type MunicipalityData = {
  id: string;
  name: string;
  mesoregionId: string;
  pibSeries: YearValue[];
  betaToMesoregion: number;
  betaToState: number;
  cagr2023_2030: number;
  mesoregionShareByYear: Record<number, number>;
  stateShareByYear: Record<number, number>;
  elasticities: ElasticitySet & { toMesoregion: number; toState: number };
  elasticitySource?: "synthetic" | "estimated" | "provided";
};

export type StateData = {
  name: string;
  pibSeries: YearValue[];
  cagr2023_2030: number;
  elasticities: Omit<ElasticitySet, "toState" | "toMesoregion">;
  elasticitySource?: "synthetic" | "estimated" | "provided";
};
