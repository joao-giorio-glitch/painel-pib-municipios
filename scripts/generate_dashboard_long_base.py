"""Gera a base longa que abastece as visualizacoes do painel de PIB.

Fontes: PIB municipios.xlsx, Pop.xlsx e dim_municipio_vice_presidencia.xlsx.
Saida padrao: Dados/Processado/base_long_visualizacoes_pib.xlsx.
"""

from __future__ import annotations

import argparse
import math
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

import pandas as pd


STATE_NAME = "Santa Catarina"
DISPLAY_YEARS = {
    "PIB": list(range(2023, 2031)),
    "PIB per capita": list(range(2023, 2026)),
}
OUTPUT_COLUMNS = ["data", "variavel", "territorio", "componente", "nivel_geo", "valor"]
COMPONENT_LEVEL = "Dados de n\u00edvel"
COMPONENT_GROWTH = "Dados de crescimento"
COMPONENT_CONTRIBUTION = "Contribui\u00e7\u00e3o ao crescimento"
LEVEL_STATE = "Estado"
LEVEL_VP = "Vice-presid\u00eancia"
LEVEL_MUNICIPALITY = "Munic\u00edpio"


def normalized(value: object) -> str:
    """Normaliza cabecalhos, inclusive arquivos que chegaram com acentos corrompidos."""
    text = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]", "", text.lower())


def find_column(columns: list[object], predicate, label: str) -> object:
    matches = [column for column in columns if predicate(normalized(column))]
    if len(matches) != 1:
        raise ValueError(f"Nao foi possivel identificar a coluna {label}: {matches}")
    return matches[0]


def normalize_code(value: object) -> str:
    digits = re.sub(r"\D", "", str(value))
    return digits[-6:].zfill(6) if digits else ""


def value_or_zero(value: object) -> float:
    return 0.0 if pd.isna(value) else float(value)


def growth(current: float, previous: float) -> float:
    return 0.0 if previous == 0 else current / previous - 1


def share(part: float, total: float) -> float:
    return 0.0 if total == 0 else part / total


def date_for(year: int) -> str:
    return f"{year}-01-01"


def read_dimension(path: Path) -> dict[str, str]:
    frame = pd.read_excel(path)
    code_column = find_column(list(frame.columns), lambda key: key.startswith("cd") and "municipio" in key, "codigo IBGE")
    vp_column = find_column(list(frame.columns), lambda key: "vice" in key and "presidencia" in key, "vice-presidencia")
    result = {
        normalize_code(row[code_column]): str(row[vp_column]).strip()
        for _, row in frame.iterrows()
        if normalize_code(row[code_column]) and pd.notna(row[vp_column])
    }
    if not result:
        raise ValueError("A dimensao de municipios e vice-presidencias esta vazia.")
    return result


def read_wide_source(path: Path, value_name: str) -> tuple[dict[str, dict], dict[int, float], list[int]]:
    frame = pd.read_excel(path)
    columns = list(frame.columns)
    code_column = find_column(columns, lambda key: key.startswith("c") and "munic" in key, "codigo municipal")
    name_column = find_column(columns, lambda key: "munic" in key and not key.startswith("c"), "nome municipal")
    years = sorted(int(column) for column in columns if isinstance(column, int) or (isinstance(column, str) and column.isdigit()))
    municipalities: dict[str, dict] = {}
    state_values: dict[int, float] = {}

    for _, row in frame.iterrows():
        name = str(row[name_column]).strip()
        series = {year: value_or_zero(row[year]) for year in years}
        if name == "-":
            state_values = series
            continue
        code = normalize_code(row[code_column])
        if not code:
            raise ValueError(f"Municipio sem codigo em {path.name}: {name}")
        municipalities[code] = {"name": name, value_name: series}

    return municipalities, state_values, years


def read_population(path: Path) -> tuple[dict[str, dict], list[int]]:
    municipalities, _, years = read_wide_source(path, "population")
    return municipalities, years


