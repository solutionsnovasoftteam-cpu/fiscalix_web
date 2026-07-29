import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/LegalDocumentPage";
import { privacyDocument } from "@/lib/legalDocuments";

export const metadata: Metadata = {
  description: "Aviso de privacidad integral de Fiscalix.",
  title: "Aviso de privacidad | Fiscalix",
};

export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      alternateHref="/terms"
      alternateLabel="Términos de servicio"
      document={privacyDocument}
    />
  );
}
