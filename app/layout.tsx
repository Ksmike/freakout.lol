import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RootProviders } from "@/components/providers/RootProviders";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Freakout.lol | Open-Source Knowledge-Graph Led Data Annotation & Investigation",
  description:
    "Freakout is an open-source platform for knowledge-graph led data annotation and investigation. Define ontologies, upload documents, and generate structured insights.",
};

// Runs synchronously before React hydrates — prevents flash of wrong theme.
const themeScript = `
  try {
    const t = localStorage.getItem("dd:theme");
    const root = document.documentElement;
    if (t === "dark") { root.classList.add("dark"); root.classList.remove("light"); }
    else { root.classList.add("light"); root.classList.remove("dark"); }
  } catch {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased overflow-x-hidden`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden w-full" suppressHydrationWarning>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
