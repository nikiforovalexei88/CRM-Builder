import React, { createContext, useContext, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, AuthUser } from "@workspace/api-client-react";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, isLoading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const shouldCheckSession = location !== "/" && location !== "/login";
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: shouldCheckSession,
      retry: false,
    }
  });

  useEffect(() => {
    if (shouldCheckSession && !isLoading && isError && location !== "/login") {
      setLocation("/login");
    }
  }, [shouldCheckSession, isLoading, isError, location, setLocation]);

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading: shouldCheckSession ? isLoading : false }}>
      {children}
    </AuthContext.Provider>
  );
}
