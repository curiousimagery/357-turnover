import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Suspense } from "react";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;
  return (
    <p className="text-caption text-muted-foreground">
      {params?.error
        ? `Details: ${params.error}`
        : "An unspecified error occurred."}
    </p>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-heading">
              Sorry, something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Suspense>
              <ErrorContent searchParams={searchParams} />
            </Suspense>
            <Button asChild variant="outline" size="touch">
              <Link href="/auth/login">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
