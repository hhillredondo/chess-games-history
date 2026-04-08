import { Suspense } from "react";

import GamesList from "./GamesList.client";

export default function GamesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center" role="status">
          Loading…
        </div>
      }
    >
      <GamesList />
    </Suspense>
  );
}
