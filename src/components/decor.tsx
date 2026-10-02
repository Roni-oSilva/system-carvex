/** Formas flutuantes decorativas do fundo (só CSS; desligadas com prefers-reduced-motion). */
export function Decor() {
  return (
    <div aria-hidden="true" className="no-print pointer-events-none fixed inset-0 -z-0 hidden overflow-hidden md:block">
      <span className="float absolute left-[3%] top-[22%] h-14 w-14 rounded-full border-[3px] border-[#0e1240] bg-[#ffd23f]" style={{ ["--r" as string]: "0deg" }} />
      <span className="float absolute right-[4%] top-[34%] h-16 w-16 rounded-2xl border-[3px] border-[#0e1240] bg-[#8a5cf6]" style={{ ["--r" as string]: "14deg", animationDelay: "-2s" }} />
      <span className="float absolute bottom-[18%] left-[2%] h-20 w-20 rounded-full border-[6px] border-white/80" style={{ animationDelay: "-4s" }} />
      <span className="float absolute bottom-[30%] right-[2%] h-10 w-10 rounded-full border-[3px] border-[#0e1240] bg-[#ff6fa5]" style={{ animationDelay: "-1s" }} />
      <span className="absolute -right-24 top-40 h-72 w-72 rounded-full bg-white/10" />
      <span className="absolute -left-32 bottom-10 h-80 w-80 rounded-full bg-white/10" />
    </div>
  );
}
