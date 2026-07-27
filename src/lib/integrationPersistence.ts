import "server-only";

import { supabase } from "@/lib/supabase";

export type IntegrationDbRow = {
  auto_sync?: boolean | null;
  estado: string | null;
  id: string;
  nombre: string | null;
  partner: string | null;
  tipo: string | null;
  ultima_sincronizacion?: string | null;
};

export type IntegrationSavePayload = {
  auto_sync?: boolean;
  estado: string;
  nombre: string;
  partner: string;
  tipo: string;
  ultima_sincronizacion?: string | null;
};

type IntegrationError = {
  code?: string;
  details?: string;
  message?: string;
};

type IntegrationResult = {
  data: IntegrationDbRow | null;
  error: IntegrationError | null;
  limitedPersistence: boolean;
};

type IntegrationTarget = {
  databaseId?: string | null;
  partner?: string | null;
};

export const baseIntegrationSelect = "id,nombre,tipo,estado,partner";
export const extendedIntegrationSelect = "id,nombre,tipo,estado,partner,auto_sync,ultima_sincronizacion";

export function isMissingIntegrationOptionalColumn(error: IntegrationError | null | undefined) {
  if (!error) return false;
  const text = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    text.includes("auto_sync") ||
    text.includes("ultima_sincronizacion") ||
    text.includes("schema cache") ||
    text.includes("column")
  );
}

function basePayload(payload: IntegrationSavePayload) {
  return {
    estado: payload.estado,
    nombre: payload.nombre,
    partner: payload.partner,
    tipo: payload.tipo,
  };
}

function extendedPayload(payload: IntegrationSavePayload) {
  return {
    ...basePayload(payload),
    auto_sync: Boolean(payload.auto_sync),
    ultima_sincronizacion: payload.ultima_sincronizacion ?? null,
  };
}

export async function listIntegrations() {
  const extended = await supabase
    .from("integraciones")
    .select(extendedIntegrationSelect)
    .order("nombre", { ascending: true });

  if (!extended.error || !isMissingIntegrationOptionalColumn(extended.error)) {
    return {
      data: (extended.data ?? []) as unknown as IntegrationDbRow[],
      error: extended.error as IntegrationError | null,
      limitedPersistence: false,
    };
  }

  const fallback = await supabase
    .from("integraciones")
    .select(baseIntegrationSelect)
    .order("nombre", { ascending: true });

  return {
    data: (fallback.data ?? []) as unknown as IntegrationDbRow[],
    error: fallback.error as IntegrationError | null,
    limitedPersistence: true,
  };
}

export async function insertIntegration(payload: IntegrationSavePayload): Promise<IntegrationResult> {
  const extended = await supabase
    .from("integraciones")
    .insert(extendedPayload(payload))
    .select(extendedIntegrationSelect)
    .single();

  if (!extended.error || !isMissingIntegrationOptionalColumn(extended.error)) {
    return {
      data: extended.data as unknown as IntegrationDbRow | null,
      error: extended.error as IntegrationError | null,
      limitedPersistence: false,
    };
  }

  const fallback = await supabase
    .from("integraciones")
    .insert(basePayload(payload))
    .select(baseIntegrationSelect)
    .single();

  return {
    data: fallback.data as unknown as IntegrationDbRow | null,
    error: fallback.error as IntegrationError | null,
    limitedPersistence: true,
  };
}

async function updateIntegrationByTarget(
  target: Required<IntegrationTarget>,
  payload: IntegrationSavePayload,
  extended: boolean,
) {
  let query = supabase
    .from("integraciones")
    .update(extended ? extendedPayload(payload) : basePayload(payload));

  query = target.databaseId
    ? query.eq("id", target.databaseId)
    : query.eq("partner", target.partner);

  return query
    .select(extended ? extendedIntegrationSelect : baseIntegrationSelect)
    .maybeSingle();
}

export async function updateOrInsertIntegration(
  target: IntegrationTarget,
  payload: IntegrationSavePayload,
): Promise<IntegrationResult> {
  const normalizedTarget = {
    databaseId: target.databaseId?.trim() || "",
    partner: target.partner?.trim() || payload.partner,
  };

  const extended = await updateIntegrationByTarget(normalizedTarget, payload, true);

  if (extended.error && isMissingIntegrationOptionalColumn(extended.error)) {
    const fallback = await updateIntegrationByTarget(normalizedTarget, payload, false);

    if (fallback.error) {
      return {
        data: null,
        error: fallback.error as IntegrationError,
        limitedPersistence: true,
      };
    }

    if (fallback.data) {
      return {
        data: fallback.data as unknown as IntegrationDbRow,
        error: null,
        limitedPersistence: true,
      };
    }

    const inserted = await insertIntegration(payload);
    return {
      ...inserted,
      limitedPersistence: true,
    };
  }

  if (extended.error) {
    return {
      data: null,
      error: extended.error as IntegrationError,
      limitedPersistence: false,
    };
  }

  if (extended.data) {
    return {
      data: extended.data as unknown as IntegrationDbRow,
      error: null,
      limitedPersistence: false,
    };
  }

  return insertIntegration(payload);
}
