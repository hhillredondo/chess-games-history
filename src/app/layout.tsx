import { ThemeProvider } from "@/contexts/ThemeContext";
import type { Metadata } from "next";
import Footer from "./_components/composed/Footer/Footer";
import Header from "./_components/composed/Header/Header.server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chess Stats",
  description: "Some chess games & stats",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <ThemeProvider>
        <body>
          <div className="flex flex-col items-center min-h-screen">
            <Header />
            <main className="flex-grow w-full">{children}</main>
            <Footer />
          </div>
        </body>
      </ThemeProvider>
    </html>
  );
}
