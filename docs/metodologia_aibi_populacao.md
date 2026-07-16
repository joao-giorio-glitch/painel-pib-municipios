Este documento descreve a metodologia de tendência de crescimento populacional para áreas menores, conhecida como método AiBi, e sua aplicação no projeto do painel de PIB e PIB per capita dos municípios de Santa Catarina.

A explicação se baseia em duas referências principais: a nota metodológica do IBGE sobre as estimativas populacionais municipais e o script `scripts/projecao_aibi_sc_nova_base.py`, responsável por gerar a projeção populacional municipal de Santa Catarina até 2030.

## 1. Contexto metodológico

O IBGE utiliza estimativas populacionais municipais para atualizar, anualmente, o contingente populacional dos municípios e das Unidades da Federação. Na nota metodológica de 2025, o IBGE descreve que as estimativas municipais são construídas a partir da relação entre a tendência de crescimento do município e a tendência de crescimento de uma área geográfica maior, usualmente a Unidade da Federação.

O princípio central é o fechamento hierárquico: a população estimada das áreas menores deve reproduzir, por soma, a população previamente conhecida ou projetada da área maior. Em outras palavras, se Santa Catarina possui uma população total projetada para determinado ano, a soma das populações projetadas dos municípios catarinenses deve fechar exatamente esse total estadual.

O IBGE identifica esse procedimento como Método de Tendência do Crescimento Populacional, ou AiBi, desenvolvido a partir de Madeira e Simões (1972). A lógica é adequada quando se conhece a população de uma área maior em determinado horizonte temporal e se deseja distribuir essa população entre áreas menores preservando a tendência relativa observada entre dois censos.

## 2. Formulação do método AiBi

Considere uma área maior com população total `P(t)` no ano `t`. Essa área maior é subdividida em `n` áreas menores. A população da área menor `i` no ano `t` é representada por `P_i(t)`.

O método assume que a população da área menor pode ser descrita por uma relação linear com a população da área maior:

$$
P_i(t) = a_i \cdot P(t) + b_i
$$

Nessa expressão:

- `P_i(t)` é a população estimada da área menor `i` no ano `t`;
- `P(t)` é a população conhecida ou projetada da área maior no ano `t`;
- `a_i` é o coeficiente de participação da área menor no incremento populacional da área maior;
- `b_i` é o coeficiente linear de correção.

Os coeficientes são calculados com base em dois pontos censitários. No projeto, os pontos usados são 2010 e 2022:

$$
a_i = \frac{P_{i,2022} - P_{i,2010}}{P_{SC,2022} - P_{SC,2010}}
$$

$$
b_i = P_{i,2010} - a_i \cdot P_{SC,2010}
$$

Depois de calculados `a_i` e `b_i`, a população municipal projetada para qualquer ano `t` é obtida por:

$$
P_{i,t} = a_i \cdot P_{SC,t} + b_i
$$

Assim, cada município mantém uma trajetória coerente com sua participação no crescimento observado entre 2010 e 2022. Municípios que cresceram mais que a média estadual recebem coeficientes `a_i` maiores; municípios que perderam população entre 2010 e 2022 podem apresentar `a_i` negativo, indicando contribuição negativa ao incremento populacional estadual.

## 3. Aplicação no projeto

No projeto, a metodologia foi implementada no script:

```text
scripts/projecao_aibi_sc_nova_base.py
```

O script lê a planilha:

```text
Dados/Bruto/Populações censitárias municipais SC 2010 e 2022.xls
```

A aba municipal utilizada é:

```text
Projeção AiBi
```

Essa aba contém, para cada município catarinense:

- código do município;
- nome do município;
- população censitária de 2010;
- população censitária de 2022.

O script também lê a aba:

```text
Projeções Populacionais SC
```

Essa aba fornece os totais populacionais de Santa Catarina usados como controle estadual para os anos projetados. O horizonte usado no projeto é 2025 a 2030.

