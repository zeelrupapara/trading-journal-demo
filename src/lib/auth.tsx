import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type User = { email: string; name: string; avatar?: string };
type AuthCtx = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (patch: Partial<User>) => void;
};

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "qj_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  const login = async (email: string, _password: string) => {
    // demo: any email/password works
    const name = email.split("@")[0]?.replace(/[._-]/g, " ") || "Trader";
    const u: User = { email, name: name.charAt(0).toUpperCase() + name.slice(1) };
    localStorage.setItem(KEY, JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem(KEY);
    setUser(null);
  };

  const updateProfile = (patch: Partial<User>) => {
    setUser((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...patch };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  };

  return <Ctx.Provider value={{ user, login, logout, updateProfile }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
