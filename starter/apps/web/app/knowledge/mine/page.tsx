import { Suspense } from "react";
import { KnowledgeMine } from "../../../components/knowledge-mine";
export default function Page() {
  return (
    <Suspense>
      <KnowledgeMine />
    </Suspense>
  );
}