def build_entities(
    pib_path: Path, population_path: Path, dimension_path: Path
) -> tuple[dict[str, dict], dict[int, float], list[int]]:
    vice_presidency_by_code = read_dimension(dimension_path)
    pib_municipalities, state_total, pib_years = read_wide_source(pib_path, "total_pib")
    population_municipalities, population_years = read_population(population_path)

    missing_vp = sorted(set(pib_municipalities) - set(vice_presidency_by_code))
    missing_population = sorted(set(pib_municipalities) - set(population_municipalities))
    if missing_vp:
        raise ValueError(f"{len(missing_vp)} municipios sem vice-presidencia na dimensao.")
    if missing_population:
        raise ValueError(f"{len(missing_population)} municipios sem populacao.")

    common_years = sorted(set(pib_years) & set(population_years))
    entities = {}
    for code, item in pib_municipalities.items():
        population = population_municipalities[code]["population"]
        entities[code] = {
            "name": item["name"],
            "vice_presidency": vice_presidency_by_code[code],
            "total_pib": item["total_pib"],
            "population": population,
        }

    for year in DISPLAY_YEARS["PIB per capita"] + [2022]:
        invalid = [item["name"] for item in entities.values() if item["population"].get(year, 0) <= 0]
        if invalid:
            raise ValueError(f"Populacao invalida em {year}: {', '.join(invalid[:5])}")

    # O PIB tem projecoes ate 2030; a populacao (e, portanto, o per capita)
    # vai somente ate 2025. O chamador precisa conhecer a extensao completa do PIB.
    return entities, state_total, pib_years


def aggregate_total(entities: dict[str, dict], years: list[int]) -> tuple[dict[str, dict[int, dict]], dict[int, dict]]:
    vp = defaultdict(lambda: defaultdict(float))
    state = defaultdict(float)
    for item in entities.values():
        for year in years:
            value = item["total_pib"][year]
            vp[item["vice_presidency"]][year] += value
            state[year] += value
    return (
        {name: {year: {"pib": value} for year, value in values.items()} for name, values in vp.items()},
        {year: {"pib": value} for year, value in state.items()},
    )


def aggregate_per_capita(entities: dict[str, dict], years: list[int]) -> tuple[dict[str, dict[int, dict]], dict[int, dict], dict[str, dict[int, dict]]]:
    municipal: dict[str, dict[int, dict]] = {}
    vp_totals = defaultdict(lambda: defaultdict(lambda: {"total_pib": 0.0, "population": 0.0}))
    state_totals = defaultdict(lambda: {"total_pib": 0.0, "population": 0.0})
    for code, item in entities.items():
        municipal[code] = {}
        for year in years:
            total_pib, population = item["total_pib"][year], item["population"][year]
            municipal[code][year] = {"pib": total_pib / population, "total_pib": total_pib, "population": population}
            vp_total = vp_totals[item["vice_presidency"]][year]
            vp_total["total_pib"] += total_pib
            vp_total["population"] += population
            state_totals[year]["total_pib"] += total_pib
            state_totals[year]["population"] += population

    def finish(values: dict[int, dict]) -> dict[int, dict]:
        return {
            year: {**row, "pib": row["total_pib"] / row["population"]}
            for year, row in values.items()
        }

    return ({name: finish(values) for name, values in vp_totals.items()}, finish(state_totals), municipal)


def contribution_total(component: dict, previous_component: dict, previous_reference: dict) -> float:
    return share(component["pib"] - previous_component["pib"], previous_reference["pib"])


def contribution_per_capita(component: dict, previous_component: dict, reference: dict, previous_reference: dict) -> float:
    previous_pib = previous_reference["total_pib"]
    previous_population = previous_reference["population"]
    current_population = reference["population"]
    if not previous_pib or not previous_population or not current_population:
        return 0.0
    pib_change = component["total_pib"] - previous_component["total_pib"]
    population_change = component["population"] - previous_component["population"]
    reference_population_growth = (current_population - previous_population) / previous_population
    return (pib_change / previous_pib - population_change / previous_population) / (1 + reference_population_growth)


class LongBaseBuilder:
    def __init__(self) -> None:
        self.rows: list[dict] = []

    def add(self, year: int, variable: str, territory: str, component: str, level: str, value: float) -> None:
        if not math.isfinite(float(value)):
            raise ValueError(f"Valor nao finito em {component}: {territory}, {year}")
        self.rows.append(
            {"data": date_for(year), "variavel": variable, "territorio": territory, "componente": component, "nivel_geo": level, "valor": float(value)}
        )

    def add_per_capita_drivers(self, year: int, territory: str, component: str, level: str, series: dict[int, dict]) -> None:
        previous = series[year - 1]
        current = series[year]
        self.add(year, "Crescimento anual da popula\u00e7\u00e3o - PIB per capita", territory, component, level, growth(current["population"], previous["population"]))


