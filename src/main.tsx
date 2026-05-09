import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import HomePage from "@/app/HomePage";
import PlayerLayout from "@/app/PlayerLayout";
import RootLayout from "@/app/RootLayout";
import CoachLoader from "@/app/coach/CoachLoader.client";
import GamesList from "@/app/games/GamesList.client";
import StatsLoader from "@/app/stats/StatsLoader.client";
import { ThemeProvider } from "@/contexts/ThemeContext";

import "@/app/globals.css";

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        element: <PlayerLayout />,
        children: [
          { path: "games", element: <GamesList /> },
          { path: "stats", element: <StatsLoader /> },
          { path: "coach", element: <CoachLoader /> },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>
);
