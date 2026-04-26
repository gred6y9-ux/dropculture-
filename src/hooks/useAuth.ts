import { trpc } from "@/providers/trpc";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

export type TelegramUser = {
  id: number;
  telegramId: number | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  coins: number;
  stars: number;
  streakDays: number;
  role: "user" | "admin";
};

export function useAuth() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("dc_token"));

  const utils = trpc.useUtils();

  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = trpc.telegramAuth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
    enabled: !!token,
  });

  const logout = useCallback(() => {
    localStorage.removeItem("dc_token");
    setToken(null);
    utils.invalidate();
    navigate("/");
  }, [utils, navigate]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "dc_token") {
        setToken(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return useMemo(
    () => ({
      user: user ?? null,
      isAuthenticated: !!user,
      isLoading: isLoading && !!token,
      error,
      logout,
      refresh: refetch,
      token,
      setToken,
    }),
    [user, isLoading, token, error, logout, refetch],
  );
}
