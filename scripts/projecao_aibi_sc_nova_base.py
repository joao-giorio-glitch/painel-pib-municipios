"""
Projeção populacional municipal de Santa Catarina pelo método AiBi.

Arquivo esperado:
    Populações censitárias municipais SC 2010 e 2022(1).xls

Abas utilizadas:
    1. "Projeção AiBi"
       - Código do município
       - Nome do município
       - População Censo 2010
       - População Censo 2022
       - linha final "Total"

    2. "Projeções Populacionais SC"
       - CÓD.
       - SIGLA
       - ANO
       - População

Saída:
    projecao_aibi_municipios_sc_2025_2030.xlsx

Dependências:
    pip install pandas numpy xlrd xlsxwriter
"""

from __future__ import annotations

from pathlib import Path
import warnings

import numpy as np
import pandas as pd


# ============================================================================
# 1. CONFIGURAÇÕES
# ============================================================================

PROJECT_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = PROJECT_DIR / "Dados" / "Bruto"
PROCESSED_DIR = PROJECT_DIR / "Dados" / "Processado"

ARQUIVO_ENTRADA = RAW_DIR / "Populações censitárias municipais SC 2010 e 2022.xls"

ABA_MUNICIPIOS = "Projeção AiBi"
ABA_PROJECAO_SC = "Projeções Populacionais SC"


ARQUIVO_SAIDA = PROCESSED_DIR / "projecao_aibi_municipios_sc_2025_2030.xlsx"

ANO_INICIAL_PROJECAO = 2025
ANO_FINAL_PROJECAO = 2030

# Controle usado para confirmar que a coluna municipal de 2022 contém
# o resultado final do Censo Demográfico 2022 para Santa Catarina.
TOTAL_CENSO_2022_SC = 7_610_361

# Na base fornecida, 2025 é o total da Estimativa da População de 2025.
# Ele pode ser utilizado como controle estadual do AiBi, desde que isso
# seja explicitado na metodologia.
TOTAL_ESTIMATIVA_2025_SC = 8_187_029


# ============================================================================
# 2. FUNÇÕES DE LEITURA E PADRONIZAÇÃO
# ============================================================================

def normalizar_nome_coluna(nome: object) -> str:
    """Remove espaços desnecessários dos nomes das colunas."""
    return " ".join(str(nome).strip().split())


