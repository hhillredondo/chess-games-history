import { ThemeProvider } from "@/contexts/ThemeContext";
import type { Metadata } from "next";
import Footer from "./_components/composed/Footer/Footer";
import Header from "./_components/composed/Header/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chess Stats",
  description: "Some chess games & stats",
  icons: {
    icon: "/wq.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <ThemeProvider>
        <body className="text-base">
          <div className="flex min-h-screen w-full flex-col items-stretch">
            <Header />
            <main className="w-full flex-grow">{children}</main>
            <Footer />
          </div>
        </body>
      </ThemeProvider>
    </html>
  );
}
