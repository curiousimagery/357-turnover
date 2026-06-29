import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <p className="text-center text-heading">357 Oasis Turnovers</p>
        <LoginForm />
      </div>
    </div>
  );
}
