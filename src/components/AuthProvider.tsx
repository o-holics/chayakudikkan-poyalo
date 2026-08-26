'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { onIdTokenChanged, signOut as fbSignOut, User } from 'firebase/auth';
import { auth } from '@/lib/clientApp';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const logout = async () => {
    try {
      await fbSignOut(auth);
      document.cookie = '__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      setUser(null);
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      if (currentUser) {
        const token = await currentUser.getIdToken();
        // Set the token as a cookie so Server Components can access it
        document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax`;
        setUser(currentUser);
      } else {
        document.cookie = '__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        setUser(null);
      }
      setLoading(false);
      router.refresh(); // Refresh so server components re-evaluate with the new cookie
    });

  return () => unsubscribe();
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
