import type { Metadata } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
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
const nunitoSans = Nunito_Sans({
  variable: "--font-sans",
  display: "swap",
  subsets: ["latin"],
});
// Headings only (the display/heading type tokens).
const nunito = Nunito({
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
      className={`${nunitoSans.variable} ${nunito.variable}`}
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