def ler_base_municipal(
    arquivo: Path,
    aba: str,
) -> tuple[pd.DataFrame, dict[str, int]]:
    """
    Lê a aba municipal e executa as validações necessárias.

    Retorna:
        - DataFrame apenas com os 295 municípios;
        - dicionário com os totais de controle de 2010 e 2022.
    """

    df = pd.read_excel(
        arquivo,
        sheet_name=aba,
        engine="xlrd",
        dtype=object,
    )

    df.columns = [normalizar_nome_coluna(col) for col in df.columns]

    colunas_necessarias = [
        "Código do município",
        "Nome do município",
        "População Censo 2010",
        "População Censo 2022",
    ]

    ausentes = [
        coluna for coluna in colunas_necessarias
        if coluna not in df.columns
    ]

    if ausentes:
        raise ValueError(
            "A aba municipal não contém todas as colunas necessárias. "
            f"Colunas ausentes: {ausentes}"
        )

    df = df[colunas_necessarias].copy()

    # Identifica e separa a linha agregada de Santa Catarina.
    codigo_texto = (
        df["Código do município"]
        .astype(str)
        .str.strip()
        .str.casefold()
    )

    nome_texto = (
        df["Nome do município"]
        .astype(str)
        .str.strip()
        .str.casefold()
    )

    mascara_total = (
        codigo_texto.eq("total")
        | nome_texto.eq("santa catarina")
    )

    linhas_total = df.loc[mascara_total].copy()

    if len(linhas_total) != 1:
        raise ValueError(
            "Era esperada exatamente uma linha de total para Santa Catarina, "
            f"mas foram encontradas {len(linhas_total)}."
        )

    total_2010_informado = pd.to_numeric(
        linhas_total["População Censo 2010"],
        errors="raise",
    ).iloc[0]

    total_2022_informado = pd.to_numeric(
        linhas_total["População Censo 2022"],
        errors="raise",
    ).iloc[0]

    # Mantém somente os municípios.
    municipios = df.loc[~mascara_total].copy()

    # Padroniza os códigos municipais com sete dígitos.
    municipios["Código do município"] = (
        municipios["Código do município"]
        .astype(str)
        .str.strip()
        .str.replace(r"\.0$", "", regex=True)
        .str.zfill(7)
    )

    municipios["Nome do município"] = (
        municipios["Nome do município"]
        .astype(str)
        .str.strip()
    )

    for coluna in [
        "População Censo 2010",
        "População Censo 2022",
    ]:
        municipios[coluna] = pd.to_numeric(
            municipios[coluna],
            errors="coerce",
        )

    # ----------------------------------------------------------------------
    # Validações da base municipal
    # ----------------------------------------------------------------------

    if len(municipios) != 295:
        raise ValueError(
            "A base deveria conter os 295 municípios catarinenses, "
            f"mas contém {len(municipios)}."
        )

    if municipios["Código do município"].duplicated().any():
        duplicados = municipios.loc[
            municipios["Código do município"].duplicated(keep=False),
            ["Código do município", "Nome do município"],
        ]

        raise ValueError(
            "Foram encontrados códigos municipais duplicados:\n"
            f"{duplicados.to_string(index=False)}"
        )

    if municipios[colunas_necessarias].isna().any().any():
        problemas = municipios.loc[
            municipios[colunas_necessarias].isna().any(axis=1)
        ]

        raise ValueError(
            "Foram encontrados valores ausentes na base municipal:\n"
            f"{problemas.to_string(index=False)}"
        )

    colunas_populacao = [
        "População Censo 2010",
        "População Censo 2022",
    ]

    if (municipios[colunas_populacao] <= 0).any().any():
        raise ValueError(
            "Existem populações municipais iguais ou menores que zero."
        )

    soma_2010 = int(municipios["População Censo 2010"].sum())
    soma_2022 = int(municipios["População Censo 2022"].sum())

    if soma_2010 != int(total_2010_informado):
        raise ValueError(
            "A soma municipal de 2010 não coincide com a linha Total. "
            f"Soma municipal: {soma_2010:,}; "
            f"total informado: {int(total_2010_informado):,}."
        )

    if soma_2022 != int(total_2022_informado):
        raise ValueError(
            "A soma municipal de 2022 não coincide com a linha Total. "
            f"Soma municipal: {soma_2022:,}; "
            f"total informado: {int(total_2022_informado):,}."
        )

    if soma_2022 != TOTAL_CENSO_2022_SC:
        raise ValueError(
            "A coluna de 2022 não coincide com o resultado final do "
            "Censo Demográfico 2022 para Santa Catarina. "
            f"Total encontrado: {soma_2022:,}; "
            f"total esperado: {TOTAL_CENSO_2022_SC:,}."
        )

    controles = {
        "total_sc_2010": soma_2010,
        "total_sc_2022": soma_2022,
    }

    return municipios.reset_index(drop=True), controles


