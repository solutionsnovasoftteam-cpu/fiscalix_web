import Link from "next/link";
import Image from "next/image";
import fiscalixLogo from "../../logo-fiscalix.png";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="brand" aria-label="Fiscalix, inicio">
      <Image
        src={fiscalixLogo}
        alt="Fiscalix"
        className={compact ? "brand-logo compact" : "brand-logo"}
        priority
      />
    </Link>
  );
}
