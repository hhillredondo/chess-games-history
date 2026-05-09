import { Outlet } from "react-router-dom";

import Footer from "./_components/composed/Footer/Footer";
import Header from "./_components/composed/Header/Header";

export default function RootLayout() {
  return (
    <div className="flex min-h-screen w-full flex-col items-stretch">
      <Header />
      <main className="w-full flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
