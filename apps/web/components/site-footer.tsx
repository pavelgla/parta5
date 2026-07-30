import { getCurrentSchool } from '@/lib/school-context';
import { getFileUrl } from '@/lib/file-url';

/** Keeps only digits and a leading "+" — turns "(8142) 63-16-45" into a valid `tel:` href. */
function toTelHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export async function SiteFooter() {
  const school = await getCurrentSchool();
  const year = new Date().getFullYear();

  // No school resolved (e.g. a fresh self-host before onboarding) — nothing
  // to brand a footer with, so just the bottom bar with the platform name.
  if (!school) {
    return (
      <footer className="bg-[#1d2125] px-4 py-3 text-center text-xs text-gray-400">
        © {year} Парта5
      </footer>
    );
  }

  const schoolLabel = school.displayName ?? school.name;
  const hasQuickLinks = school.footerLinks.length > 0 || !!school.siteUrl;
  const hasContacts = !!(school.contactAddress || school.contactPhone || school.contactEmail);

  return (
    <footer>
      <div className="bg-[var(--brand)] text-[var(--brand-foreground)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
          {/* Column 1: logo / name + legal name */}
          <div className="flex flex-col gap-3">
            {school.logoFileAssetId ? (
              // Логотип ПСР — тёмно-синие буквы на прозрачном фоне, поэтому на
              // цветной подложке футера он "утонет": кладём его на белый бейдж.
              <div className="inline-flex w-fit items-center rounded-lg bg-white px-3 py-2">
                <img
                  src={getFileUrl({ id: school.logoFileAssetId })}
                  alt={schoolLabel}
                  className="h-8 w-auto"
                />
              </div>
            ) : (
              <span className="text-lg font-bold">{schoolLabel}</span>
            )}
            {school.legalName && <p className="max-w-xs text-sm opacity-80">{school.legalName}</p>}
          </div>

          {/* Column 2: quick links */}
          {hasQuickLinks && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">
                Быстрые ссылки
              </h2>
              <ul className="flex flex-col gap-1.5">
                {school.footerLinks.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm underline-offset-2 hover:underline"
                    >
                      {link.title}
                    </a>
                  </li>
                ))}
                {school.siteUrl && (
                  <li>
                    <a
                      href={school.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm underline-offset-2 hover:underline"
                    >
                      Сайт организации
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Column 3: contacts */}
          {hasContacts && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Контакты</h2>
              <ul className="flex flex-col gap-1.5 text-sm">
                {school.contactAddress && <li>{school.contactAddress}</li>}
                {school.contactPhone && (
                  <li>
                    <a
                      href={toTelHref(school.contactPhone)}
                      className="underline-offset-2 hover:underline"
                    >
                      {school.contactPhone}
                    </a>
                  </li>
                )}
                {school.contactEmail && (
                  <li>
                    <a
                      href={`mailto:${school.contactEmail}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {school.contactEmail}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#1d2125] px-4 py-3 text-xs text-gray-400">
        <span>
          © {year} {schoolLabel}
        </span>
        <a
          href="https://parta5.ru"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-300"
        >
          Работает на Парта5
        </a>
      </div>
    </footer>
  );
}
