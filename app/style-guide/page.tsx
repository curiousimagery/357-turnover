import { SiteHeader } from "@/components/site-header";
import { StyleGuide } from "@/components/style-guide";

export const metadata = {
  title: "Style Guide — 357 Oasis Turnovers",
};

export default function StyleGuidePage() {
  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-display">Style Guide</h1>
          <p className="text-body text-muted-foreground">
            The visual source of truth. Every token and core component renders
            here — tune token values centrally and watch everything update.
          </p>
        </div>
        <StyleGuide />
      </main>
    </div>
  );
}
