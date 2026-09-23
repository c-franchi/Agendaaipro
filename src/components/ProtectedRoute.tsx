import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type ProtectedRouteProps = { children: ReactNode; role?: "admin" | "customer" };

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const location = useLocation();
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    let active = true;
    const validate = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (active) setState("denied");
        return;
      }
      if (!role) {
        if (active) setState("allowed");
        return;
      }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", role).maybeSingle();
      if (active) setState(data ? "allowed" : "denied");
    };
    validate();
    const { data: listener } = supabase.auth.onAuthStateChange(() => validate());
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [role]);

  if (state === "loading") return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Verificando acesso...</div>;
  if (state === "denied") return <Navigate to={role === "admin" ? "/admin" : "/cliente"} replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}