import type { Metadata } from "next";
import "./globals.css";
import Footer from "./components/composed/Footer/Footer";
import Header from "./components/composed/Header/Header.server";

export const metadata: Metadata = {
  title: "Chess WC Games",
  description: "Chess World Championship Games History",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="flex flex-col items-center min-h-screen">
          <Header />
          <main className="flex-grow w-full">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