A partir dessas informações, o script:

1. valida se há 295 municípios catarinenses;
2. valida se a soma municipal de 2010 coincide com a linha de total estadual da planilha;
3. valida se a soma municipal de 2022 coincide com a linha de total estadual da planilha;
4. valida se o total de 2022 coincide com o resultado final do Censo Demográfico 2022 para Santa Catarina, isto é, 7.610.361 habitantes;
5. calcula os coeficientes `a_i` e `b_i` de cada município;
6. aplica `P_i,t = a_i * P_SC,t + b_i` para cada ano de 2025 a 2030;
7. arredonda as projeções municipais por maiores restos, preservando exatamente o total estadual em cada ano.

O arquivo gerado é:

```text
Dados/Processado/projecao_aibi_municipios_sc_2025_2030.xlsx
```

Ele contém as projeções em formato amplo e longo, além das abas de controle e metodologia.

## 4. Fechamento estadual e arredondamento

A fórmula AiBi produz projeções decimais. Como população municipal precisa ser representada em pessoas inteiras, o script usa arredondamento pelo método dos maiores restos.

O procedimento é:

1. calcula-se a projeção decimal de cada município;
2. toma-se a parte inteira de cada projeção;
3. calcula-se a diferença entre a soma das partes inteiras e o total estadual de controle;
4. distribuem-se as pessoas restantes aos municípios com maiores restos decimais.

Esse procedimento garante que:

```text
soma das populações municipais projetadas = população estadual de controle
```

A validação realizada pelo script indicou diferença inteira igual a zero em todos os anos projetados de 2025 a 2030.

## 5. Tratamento de Pescaria Brava e Balneário Rincão

Um ponto importante da aplicação é a compatibilização da malha municipal entre 2010 e 2022.

Pescaria Brava e Balneário Rincão não existiam como municípios em 2010. Portanto, para que o método AiBi pudesse ser aplicado a uma base municipal comparável com a estrutura territorial de 2022, foi necessário criar populações sintéticas para esses dois municípios em 2010.

Essas populações sintéticas representam a parcela da população dos municípios de origem que seria atribuível aos novos municípios, caso eles já existissem como unidades separadas em 2010.

A regra adotada foi proporcional: a população sintética em 2010 foi calculada com base na participação do novo município na população conjunta do novo município e do município de origem no primeiro ano de emancipação observado na base.

De forma geral, seja:

- `N` o novo município emancipado;
- `M` o município de origem;
- `t` o primeiro ano de emancipação ou o primeiro ano em que ambos aparecem como municípios separados na base;
- `PopN(2010)` a população sintética do novo município em 2010;
- `PopM(2010)` a população original do município de origem em 2010.

Então:

$$
\mathrm{Pop}_{N}(2010) = \mathrm{Pop}_{M}(2010) \cdot \frac{\mathrm{Pop}_{N}(t)}{\mathrm{Pop}_{N}(t) + \mathrm{Pop}_{M}(t)}
$$

E a população compatibilizada do município de origem em 2010 passa a ser:

$$
\mathrm{Pop}_{M}^{novo}(2010) = \mathrm{Pop}_{M}(2010) - \mathrm{Pop}_{N}(2010)
$$

No caso específico do projeto:

- Pescaria Brava foi compatibilizada em relação a Laguna;
- Balneário Rincão foi compatibilizado em relação a Içara.

Assim, a base de 2010 passa a representar uma malha municipal sintética equivalente à estrutura de 2022, permitindo que o AiBi compare 2010 e 2022 sem misturar crescimento demográfico com mudança administrativa de limites.

Esse procedimento é conceitualmente alinhado à recomendação metodológica do IBGE de harmonizar a população municipal censitária de 2010 com a Divisão Político-Administrativa vigente no Censo Demográfico de 2022 antes do cálculo das tendências.

## 6. Interpretação dos coeficientes

