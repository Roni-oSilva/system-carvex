"use client";

import { useEffect, useState } from "react";

export function Clock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const f = () => setT(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    f();
    const i = setInterval(f, 15_000);
    return () => clearInterval(i);
  }, []);
  return <span suppressHydrationWarning>{t}</span>;
}
