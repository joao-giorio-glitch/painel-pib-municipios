import "./globals.css";

export const metadata = {
  title: "Painel PIB Municípios",
  description: "Painel interativo para visualização do PIB municipal e por mesorregião."
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
