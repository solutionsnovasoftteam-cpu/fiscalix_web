import type { UserRole } from "@/lib/roles";
import type { UserPreferences } from "@/lib/userPreferences.shared";

export interface FiscalixUser {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  emailVerified?: boolean;
  preferences?: UserPreferences;
  rol: UserRole;
  telefono?: string | null;
  estado?: string | null;
  avatar_url?: string | null;
}
