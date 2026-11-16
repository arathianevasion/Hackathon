import { demoStore } from "../../src/store/demo";
import { AutoRefresh } from "../AutoRefresh";
import { PhoneSimulator } from "../PhoneSimulator";

export const dynamic = "force-dynamic";

/** The Client's real phone: only the Messages view for one Client, full-screen. */
export default async function PhonePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  const store = demoStore();
  const selected = store.list("clients").find((c) => c.id === client) ?? null;
  const thread = selected ? store.list("messages").filter((m) => m.clientId === selected.id) : [];
  return (
    <>
      <AutoRefresh />
      <PhoneSimulator clientId={selected?.id ?? null} messages={thread} browser={null} standalone />
    </>
  );
}
