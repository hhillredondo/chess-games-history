import { Suspense } from "react";

import PlayerGamesProvider from "./PlayerGamesProvider.client";

export default function PlayerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center" role="status">
          Loading…
        </div>
      }
    >
      <PlayerGamesProvider>{children}</PlayerGamesProvider>
    </Suspense>
  );
}
