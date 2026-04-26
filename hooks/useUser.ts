"use client";
import { useState, useEffect } from "react";

export interface User {
  user_id: string;
  username: string;
  token: string;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cogit_user");
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch { localStorage.removeItem("cogit_user"); }
    }
  }, []);

  function login(data: { token: string; user_id: string; username: string }) {
    const u = { user_id: data.user_id, username: data.username, token: data.token };
    localStorage.setItem("cogit_user", JSON.stringify(u));
    setUser(u);
  }

  function logout() {
    localStorage.removeItem("cogit_user");
    setUser(null);
  }

  return { user, login, logout };
}
