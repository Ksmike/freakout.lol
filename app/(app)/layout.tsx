import { Sidebar } from "@/components/Sidebar";
import { MobileSidebar } from "@/components/MobileSidebar";
import { Providers } from "@/components/providers/Providers";
import { FirmSwitcher } from "@/components/FirmSwitcher";
import { auth } from "@/lib/auth";
import { listUserFirms } from "@/lib/actions/firm";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user
    ? {
        id: session.user.id!,
        locale: session.user.locale ?? "en",
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }
    : null;

  const firms = user ? await listUserFirms() : [];

  return (
    <Providers user={user}>
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-clip md:flex-row">
        {/* Mobile header with hamburger */}
        <header className="flex w-full min-w-0 items-center gap-3 border-b border-divider bg-background px-4 py-3 md:hidden">
          <MobileSidebar />
          <span className="text-sm font-semibold text-foreground">
            KG Qualify
          </span>
        </header>

        {/* Desktop sidebar */}
        <Sidebar firms={firms} />

        <main className="flex min-h-0 min-w-0 w-full flex-1 overflow-x-clip overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </Providers>
  );
}
