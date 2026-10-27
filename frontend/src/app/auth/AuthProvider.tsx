import { useCallback, useEffect, useState, type ReactNode } from "react";
import { apiRequest } from "../../lib/api";
import { AuthContext, type User } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const result = await apiRequest<{ user: User | null }>("/auth/me");
      setUser(result.user);
      setError(null);
    } catch (e) {
      setUser(null);
      setError(e instanceof Error ? e.message : "Couldn't check your session.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    apiRequest<{ user: User | null }>("/auth/me")
      .then((result) => {
        if (active) {
          setUser(result.user);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (active) {
          setUser(null);
          setError(
            e instanceof Error ? e.message : "Couldn't check your session.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setError("Your session expired. Please sign in again.");
    };
    window.addEventListener("skinwise:session-expired", onExpired);
    return () =>
      window.removeEventListener("skinwise:session-expired", onExpired);
  }, []);
  const signIn = useCallback(async (email: string, password: string) => {
    const result = await apiRequest<{ user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setUser(result.user);
  }, []);
  const signUp = useCallback(async (email: string, password: string) => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const result = await apiRequest<{ user: User }>("/auth/register", {
      method: "POST",
      body: { email, password, timezone },
    });
    setUser(result.user);
  }, []);
  const signOut = useCallback(async () => {
    await apiRequest<void>("/auth/logout", { method: "POST" });
    setUser(null);
  }, []);
  const deleteAccount = useCallback(async () => {
    await apiRequest<void>("/auth/account", { method: "DELETE" });
    setUser(null);
  }, []);
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        deleteAccount,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
