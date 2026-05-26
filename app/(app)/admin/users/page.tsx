import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/authz/platform-admin";
import { updateUserSystemRole } from "@/lib/actions/admin";
import { getLabelsForLocale } from "@/labels";
import { LuArrowRight, LuUsers } from "react-icons/lu";

export const metadata = {
  title: "User Management | Freakout.lol",
};

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin/users");
  }
  if (!isPlatformAdmin(session.user.systemRole)) {
    redirect("/dashboard");
  }

  const { labels } = getLabelsForLocale(session.user.locale ?? "en");
  const t = labels.app.admin;
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      systemRole: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl overflow-x-hidden">
      <div className="mb-8 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <LuUsers className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t.usersHeading}</h1>
          <p className="mt-1 text-sm text-foreground/60">
            {t.usersDescription}
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-divider bg-content1">
        {users.length === 0 ? (
          <p className="p-6 text-center text-sm text-foreground/50">{t.usersEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[680px] divide-y divide-divider">
              <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  {t.tableUser}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  {t.tableJoined}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  {t.tableRole}
                </span>
                <span className="sr-only">{t.tableActions}</span>
                <span className="sr-only">{t.tableActions}</span>
              </div>

              {users.map((user) => {
                const isSelf = user.id === session.user.id;
                const isAdmin = user.systemRole === "ADMIN";
                const newRole = isAdmin ? "USER" : "ADMIN";

                return (
                  <div
                    key={user.id}
                    className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {user.name ?? user.email}
                      </p>
                      {user.name && (
                        <p className="truncate text-xs text-foreground/55">{user.email}</p>
                      )}
                    </div>

                    <p className="text-xs text-foreground/55">
                      {new Date(user.createdAt).toLocaleDateString("en", {
                        dateStyle: "medium",
                      })}
                    </p>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isAdmin
                          ? "bg-success/10 text-success"
                          : "bg-default/10 text-foreground/60"
                      }`}
                    >
                      {user.systemRole}
                    </span>

                    <Link
                      href={`/admin/users/${user.id}`}
                      className="flex items-center gap-1 rounded-md border border-divider px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-content2"
                    >
                      {t.inspectCta}
                      <LuArrowRight className="size-3" aria-hidden="true" />
                    </Link>

                    {isSelf ? (
                      <span className="w-20 text-center text-xs text-foreground/30">
                        {t.selfLabel}
                      </span>
                    ) : (
                      <form
                        action={async () => {
                          "use server";
                          await updateUserSystemRole(user.id, newRole);
                        }}
                      >
                        <button
                          type="submit"
                          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                            isAdmin
                              ? "border-divider text-foreground/60 hover:bg-content2"
                              : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                          }`}
                        >
                          {isAdmin ? t.demoteCta : t.promoteCta}
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
