import Image from "next/image";
import Link from "next/link";
import fiscalixLogo from "../../logo-fiscalix.png";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="not-found-grid" aria-hidden="true" />
      <section className="not-found-card">
        <Link href="/" className="not-found-brand" aria-label="Fiscalix, inicio">
          <Image src={fiscalixLogo} alt="Fiscalix" priority />
        </Link>
        <p className="not-found-code">ERROR 404</p>
        <h1>Esta página no existe</h1>
        <p>La dirección que buscas puede haber cambiado, estar incompleta o ya no estar disponible.</p>
        <div className="not-found-actions">
          <Link href="/" className="not-found-primary">Ir al inicio</Link>
          <Link href="/login" className="not-found-secondary">Iniciar sesión</Link>
        </div>
      </section>
    </main>
  );
}
