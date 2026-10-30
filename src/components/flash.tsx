"use client";

import { useEffect } from "react";
import { Notice } from "./ui";

export function Flash({ ok, message }: { ok: boolean; message: string }) {
  useEffect(() => {
    document.cookie = "pv_flash=; Max-Age=0; path=/admin";
  }, [message]);
  return (
    <Notice tone={ok ? "success" : "error"} className="animate-rise">
      {message}
    </Notice>
  );
}
