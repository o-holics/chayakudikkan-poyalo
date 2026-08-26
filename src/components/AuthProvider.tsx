'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { onIdTokenChanged, User } from 'firebase/auth';
import { auth } from '@/lib/clientApp';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
