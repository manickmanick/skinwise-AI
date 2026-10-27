import { createContext } from "react";
export interface User {
  id: string;
  email: string;
}
export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<void>;
}
export const AuthContext = createContext<AuthContextValue | null>(null);