O coeficiente `a_i` mede quanto do incremento populacional estadual observado entre 2010 e 2022 esteve associado ao município `i`.

Se `a_i` é positivo e elevado, o município respondeu por parcela relevante do crescimento estadual. Isso tende a ocorrer em municípios com forte crescimento populacional no período censitário.

Se `a_i` é próximo de zero, o município cresceu pouco em termos absolutos ou ficou praticamente estável em relação ao incremento estadual.

Se `a_i` é negativo, o município perdeu população entre 2010 e 2022, enquanto Santa Catarina como um todo cresceu. Nesse caso, a projeção mantém essa tendência relativa de perda, desde que ela não produza valores negativos.

O coeficiente `b_i` corrige o nível da série para que a equação reproduza exatamente a população do município nos pontos censitários usados para calibrar o modelo.

## 7. Coerência demográfica da aplicação

A aplicação no projeto apresentou propriedades esperadas para o método:

- a soma dos coeficientes `a_i` é igual a 1;
- a soma dos coeficientes `b_i` é aproximadamente zero;
- não há projeções municipais negativas entre 2025 e 2030;
- a soma das projeções municipais fecha exatamente os totais estaduais de controle;
- as projeções municipais seguem a tendência observada entre 2010 e 2022;
- municípios com crescimento forte no litoral e em áreas economicamente dinâmicas mantêm crescimento projetado maior;
- municípios pequenos do interior com perda populacional entre os censos podem manter trajetória declinante.

No nível das vice-presidências, as populações projetadas são obtidas pela soma dos municípios pertencentes a cada vice-presidência. Portanto, a projeção das vice-presidências não é estimada diretamente por um AiBi próprio; ela é uma agregação coerente das projeções municipais.

Da mesma forma, a população de Santa Catarina no painel corresponde ao fechamento estadual dos municípios, que reproduz os controles estaduais usados na projeção.

## 8. Limitações e cuidados de interpretação

A metodologia AiBi é uma projeção por tendência relativa. Ela preserva a relação observada entre o crescimento dos municípios e o crescimento estadual no período censitário usado como base. Por isso, ela não incorpora, diretamente, choques futuros específicos, mudanças locais de política urbana, novos investimentos, alterações econômicas inesperadas ou mudanças migratórias não refletidas na tendência 2010-2022.

Além disso, no projeto, 2025 é tratado como controle estadual de estimativa populacional, enquanto 2026 a 2030 seguem a trajetória projetada estadual disponível na planilha. Essa combinação é válida para fins de painel, desde que seja explicitada na documentação metodológica.

Também é importante diferenciar a aplicação do projeto da metodologia oficial completa do IBGE. A nota metodológica do IBGE inclui procedimentos adicionais de ajuste censitário, harmonização territorial e uso de parâmetros da Pesquisa de Pós-Enumeração. O projeto utiliza a lógica central do AiBi sobre uma base já preparada para Santa Catarina, com foco na geração de séries municipais coerentes para o painel de PIB per capita.

## 9. Referências

IBGE. Estimativas da população residente para os Municípios e para as Unidades da Federação. Página da operação estatística. Disponível em: https://www.ibge.gov.br/estatisticas/sociais/populacao/9103-estimativas-de-populacao.html

IBGE. Estimativas da População 2025: Nota metodológica n. 01. Estimativas da população residente para os Municípios e para as Unidades da Federação brasileiros, com data de referência em 1º de julho de 2025. Rio de Janeiro: IBGE, 2025. Disponível em: https://biblioteca.ibge.gov.br/visualizacao/livros/liv102198.pdf

IBGE. Biblioteca IBGE: registro catalográfico da Nota metodológica n. 01 das Estimativas da População 2025. Disponível em: https://biblioteca.ibge.gov.br/index.php/biblioteca-catalogo?view=detalhes&id=2102198

Projeto Painel PIB Municípios. Script `scripts/projecao_aibi_sc_nova_base.py`.
