import { Suspense } from "react";
import { KnowledgeCreate } from "../../../components/knowledge-create";
export default function Page() {
  return (
    <Suspense>
      <KnowledgeCreate />
    </Suspense>
  );
}
