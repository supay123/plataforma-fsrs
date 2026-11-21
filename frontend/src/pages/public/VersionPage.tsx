import { PublicPage } from "../../components/layout/PublicLayout";
import { BUSINESS } from "../../config/business";
import { APP_VERSION } from "../../config/version";

export function VersionPage() {
  return <PublicPage>
    <section className="mx-auto max-w-3xl px-4 py-14 text-center">
      <p className="text-sm text-slate-400">{BUSINESS.brand}</p>
      <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Versión {APP_VERSION}</h1>
    </section>
  </PublicPage>;
}
