import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Adaptador temporário para migrations Premium ainda não aplicadas ao banco.
 * Substituir pelo cliente tipado após gerar novamente supabase/types.ts.
 * Nunca usar esta conversão para autorizar ações: o Postgres/RLS/RPC é a fonte de acesso.
 */
export const premiumDb = supabase as unknown as SupabaseClient;

export type ProfessionalPublic = {
  id: string;
  display_name: string;
  specialty: string | null;
};
export type MemberRow = {
  id: string;
  user_id: string;
  role: "owner" | "professional";
  status: "invited" | "active" | "revoked";
};
export type BusinessRow = { id: string; name: string; owner_user_id: string };
export type EntitlementRow = {
  plan_key: "essencial" | "pro" | "premium";
  status: string;
  seat_limit: number;
  valid_until: string | null;
};
export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
