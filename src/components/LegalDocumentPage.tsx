import Image from "next/image";
import Link from "next/link";
import fiscalixLogo from "../../logo-fiscalix.png";
import type { LegalDocumentData } from "@/lib/legalDocuments";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function LegalDocumentPage({
  alternateHref,
  alternateLabel,
  document,
}: {
  alternateHref: string;
  alternateLabel: string;
  document: LegalDocumentData;
}) {
  return (
    <main className="legal-page">
      <header className="legal-hero">
        <nav className="legal-nav" aria-label="Navegación legal">
          <Link href="/login" className="legal-brand" aria-label="Volver a Fiscalix">
            <Image src={fiscalixLogo} alt="Fiscalix" priority />
          </Link>
          <div>
            <Link href="/login">Iniciar sesión</Link>
            <Link href={alternateHref}>{alternateLabel}</Link>
          </div>
        </nav>

        <div className="legal-hero-copy">
          <p>{document.badge}</p>
          <h1>{document.title}</h1>
          <span>
            {document.version} · Vigente desde {document.effectiveDate}
          </span>
        </div>
      </header>

      <section className="legal-layout">
        <aside className="legal-index" aria-label="Índice del documento">
          <strong>Contenido</strong>
          <ol>
            {document.sections.map((section) => (
              <li key={section.title}>
                <a href={`#${slugify(section.title)}`}>{section.title.replace(/^\d+\.\s*/, "")}</a>
              </li>
            ))}
          </ol>
        </aside>

        <article className="legal-document">
          <section className="legal-intro">
            {document.intro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>

          {document.sections.map((section) => (
            <section className="legal-section" id={slugify(section.title)} key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets?.length ? (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
              {section.subsections?.map((subsection) => (
                <div className="legal-subsection" key={subsection.title}>
                  <h3>{subsection.title}</h3>
                  {subsection.paragraphs?.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {subsection.bullets?.length ? (
                    <ul>
                      {subsection.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
              {section.note ? <p className="legal-note">{section.note}</p> : null}
            </section>
          ))}

          <footer className="legal-footer">
            <p>
              Documento preparado para Fiscalix. Los campos marcados como pendientes deben completarse con
              información oficial antes de publicar la versión definitiva.
            </p>
            <Link href="/login">Volver al inicio de sesión</Link>
          </footer>
        </article>
      </section>
    </main>
  );
}
