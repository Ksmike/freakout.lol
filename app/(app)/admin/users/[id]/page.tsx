import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LuArrowLeft, LuUserRound } from "react-icons/lu";
import { getLabelsForLocale } from "@/labels";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/authz/platform-admin";
import { db } from "@/lib/db";

export const metadata = {
  title: "User | Freakout.lol",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/admin/users/${id}`);
  }
  if (!isPlatformAdmin(session.user.systemRole)) {
    redirect("/dashboard");
  }

  const { labels, locale } = getLabelsForLocale(session.user.locale ?? "en");
  const t = labels.app.admin;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      locale: true,
      systemRole: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          apiKeys: true,
          diligenceJobs: true,
          firmMemberships: true,
          projects: true,
        },
      },
    },
  });

  if (!user) notFound();

  const detailRows = [
    { label: t.userIdLabel, value: user.id },
    { label: t.emailLabel, value: user.email },
    { label: t.nameLabel, value: user.name ?? t.emptyValue },
    { label: t.systemRoleLabel, value: user.systemRole },
    { label: t.localeLabel, value: user.locale },
    {
      label: t.emailVerifiedLabel,
      value: user.emailVerified
        ? formatDate(user.emailVerified, locale)
        : t.neverLabel,
    },
    { label: t.createdLabel, value: formatDate(user.createdAt, locale) },
    { label: t.updatedLabel, value: formatDate(user.updatedAt, locale) },
  ];

  const activityStats = [
    { label: t.projectsCountLabel, value: user._count.projects },
    { label: t.firmMembershipsCountLabel, value: user._count.firmMemberships },
    { label: t.apiKeysCountLabel, value: user._count.apiKeys },
    { label: t.diligenceJobsCountLabel, value: user._count.diligenceJobs },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl overflow-x-hidden">
      <Link
        href="/admin/users"
        className="mb-6 inline-flex items-center gap-1 text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <LuArrowLeft className="size-4" aria-hidden="true" />
        {t.backToUsersCta}
      </Link>

      <div className="mb-8 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <LuUserRound className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-foreground">
            {user.name ?? user.email}
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            {t.userDetailDescription}
          </p>
        </div>
      </div>

      <section className="mb-8 rounded-lg border border-divider bg-content1 p-4">
        <h2 className="sr-only">{t.userDetailHeading}</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {detailRows.map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="text-xs font-medium uppercase text-foreground/45">
                {row.label}
              </dt>
              <dd className="mt-1 break-words text-sm font-medium text-foreground">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {t.activityHeading}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {activityStats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-divider bg-content1 p-4"
            >
              <p className="text-xs font-medium uppercase text-foreground/45">
                {stat.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatDate(date: Date, locale: string): string {
  return date.toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
