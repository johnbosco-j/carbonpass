import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";
import "./globals.css";
import { DemoProvider } from "@/components/demo-provider";
import { TopBar } from "@/components/top-bar";

const serif = IBM_Plex_Serif({ variable: "--font-plex-serif", subsets: ["latin", "latin-ext"], weight: ["500", "600"] });
const sans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "CarbonPass: verified carbon passports for CBAM",
  description:
    "AI-prepared evidence, accredited verification with post-quantum signatures, and smart contracts that make double counting of verified low-carbon tonnes impossible.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable} antialiased`}>
      <body className="min-h-dvh">
        <DemoProvider>
          <TopBar />
          <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-8 sm:px-6">{children}</main>
        </DemoProvider>
      </body>
    </html>
  );
}
