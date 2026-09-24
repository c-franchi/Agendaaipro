import { ReactNode, useCallback, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

type ProtectedRouteProps = { children: ReactNode; role?: "admin" | "customer" };

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const location = useLocation();
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");

  const validateSession = useCallback(async (session: Session | null, active = true) => {
    if (!session) {
      if (active) setState("denied");
      return;
    }
    if (!role) {
      if (active) setState("allowed");
      return;
    }
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", role)
      .maybeSingle();
    if (active) setState(data ? "allowed" : "denied");
  }, [role]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => validateSession(data.session, active));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void validateSession(session, active);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [validateSession]);

  if (state === "loading") return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Verificando acesso...</div>;
  if (state === "denied") return <Navigate to={role === "admin" ? "/admin" : "/cliente"} replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}
