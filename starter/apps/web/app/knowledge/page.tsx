import { Workspace } from "../../components/workspace";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; processId?: string }>;
}) {
  const { q, processId } = await searchParams;
  return (
    <Workspace
      key={`${q || ""}-${processId || ""}`}
      initialQuery={q || ""}
      initialProcess={processId || ""}
    />
  );
}
