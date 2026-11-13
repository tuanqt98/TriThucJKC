import { Suspense } from "react";
import { KnowledgeLibrary } from "../../components/knowledge-library";

export default function Page() {
  // KnowledgeLibrary reads/writes its state in the URL (shareable links, Back from an article).
  return (
    <Suspense>
      <KnowledgeLibrary />
    </Suspense>
  );
}
