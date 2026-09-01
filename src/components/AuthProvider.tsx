"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { onIdTokenChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

type AuthValue = {
  user: User | null;
  loading: boolean;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  user: null,
  loading: true,
  getToken: async () => null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function setSessionHint(present: boolean) {
  try {
    document.cookie = present
      ? "__session=1; path=/; max-age=3600; SameSite=Lax"
      : "__session=; path=/; max-age=0; SameSite=Lax";
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onIdTokenChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      setSessionHint(Boolean(u));
    });
  }, []);

  const getToken = useCallback(async () => {
    return auth.currentUser ? auth.currentUser.getIdToken() : null;
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    setSessionHint(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, getToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
