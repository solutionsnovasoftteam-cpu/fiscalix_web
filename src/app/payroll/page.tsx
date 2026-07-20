import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { PayrollHub } from "@/app/payroll/payroll-hub";

export default async function PayrollPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell activeHref="/payroll" user={user}>
      <PayrollHub />
    </AppShell>
  );
}