def ler_projecao_estadual(
    arquivo: Path,
    aba: str,
    ano_inicial: int,
    ano_final: int,
) -> pd.DataFrame:
    """
    Lê os controles estaduais utilizados para desagregar a população
    projetada de Santa Catarina entre os municípios.
    """

    df = pd.read_excel(
        arquivo,
        sheet_name=aba,
        engine="xlrd",
        dtype=object,
    )

    df.columns = [normalizar_nome_coluna(col) for col in df.columns]

    colunas_necessarias = ["ANO", "População"]

    ausentes = [
        coluna for coluna in colunas_necessarias
        if coluna not in df.columns
    ]

    if ausentes:
        raise ValueError(
            "A aba de projeções estaduais não contém as colunas "
            f"necessárias: {ausentes}"
        )

    df = df[colunas_necessarias].copy()

    df["ANO"] = pd.to_numeric(df["ANO"], errors="coerce")
    df["População"] = pd.to_numeric(
        df["População"],
        errors="coerce",
    )

    # Exclui linhas vazias e seleciona somente o horizonte desejado.
    df = df.dropna(subset=["ANO", "População"]).copy()

    df["ANO"] = df["ANO"].astype(int)
    df["População"] = df["População"].astype(np.int64)

    df = df.loc[
        df["ANO"].between(ano_inicial, ano_final)
    ].copy()

    anos_esperados = list(range(ano_inicial, ano_final + 1))
    anos_encontrados = sorted(df["ANO"].tolist())

    if anos_encontrados != anos_esperados:
        raise ValueError(
            "A série estadual deve conter uma observação para cada ano "
            f"entre {ano_inicial} e {ano_final}. "
            f"Anos encontrados: {anos_encontrados}"
        )

    if df["ANO"].duplicated().any():
        raise ValueError(
            "Existem anos duplicados na aba de projeções estaduais."
        )

    if (df["População"] <= 0).any():
        raise ValueError(
            "A série estadual contém populações iguais ou menores que zero."
        )

    df = df.sort_values("ANO").reset_index(drop=True)

    # Registra que o valor de 2025 da base é a estimativa oficial de 2025.
    valor_2025 = int(
        df.loc[df["ANO"] == 2025, "População"].iloc[0]
    )

    if valor_2025 == TOTAL_ESTIMATIVA_2025_SC:
        warnings.warn(
            "O controle estadual de 2025 é a Estimativa da População "
            "de 2025 (8.187.029), enquanto os anos posteriores são "
            "valores da trajetória projetada. O cálculo é válido, mas "
            "essa combinação deve ser explicitada na metodologia.",
            stacklevel=2,
        )

    return df


# ============================================================================
# 3. ARREDONDAMENTO COM FECHAMENTO ESTADUAL
# ============================================================================

def arredondar_maiores_restos(
    valores: pd.Series,
    total_controle: int,
) -> pd.Series:
    """
    Converte projeções decimais em números inteiros e mantém a soma
    exatamente igual ao total estadual.

    Procedimento:
        1. Retém a parte inteira de cada projeção;
        2. Calcula a diferença para o total estadual;
        3. Distribui as pessoas restantes aos maiores restos decimais.
    """

    if (valores < 0).any():
        raise ValueError(
            "Não é possível arredondar porque existem projeções negativas."
        )

    inteiros = np.floor(valores).astype(np.int64)
    restos = valores - inteiros

    diferenca = int(total_controle - inteiros.sum())
    resultado = inteiros.copy()

    if diferenca > 0:
        indices = restos.nlargest(diferenca).index
        resultado.loc[indices] += 1

    elif diferenca < 0:
        indices = restos.nsmallest(abs(diferenca)).index
        resultado.loc[indices] -= 1

    if int(resultado.sum()) != int(total_controle):
        raise RuntimeError(
            "O arredondamento não reproduziu o total estadual."
        )

    return resultado


# ============================================================================
# 4. CÁLCULO DO MÉTODO AiBi
# ============================================================================

