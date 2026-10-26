import { useEffect, useState } from "react";
import { api, ApiError } from "./api";

export function useFetch<T>(url: string | null, auth: "user" | "admin" | false = false, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!url);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setLoading(true);
    api.get<T>(url, auth)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e: ApiError) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, auth, ...deps]);

  return { data, error, loading, setData };
}