def add_common_data(
    builder: LongBaseBuilder,
    metric: str,
    municipal_series: dict[str, dict[int, dict]],
    vp_series: dict[str, dict[int, dict]],
    state_series: dict[int, dict],
    entities: dict[str, dict],
    years: list[int],
) -> None:
    for vp_name, series in vp_series.items():
        for year in years:
            builder.add(year, metric, vp_name, COMPONENT_LEVEL, LEVEL_VP, series[year]["pib"])
            builder.add(year, f"Crescimento anual - {metric}", vp_name, COMPONENT_GROWTH, LEVEL_VP, growth(series[year]["pib"], series[year - 1]["pib"]))
            if metric == "PIB per capita":
                builder.add_per_capita_drivers(year, vp_name, COMPONENT_GROWTH, LEVEL_VP, series)

    for code, item in entities.items():
        name, series = item["name"], municipal_series[code]
        for year in years:
            builder.add(year, metric, name, COMPONENT_LEVEL, LEVEL_MUNICIPALITY, series[year]["pib"])
            builder.add(year, f"Crescimento anual - {metric}", name, COMPONENT_GROWTH, LEVEL_MUNICIPALITY, growth(series[year]["pib"], series[year - 1]["pib"]))
            if metric == "PIB per capita":
                builder.add_per_capita_drivers(year, name, COMPONENT_GROWTH, LEVEL_MUNICIPALITY, series)

    for year in years:
        builder.add(year, metric, STATE_NAME, COMPONENT_LEVEL, LEVEL_STATE, state_series[year]["pib"])
        builder.add(year, f"Crescimento anual - {metric}", STATE_NAME, COMPONENT_GROWTH, LEVEL_STATE, growth(state_series[year]["pib"], state_series[year - 1]["pib"]))
        if metric == "PIB per capita":
            builder.add_per_capita_drivers(year, STATE_NAME, COMPONENT_GROWTH, LEVEL_STATE, state_series)


def add_contributions(
    builder: LongBaseBuilder,
    metric: str,
    municipal_series: dict[str, dict[int, dict]],
    vp_series: dict[str, dict[int, dict]],
    state_series: dict[int, dict],
    entities: dict[str, dict],
    years: list[int],
    per_capita: bool,
) -> None:
    contribution = contribution_per_capita if per_capita else None
    for year in years:
        previous_year = year - 1
        builder.add(year, f"Crescimento anual - {metric}", STATE_NAME, COMPONENT_CONTRIBUTION, LEVEL_STATE, growth(state_series[year]["pib"], state_series[previous_year]["pib"]))
        for vp_name, series in vp_series.items():
            value = contribution(series[year], series[previous_year], state_series[year], state_series[previous_year]) if contribution else contribution_total(series[year], series[previous_year], state_series[previous_year])
            builder.add(year, f"Contribui\u00e7\u00e3o ao crescimento - {metric}", vp_name, COMPONENT_CONTRIBUTION, LEVEL_STATE, value)

    for vp_name, vp_values in vp_series.items():
        vp_codes = [code for code, item in entities.items() if item["vice_presidency"] == vp_name]
        for year in years:
            previous_year = year - 1
            builder.add(year, f"Crescimento anual - {metric}", vp_name, COMPONENT_CONTRIBUTION, LEVEL_VP, growth(vp_values[year]["pib"], vp_values[previous_year]["pib"]))
            for code in vp_codes:
                series = municipal_series[code]
                value = contribution(series[year], series[previous_year], vp_values[year], vp_values[previous_year]) if contribution else contribution_total(series[year], series[previous_year], vp_values[previous_year])
                builder.add(year, f"Contribui\u00e7\u00e3o ao crescimento - {metric} | VP: {vp_name}", entities[code]["name"], COMPONENT_CONTRIBUTION, LEVEL_VP, value)

    for code, item in entities.items():
        series, vp_values = municipal_series[code], vp_series[item["vice_presidency"]]
        for year in years:
            previous_year = year - 1
            value_vp = contribution(series[year], series[previous_year], vp_values[year], vp_values[previous_year]) if contribution else contribution_total(series[year], series[previous_year], vp_values[previous_year])
            value_state = contribution(series[year], series[previous_year], state_series[year], state_series[previous_year]) if contribution else contribution_total(series[year], series[previous_year], state_series[previous_year])
            builder.add(year, f"Contribui\u00e7\u00e3o para vice-presid\u00eancia - {metric}", item["name"], COMPONENT_CONTRIBUTION, LEVEL_MUNICIPALITY, value_vp)
            builder.add(year, f"Contribui\u00e7\u00e3o para Santa Catarina - {metric}", item["name"], COMPONENT_CONTRIBUTION, LEVEL_MUNICIPALITY, value_state)


