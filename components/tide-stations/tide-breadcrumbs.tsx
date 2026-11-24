import Link from "next/link";

import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";

interface TideCrumb {
  name: string;
  path: string;
}

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app").replace(/\/$/, "");

/** Visible breadcrumb plus its BreadcrumbList, from one list so the two never drift. */
export function TideBreadcrumbs({ crumbs }: { crumbs: TideCrumb[] }) {
  return (
    <>
      <BreadcrumbStructuredData items={crumbs.map((c) => ({ name: c.name, url: `${baseUrl}${c.path}` }))} />
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-[#11100D]/60"
      >
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <span key={crumb.path} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page" className="text-[#11100D]">{crumb.name}</span>
              ) : (
                <Link href={crumb.path} className="transition-colors hover:text-[#AA4918]">
                  {crumb.name}
                </Link>
              )}
              {!last && <span aria-hidden>/</span>}
            </span>
          );
        })}
      </nav>
    </>
  );
}
