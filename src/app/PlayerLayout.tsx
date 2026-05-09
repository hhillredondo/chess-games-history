import { Suspense } from "react";
import { Outlet } from "react-router-dom";

import PlayerGamesProvider from "./PlayerGamesProvider.client";

export default function PlayerLayout() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center" role="status">
          Loading…
        </div>
      }
    >
      <PlayerGamesProvider>
        <Outlet />
      </PlayerGamesProvider>
    </Suspense>
  );
}
