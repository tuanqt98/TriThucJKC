"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type User } from "./api";

export function useManagement<T>(path: string) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const [u, r] = await Promise.all([api<User>("/auth/me"), api<T[]>(path)]);
    setUser(u);
    setRows(r);
  }, [path]);
  useEffect(() => {
    Promise.resolve()
      .then(reload)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [reload, router]);
  async function mutate(endpoint: string, payload: unknown, method = "POST") {
    if (!user) return null;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<Record<string, unknown>>(
        endpoint,
        { method, body: JSON.stringify(payload) },
        user.csrf_token,
      );
      await reload();
      setNotice("Đã lưu dữ liệu và nhật ký.");
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return {
    user,
    rows,
    error,
    notice,
    busy: busy || loading || !user,
    loading,
    mutate,
    reload,
  };
}
