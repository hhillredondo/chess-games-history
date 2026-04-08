import { Suspense } from "react";

import StatsLoader from "./StatsLoader.client";

export default function StatsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center" role="status">
          Loading…
        </div>
      }
    >
      <StatsLoader />
    </Suspense>
  );
}