def calcular_projecao_aibi(
    municipios: pd.DataFrame,
    controles_censitarios: dict[str, int],
    projecao_sc: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Calcula os coeficientes AiBi e as projeções municipais.

    Fórmulas:

        a_i = (P_i,2022 - P_i,2010)
              --------------------------------
              (P_SC,2022 - P_SC,2010)

        b_i = P_i,2010 - a_i * P_SC,2010

        P_i,t = a_i * P_SC,t + b_i
    """

    resultado = municipios.copy()

    total_sc_2010 = controles_censitarios["total_sc_2010"]
    total_sc_2022 = controles_censitarios["total_sc_2022"]

    incremento_sc = total_sc_2022 - total_sc_2010

    if incremento_sc == 0:
        raise ValueError(
            "O incremento populacional estadual de 2010 a 2022 "
            "não pode ser igual a zero."
        )

    # Coeficiente de participação do município no incremento estadual.
    resultado["a_i"] = (
        resultado["População Censo 2022"]
        - resultado["População Censo 2010"]
    ) / incremento_sc

    # Intercepto da função linear municipal.
    resultado["b_i"] = (
        resultado["População Censo 2010"]
        - resultado["a_i"] * total_sc_2010
    )

    # Propriedades algébricas necessárias para o fechamento estadual.
    soma_a = resultado["a_i"].sum()
    soma_b = resultado["b_i"].sum()

    if not np.isclose(soma_a, 1.0, atol=1e-10):
        raise RuntimeError(
            f"A soma dos coeficientes a_i deveria ser 1, mas é {soma_a}."
        )

    if not np.isclose(soma_b, 0.0, atol=1e-5):
        raise RuntimeError(
            f"A soma dos coeficientes b_i deveria ser 0, mas é {soma_b}."
        )

    tabelas_longas: list[pd.DataFrame] = []
    registros_controle: list[dict[str, float | int]] = []

    for linha in projecao_sc.itertuples(index=False):
        ano = int(linha.ANO)
        total_sc_ano = int(linha.População)

        coluna_decimal = f"Projeção {ano} decimal"
        coluna_inteira = f"Projeção {ano}"

        resultado[coluna_decimal] = (
            resultado["a_i"] * total_sc_ano
            + resultado["b_i"]
        )

        negativos = resultado.loc[
            resultado[coluna_decimal] < 0,
            [
                "Código do município",
                "Nome do município",
                coluna_decimal,
            ],
        ]

        if not negativos.empty:
            raise ValueError(
                f"A projeção de {ano} gerou populações negativas:\n"
                f"{negativos.to_string(index=False)}"
            )

        resultado[coluna_inteira] = arredondar_maiores_restos(
            resultado[coluna_decimal],
            total_sc_ano,
        )

        soma_decimal = float(resultado[coluna_decimal].sum())
        soma_inteira = int(resultado[coluna_inteira].sum())

        registros_controle.append(
            {
                "Ano": ano,
                "Controle estadual": total_sc_ano,
                "Soma municipal decimal": soma_decimal,
                "Diferença decimal": soma_decimal - total_sc_ano,
                "Soma municipal inteira": soma_inteira,
                "Diferença inteira": soma_inteira - total_sc_ano,
                "Menor projeção municipal": float(
                    resultado[coluna_decimal].min()
                ),
                "Maior projeção municipal": float(
                    resultado[coluna_decimal].max()
                ),
            }
        )

        tabelas_longas.append(
            pd.DataFrame(
                {
                    "Código do município":
                        resultado["Código do município"],
                    "Nome do município":
                        resultado["Nome do município"],
                    "Ano": ano,
                    "População projetada decimal":
                        resultado[coluna_decimal],
                    "População projetada inteira":
                        resultado[coluna_inteira],
                }
            )
        )

    formato_longo = pd.concat(
        tabelas_longas,
        ignore_index=True,
    )

    controles = pd.DataFrame(registros_controle)

    return resultado, formato_longo, controles


# ============================================================================
# 5. EXPORTAÇÃO DOS RESULTADOS
# ============================================================================

def exportar_resultados(
    resultado_amplo: pd.DataFrame,
    resultado_longo: pd.DataFrame,
    controles: pd.DataFrame,
    projecao_sc: pd.DataFrame,
    caminho_saida: Path,
) -> None:
    """Exporta as projeções e os controles para um arquivo Excel."""

    metodologia = pd.DataFrame(
        {
            "Item": [
                "Método",
                "Anos censitários",
                "Horizonte",
                "Total censitário de SC em 2010",
                "Total censitário de SC em 2022",
                "Observação sobre 2025",
                "Arredondamento",
            ],
            "Descrição": [
                "AiBi tradicional",
                "2010 e 2022",
                "2025 a 2030",
                int(resultado_amplo["População Censo 2010"].sum()),
                int(resultado_amplo["População Censo 2022"].sum()),
                (
                    "O arquivo utiliza a Estimativa da População de "
                    "Santa Catarina de 2025 como controle daquele ano."
                ),
                (
                    "Método dos maiores restos, preservando exatamente "
                    "o total estadual."
                ),
            ],
        }
    )

    with pd.ExcelWriter(
        caminho_saida,
        engine="xlsxwriter",
    ) as writer:

        resultado_amplo.to_excel(
            writer,
            sheet_name="Projeção AiBi",
            index=False,
        )

        resultado_longo.to_excel(
            writer,
            sheet_name="Formato longo",
            index=False,
        )

        controles.to_excel(
            writer,
            sheet_name="Controles",
            index=False,
        )

        projecao_sc.to_excel(
            writer,
            sheet_name="Controles estaduais",
            index=False,
        )

        metodologia.to_excel(
            writer,
            sheet_name="Metodologia",
            index=False,
        )

        workbook = writer.book

        formato_cabecalho = workbook.add_format(
            {
                "bold": True,
                "font_color": "#FFFFFF",
                "bg_color": "#1F4E78",
                "border": 1,
                "align": "center",
                "valign": "vcenter",
            }
        )

        formato_inteiro = workbook.add_format(
            {"num_format": "#,##0"}
        )

        formato_decimal = workbook.add_format(
            {"num_format": "#,##0.000"}
        )

        formato_coeficiente = workbook.add_format(
            {"num_format": "0.0000000000"}
        )

        dataframes = {
            "Projeção AiBi": resultado_amplo,
            "Formato longo": resultado_longo,
            "Controles": controles,
            "Controles estaduais": projecao_sc,
            "Metodologia": metodologia,
        }

        for nome_aba, dataframe in dataframes.items():
            planilha = writer.sheets[nome_aba]

            planilha.freeze_panes(1, 0)
            planilha.autofilter(
                0,
                0,
                len(dataframe),
                len(dataframe.columns) - 1,
            )

            for coluna_indice, coluna_nome in enumerate(dataframe.columns):
                planilha.write(
                    0,
                    coluna_indice,
                    coluna_nome,
                    formato_cabecalho,
                )

                comprimento_dados = (
                    dataframe[coluna_nome]
                    .astype(str)
                    .str.len()
                    .quantile(0.95)
                )

                largura = min(
                    max(
                        len(str(coluna_nome)) + 2,
                        int(comprimento_dados) + 2,
                    ),
                    42,
                )

                planilha.set_column(
                    coluna_indice,
                    coluna_indice,
                    largura,
                )

        # Formatação específica da aba ampla.
        planilha_ampla = writer.sheets["Projeção AiBi"]

        for indice, coluna in enumerate(resultado_amplo.columns):
            if coluna == "a_i":
                planilha_ampla.set_column(
                    indice,
                    indice,
                    16,
                    formato_coeficiente,
                )

            elif coluna == "b_i":
                planilha_ampla.set_column(
                    indice,
                    indice,
                    18,
                    formato_decimal,
                )

            elif "decimal" in coluna.casefold():
                planilha_ampla.set_column(
                    indice,
                    indice,
                    22,
                    formato_decimal,
                )

            elif (
                "população" in coluna.casefold()
                or coluna.startswith("Projeção ")
            ):
                planilha_ampla.set_column(
                    indice,
                    indice,
                    18,
                    formato_inteiro,
                )

    print(f"Arquivo gerado: {caminho_saida.resolve()}")


# ============================================================================
# 6. EXECUÇÃO
# ============================================================================

def main() -> None:
    if not ARQUIVO_ENTRADA.exists():
        raise FileNotFoundError(
            f"Arquivo não encontrado: {ARQUIVO_ENTRADA.resolve()}"
        )

    municipios, controles_censitarios = ler_base_municipal(
        ARQUIVO_ENTRADA,
        ABA_MUNICIPIOS,
    )

    projecao_sc = ler_projecao_estadual(
        ARQUIVO_ENTRADA,
        ABA_PROJECAO_SC,
        ANO_INICIAL_PROJECAO,
        ANO_FINAL_PROJECAO,
    )

    resultado_amplo, resultado_longo, controles = (
        calcular_projecao_aibi(
            municipios,
            controles_censitarios,
            projecao_sc,
        )
    )

    print("\nValidações concluídas:")
    print(f"Municípios: {len(municipios)}")
    print(
        "Total de SC em 2010: "
        f"{controles_censitarios['total_sc_2010']:,}"
    )
    print(
        "Total de SC em 2022: "
        f"{controles_censitarios['total_sc_2022']:,}"
    )
    print(f"Soma de a_i: {resultado_amplo['a_i'].sum():.12f}")
    print(f"Soma de b_i: {resultado_amplo['b_i'].sum():.6f}")

    print("\nFechamento anual:")
    print(controles.to_string(index=False))

    exportar_resultados(
        resultado_amplo,
        resultado_longo,
        controles,
        projecao_sc,
        ARQUIVO_SAIDA,
    )


if __name__ == "__main__":
    main()


