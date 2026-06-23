"""Compara a contribuicao estadual exibida no frontend com a base longa.

O teste reproduz a logica de ContributionToGrowthChart.tsx para cada barra de
vice-presidencia e para a linha de crescimento de Santa Catarina.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.ticker import PercentFormatter
import pandas as pd


STATE = "Santa Catarina"
COMPONENT = "Contribui\u00e7\u00e3o ao crescimento"
LEVEL = "Estado"


def growth(current: float, previous: float) -> float:
    return 0.0 if previous == 0 else current / previous - 1


def to_frontend_series(rows: list[dict], start_year: int) -> dict[int, dict]:
    ordered = sorted(rows, key=lambda row: row["year"])
    series = {}
    for index, row in enumerate(ordered):
        previous = ordered[index - 1] if index else None
        series[row["year"]] = {
            "pib": float(row["pib"] or 0),
            "total_pib": float(row.get("totalPib", row["pib"]) or 0),
            "population": float(row.get("population", 0) or 0),
            "growth": growth(float(row["pib"] or 0), float(previous["pib"] or 0)) if previous else 0.0,
        }
    return {year: value for year, value in series.items() if year >= start_year}


def per_capita_contribution(component: dict, previous_component: dict, reference: dict, previous_reference: dict) -> float:
    previous_pib = previous_reference["total_pib"]
    previous_population = previous_reference["population"]
    current_population = reference["population"]
    if not previous_pib or not previous_population or not current_population:
        return 0.0
    return (
        ((component["total_pib"] - previous_component["total_pib"]) / previous_pib)
        - ((component["population"] - previous_component["population"]) / previous_population)
    ) / (1 + (current_population - previous_population) / previous_population)


def frontend_chart_rows(payload: dict, metric: str) -> pd.DataFrame:
    start_year = payload["metadata"].get("dashboardStartYear", payload["metadata"]["maxObservedYear"])
    state = to_frontend_series(payload["sc"], start_year)
    years = sorted(state)[1:]  # Igual a state.pibSeries.slice(1) no componente React.
    rows = []
    for vp_name in payload["metadata"]["vicePresidencies"]:
        vp = to_frontend_series(
            [row for row in payload["vicePresidencies"] if row["vicePresidency"] == vp_name], start_year
        )
        for year in years:
            if metric == "PIB":
                contribution = (vp[year]["pib"] - vp[year - 1]["pib"]) / state[year - 1]["pib"]
            else:
                contribution = per_capita_contribution(vp[year], vp[year - 1], state[year], state[year - 1])
            rows.append((year, vp_name, f"Contribui\u00e7\u00e3o ao crescimento - {metric}", contribution))
    for year in years:
        rows.append((year, STATE, f"Crescimento anual - {metric}", state[year]["growth"]))
    return pd.DataFrame(rows, columns=["year", "territorio", "variavel", "frontend_valor"])


def parse_args() -> argparse.Namespace:
    project = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Valida a contribuicao estadual entre frontend e base longa.")
    parser.add_argument("--base", type=Path, default=project / "Dados" / "Processado" / "base_long_visualizacoes_pib_atualizada.xlsx")
    parser.add_argument("--saida-dir", type=Path, default=project / "Dados" / "Processado" / "validacoes")
    return parser.parse_args()


def save_comparison_chart(comparison: pd.DataFrame, metric: str, output_dir: Path) -> Path:
    contribution_variable = f"Contribui\u00e7\u00e3o ao crescimento - {metric}"
    contribution = comparison.loc[comparison["variavel"] == contribution_variable]
    state_growth = comparison.loc[
        (comparison["territorio"] == STATE) & (comparison["variavel"] == f"Crescimento anual - {metric}")
    ].sort_values("year")
    chart_data = contribution.pivot(index="year", columns="territorio", values="frontend_valor").sort_index()

    fig, axes = plt.subplots(1, 2, figsize=(16, 6), gridspec_kw={"width_ratios": [1.8, 1]})
    chart_data.plot(kind="bar", stacked=True, ax=axes[0], width=0.72, colormap="tab20")
    axes[0].plot(
        range(len(state_growth)), state_growth["frontend_valor"], color="#1f2724", marker="o", linewidth=2.5, label="Crescimento SC"
    )
    axes[0].set_title(f"Contribui\u00e7\u00e3o ao crescimento - {metric}")
    axes[0].set_xlabel("Ano")
    axes[0].set_ylabel("Taxa de crescimento")
    axes[0].yaxis.set_major_formatter(PercentFormatter(1))
    axes[0].legend(loc="upper left", bbox_to_anchor=(1.01, 1), fontsize=8)

    lower = min(comparison["frontend_valor"].min(), comparison["valor"].min())
    upper = max(comparison["frontend_valor"].max(), comparison["valor"].max())
    margin = max((upper - lower) * 0.08, 1e-5)
    axes[1].scatter(comparison["valor"], comparison["frontend_valor"], color="#2b8c7e", alpha=0.8)
    axes[1].plot([lower - margin, upper + margin], [lower - margin, upper + margin], color="#d8a23a", linestyle="--")
    axes[1].set_xlim(lower - margin, upper + margin)
    axes[1].set_ylim(lower - margin, upper + margin)
    axes[1].set_title("Base longa x frontend")
    axes[1].set_xlabel("Base longa")
    axes[1].set_ylabel("Frontend")
    axes[1].xaxis.set_major_formatter(PercentFormatter(1))
    axes[1].yaxis.set_major_formatter(PercentFormatter(1))
    axes[1].set_aspect("equal", adjustable="box")

    fig.tight_layout()
    output_path = output_dir / f"validacao_contribuicao_estado_{'pib' if metric == 'PIB' else 'pib_per_capita'}.png"
    fig.savefig(output_path, dpi=160, bbox_inches="tight")
    plt.close(fig)
    return output_path


def main() -> None:
    args = parse_args()
    project = Path(__file__).resolve().parents[1]
    base = pd.read_excel(args.base, sheet_name="consolidado")
    base["year"] = pd.to_datetime(base["data"]).dt.year
    args.saida_dir.mkdir(parents=True, exist_ok=True)
    reports = []

    for metric, filename in [("PIB", "pib.json"), ("PIB per capita", "pib-per-capita.json")]:
        payload = json.loads((project / "frontend" / "public" / "data" / filename).read_text(encoding="utf-8"))
        frontend = frontend_chart_rows(payload, metric)
        long = base.loc[
            (base["componente"] == COMPONENT)
            & (base["nivel_geo"] == LEVEL)
            & (base["variavel"].isin(frontend["variavel"].unique()))
            & (base["year"].isin(frontend["year"].unique())),
            ["year", "territorio", "variavel", "valor"],
        ]
        comparison = frontend.merge(long, on=["year", "territorio", "variavel"], how="outer", validate="one_to_one")
        if comparison[["frontend_valor", "valor"]].isna().any().any():
            raise AssertionError(f"Linhas ausentes ao comparar {metric}.")
        comparison["erro_absoluto"] = (comparison["frontend_valor"] - comparison["valor"]).abs()
        max_error = comparison["erro_absoluto"].max()
        if max_error >= 1e-12:
            raise AssertionError(f"Divergencia em {metric}: erro maximo {max_error}.")
        chart_path = save_comparison_chart(comparison, metric, args.saida_dir)
        reports.append((metric, len(comparison), max_error, sorted(frontend["year"].unique()), chart_path))

    for metric, rows, max_error, years, chart_path in reports:
        print(f"{metric}: {rows} pontos do grafico conferidos; anos {years}; erro maximo {max_error:.2e}")
        print(f"Grafico salvo: {chart_path}")
    print("OK: as barras e a linha da contribuicao estadual no frontend coincidem com a base longa.")


if __name__ == "__main__":
    main()
