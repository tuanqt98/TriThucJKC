import { Suspense } from "react";
import { MyCourses } from "../../components/my-courses";
export default function Page() {
  return (
    <Suspense>
      <MyCourses />
    </Suspense>
  );
}
