import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { trpc } from "./trpc";

interface TelegramAuthContextValue {
  user: TelegramUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

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

const TelegramAuthContext = createContext<TelegramAuthContextValue | null>(null);

export function TelegramAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("dc_token"));
  const [isTelegramReady, setIsTelegramReady] = useState(false);

  const utils = trpc.useUtils();

  const loginMutation = trpc.telegramAuth.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("dc_token", data.token);
      setToken(data.token);
    },
  });

  const {
    data: user,
    isLoading: meLoading,
    refetch,
  } = trpc.telegramAuth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
    enabled: !!token,
  });

  const login = async () => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) {
      console.warn("Telegram WebApp not available");
      return;
    }
    const initData = tg.initData;
    if (!initData) {
      console.warn("No initData available");
      return;
    }
    await loginMutation.mutateAsync({ initData });
    await refetch();
  };

  const logout = () => {
    localStorage.removeItem("dc_token");
    setToken(null);
    utils.invalidate();
  };

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      setIsTelegramReady(true);
    } else {
      setIsTelegramReady(true);
    }
  }, []);

  useEffect(() => {
    if (isTelegramReady && token) {
      refetch();
    }
  }, [isTelegramReady, token, refetch]);

  // Auto-login on mount if Telegram is available and no token
  useEffect(() => {
    if (isTelegramReady && !token) {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.initData) {
        loginMutation.mutate({ initData: tg.initData });
      }
    }
  }, [isTelegramReady]);

  const isLoading = meLoading || loginMutation.isPending || !isTelegramReady;

  return (
    <TelegramAuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </TelegramAuthContext.Provider>
  );
}

export function useTelegramAuth() {
  const ctx = useContext(TelegramAuthContext);
  if (!ctx) throw new Error("useTelegramAuth must be used within TelegramAuthProvider");
  return ctx;
}
