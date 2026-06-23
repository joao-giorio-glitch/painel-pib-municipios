import EconomicDashboard from "../src/components/dashboard/EconomicDashboard";
import { loadDashboardData } from "../lib/loadPibData";

export default async function Home() {
  const data = await loadDashboardData();

  return <EconomicDashboard data={data} />;
}
