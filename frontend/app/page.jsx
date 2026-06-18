import EconomicDashboard from "../src/components/dashboard/EconomicDashboard";
import { loadPibData } from "../lib/loadPibData";

export default async function Home() {
  const data = await loadPibData();

  return <EconomicDashboard data={data} />;
}
