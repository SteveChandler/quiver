"use client";
import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { Button } from "@/components/ui/button";

type Dashboard = Record<"due" | "attention" | "offers" | "runs", Record<string, unknown>[]> & { reply_sync: Record<string, unknown> | null };
export default function EmailAutomationPage(): React.ReactElement {
  const fetcher = useCallback(async (): Promise<Dashboard> => {
    const response = await fetch("/api/admin/email/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Email monitoring is unavailable");
    return response.json();
  }, []);
  const { data, loading, error, refetch } = useDataFetcher(fetcher);
  return <div className="space-y-6 p-6"><h1 className="text-2xl font-semibold">Email lifecycle and rewards</h1>
    <p>Due messages, held recipients, saved rewards and recent worker runs. Activation remains a separate approval.</p>
    <Button onClick={() => void refetch()} disabled={loading}>Refresh status</Button>
    {error && <p role="alert">Monitoring could not be loaded. Check the job logs.</p>}
    {data && <><p>Reply ingestion: {String(data.reply_sync?.status ?? "Not configured")}. Last sync: {String(data.reply_sync?.last_synced_at ?? "Never")}.</p>
      {(["runs", "due", "attention", "offers"] as const).map(section => <section className="space-y-2" key={section}><h2 className="text-xl font-semibold">{section === "due" ? "Due but unsent and eligibility" : section === "runs" ? "Worker runs" : section === "offers" ? "Reward fulfillment" : "Needs attention"}</h2>
        {data[section].length === 0 ? <p>{section === "runs" ? "No runs recorded. The scheduler has not demonstrated a successful run." : "No records."}</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{Object.keys(data[section][0]).map(key => <th className="p-2 text-left" key={key}>{key.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{data[section].map((row,index) => <tr className="border-t" key={index}>{Object.entries(row).map(([key,value]) => <td className="p-2" key={key}>{value == null ? "—" : String(value)}</td>)}</tr>)}</tbody></table></div>}
      </section>)}
    </>}
  </div>;
}
