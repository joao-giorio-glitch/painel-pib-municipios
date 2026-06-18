export type SelectedLevel = "state" | "mesoregion" | "municipality";
export type SelectedMetric = "pib" | "share" | "growth";

export type YearValue = {
  year: number;
  pib: number;
  growth: number;
  isProjected: boolean;
};

export type MesoregionData = {
  id: string;
  name: string;
  pibSeries: YearValue[];
  cagr2023_2030: number;
  stateShareByYear: Record<number, number>;
};

export type MunicipalityData = {
  id: string;
  name: string;
  mesoregionId: string;
  pibSeries: YearValue[];
  cagr2023_2030: number;
  mesoregionShareByYear: Record<number, number>;
  stateShareByYear: Record<number, number>;
};

export type StateData = {
  name: string;
  pibSeries: YearValue[];
  cagr2023_2030: number;
};
