import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/LegalDocumentPage";
import { termsDocument } from "@/lib/legalDocuments";

export const metadata: Metadata = {
  description: "Términos de servicio de Fiscalix.",
  title: "Términos de servicio | Fiscalix",
};

export default function TermsPage() {
  return (
    <LegalDocumentPage
      alternateHref="/privacy"
      alternateLabel="Aviso de privacidad"
      document={termsDocument}
    />
  );
}
