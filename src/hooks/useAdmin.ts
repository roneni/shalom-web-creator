import { useState, useCallback } from "react";

const ADMIN_KEY = "admin_password";

export function useAdmin() {
  const [password, setPassword] = useState<string>(() => {
    return sessionStorage.getItem(ADMIN_KEY) || "";
  });

  const isLoggedIn = password.length > 0;

  const login = useCallback((pwd: string) => {
    sessionStorage.setItem(ADMIN_KEY, pwd);
    setPassword(pwd);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(ADMIN_KEY);
    setPassword("");
  }, []);

  const getHeaders = useCallback(() => {
    return {
      "x-admin-password": password,
      "Content-Type": "application/json",
    };
  }, [password]);

  return { isLoggedIn, password, login, logout, getHeaders };
}
