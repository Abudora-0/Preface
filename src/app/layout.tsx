import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Preface: README generator and editor",
  description:
    "Dump your project in and get a well-organised README out. Live GitHub-accurate preview, badge builder, repo import, and five templates.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