def validate_contributions(vp_series: dict[str, dict[int, dict]], state_series: dict[int, dict], municipal_series: dict[str, dict[int, dict]], entities: dict[str, dict], years: list[int], per_capita: bool) -> None:
    calculate = contribution_per_capita if per_capita else None
    for year in years:
        previous_year = year - 1
        state_sum = sum(
            calculate(series[year], series[previous_year], state_series[year], state_series[previous_year]) if calculate else contribution_total(series[year], series[previous_year], state_series[previous_year])
            for series in vp_series.values()
        )
        if not math.isclose(state_sum, growth(state_series[year]["pib"], state_series[previous_year]["pib"]), abs_tol=1e-10):
            raise ValueError(f"Contribuicoes estaduais nao fecham em {year}.")
        for vp_name, vp_values in vp_series.items():
            codes = [code for code, item in entities.items() if item["vice_presidency"] == vp_name]
            vp_sum = sum(
                calculate(municipal_series[code][year], municipal_series[code][previous_year], vp_values[year], vp_values[previous_year]) if calculate else contribution_total(municipal_series[code][year], municipal_series[code][previous_year], vp_values[previous_year])
                for code in codes
            )
            if not math.isclose(vp_sum, growth(vp_values[year]["pib"], vp_values[previous_year]["pib"]), abs_tol=1e-10):
                raise ValueError(f"Contribuicoes da VP {vp_name} nao fecham em {year}.")


def dictionary_frame() -> pd.DataFrame:
    return pd.DataFrame(
        [
            ["data", "Ano de referencia do dado, registrado em 1 de janeiro."],
            ["variavel", "Medida e versao do painel. O sufixo | VP: identifica o contexto da vice-presidencia."],
            ["territorio", "Territorio ao qual o valor pertence."],
            ["componente", "Classificacao da transformacao: Dados de nivel, Dados de crescimento ou Contribuicao ao crescimento."],
            ["nivel_geo", "Instancia analisada: Estado, Vice-presidencia ou Municipio."],
            ["valor", "Valor numerico bruto; percentuais estao na escala decimal (0,05 = 5%)."],
            ["Dados de nivel", "PIB e PIB per capita usados pelo mapa, rankings e evolucao. Rankings sao obtidos por ordenacao do valor."],
            ["Dados de crescimento", "Taxas anuais usadas pelo mapa, visualizacoes de crescimento e PIB vs Populacao."],
            ["Mapa", "Participacao e CAGR podem ser calculados a partir das series de nivel; nao sao gravados em duplicidade."],
            ["Contribuicao total", "Delta do PIB do componente dividido pelo PIB do territorio de referencia no ano anterior."],
            ["Contribuicao per capita", "Decomposicao aditiva entre variacao do PIB e da populacao, identica a logica do painel."],
            ["PIB vs Populacao", "No painel per capita, compara o crescimento anual do PIB e da populacao do mesmo territorio."],
        ],
        columns=["item", "descricao"],
    )


