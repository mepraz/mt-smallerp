
"use client";

import * as React from "react";
import { getSession, SessionData } from "@/lib/session";

export function useSession() {
  const [session, setSession] = React.useState<SessionData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchSession() {
      try {
        // This is a client-side fetch to an API route that gets the session
        const res = await fetch('/api/session');
        if (res.ok) {
          const data = await res.json();
          setSession(data);
        }
      } catch (error) {
        console.error("Failed to fetch session", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, []);

  return { session, loading };
}
