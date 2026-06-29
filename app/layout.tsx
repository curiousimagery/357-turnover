import type { Metadata } from "next";
import { Lora, Nunito } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "357 Oasis Turnovers",
  description: "Cleaning turnover schedule for the 357 Oasis Airbnb.",
};

// Body + buttons (everything inherits this). Headings opt into `--font-display`
// via the type-token rule in globals.css.
const nunito = Nunito({
  variable: "--font-sans",
  display: "swap",
  subsets: ["latin"],
});
// Headings only (the display/heading type tokens).
const lora = Lora({
  variable: "--font-display",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${lora.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