def write_workbook(frame: pd.DataFrame, output_path: Path) -> None:
    with pd.ExcelWriter(output_path, engine="openpyxl", date_format="YYYY-MM-DD") as writer:
        sheets = [("consolidado", frame)]
        sheets.extend((component, frame.loc[frame["componente"] == component]) for component in sorted(frame["componente"].unique()))

        for sheet_name, sheet_frame in sheets:
            sheet_frame.to_excel(writer, sheet_name=sheet_name, index=False)
        dictionary_frame().to_excel(writer, sheet_name="dicionario", index=False)
        for worksheet in writer.sheets.values():
            worksheet.freeze_panes = "A2"
            worksheet.auto_filter.ref = worksheet.dimensions
            for column in worksheet.columns:
                width = min(max(len(str(cell.value or "")) for cell in column) + 2, 52)
                worksheet.column_dimensions[column[0].column_letter].width = width


def parse_args() -> argparse.Namespace:
    project_dir = Path(__file__).resolve().parents[1]
    raw_dir = project_dir / "Dados" / "Bruto"
    parser = argparse.ArgumentParser(description="Gera a base longa das visualizacoes do painel de PIB.")
    parser.add_argument("--pib", type=Path, default=raw_dir / "PIB municipios.xlsx")
    parser.add_argument("--populacao", type=Path, default=raw_dir / "Pop.xlsx")
    parser.add_argument("--dimensao", type=Path, default=raw_dir / "dim_municipio_vice_presidencia.xlsx")
    parser.add_argument("--saida", type=Path, default=project_dir / "Dados" / "Processado" / "base_long_visualizacoes_pib.xlsx")
    parser.add_argument("--csv", type=Path, help="Caminho opcional para uma copia CSV da base longa.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    entities, source_state_total, source_years = build_entities(args.pib, args.populacao, args.dimensao)
    required_years = list(range(2022, 2031))
    if not set(required_years).issubset(source_years):
        raise ValueError("A base de PIB precisa conter os anos de 2022 a 2030.")

    total_vp, total_state_from_municipalities = aggregate_total(entities, source_years)
    total_state = {year: {"pib": source_state_total[year]} for year in source_years}
    per_capita_years = [2022, *DISPLAY_YEARS["PIB per capita"]]
    pc_vp, pc_state, pc_municipal = aggregate_per_capita(entities, per_capita_years)
    total_municipal = {code: {year: {"pib": value} for year, value in item["total_pib"].items()} for code, item in entities.items()}
    builder = LongBaseBuilder()

    total_years = DISPLAY_YEARS["PIB"]
    add_common_data(builder, "PIB", total_municipal, total_vp, total_state, entities, total_years)
    add_contributions(builder, "PIB", total_municipal, total_vp, total_state, entities, total_years, per_capita=False)
    validate_contributions(total_vp, total_state, total_municipal, entities, total_years, per_capita=False)

    pc_years = DISPLAY_YEARS["PIB per capita"]
    add_common_data(builder, "PIB per capita", pc_municipal, pc_vp, pc_state, entities, pc_years)
    add_contributions(builder, "PIB per capita", pc_municipal, pc_vp, pc_state, entities, pc_years, per_capita=True)
    validate_contributions(pc_vp, pc_state, pc_municipal, entities, pc_years, per_capita=True)

    frame = pd.DataFrame(builder.rows, columns=OUTPUT_COLUMNS).sort_values(
        ["componente", "nivel_geo", "variavel", "territorio", "data"], kind="stable"
    )
    args.saida.parent.mkdir(parents=True, exist_ok=True)
    output_path = args.saida
    try:
        write_workbook(frame, output_path)
    except PermissionError:
        output_path = args.saida.with_name(f"{args.saida.stem}_atualizada{args.saida.suffix}")
        write_workbook(frame, output_path)
        print(f"Arquivo original estava aberto; copia atualizada salva em: {output_path}")
    if args.csv:
        args.csv.parent.mkdir(parents=True, exist_ok=True)
        frame.to_csv(args.csv, index=False, encoding="utf-8-sig")

    difference = max(abs(total_state_from_municipalities[year]["pib"] - total_state[year]["pib"]) for year in total_years)
    print(f"Base longa gerada: {output_path}")
    print(f"Linhas: {len(frame):,}".replace(",", "."))
    print(f"Municipios: {len(entities)} | Vice-presidencias: {len(total_vp)}")
    print(f"Maior diferenca entre soma municipal e PIB estadual bruto: R$ {difference:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))


if __name__ == "__main__":
    main()
