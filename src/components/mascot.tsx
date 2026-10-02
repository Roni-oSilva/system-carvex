/** Mascote da Carvex: gato preto de pelúcia com focinho branco e gravata azul. Desenho original — para usar o seu arquivo oficial, troque o conteúdo deste componente por <img src="/mascote.png" />. */
export function Mascot({ size = 120, mood = "happy", wave = false, className = "" }: { size?: number; mood?: "happy" | "wink" | "sleep"; wave?: boolean; className?: string }) {
  const eye = (cx: number, closed: boolean) =>
    closed ? <path d={`M${cx - 10} 78 Q${cx} 90 ${cx + 10} 78`} stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" /> : (
      <>
        <ellipse cx={cx} cy="76" rx="10" ry="12" fill="#fff" />
        <circle cx={cx + 2} cy="79" r="6.5" fill="#0a0a10" />
        <circle cx={cx + 5} cy="75" r="2.2" fill="#fff" />
      </>
    );
  return (
    <svg viewBox="0 0 200 236" width={size} height={size * 1.18} role="img" aria-label="Mascote da Carvex, um gatinho preto" className={className}>
      <defs>
        <linearGradient id="mfur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a3a47" /><stop offset="1" stopColor="#0a0a10" /></linearGradient>
        <linearGradient id="mmuz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#d6e0ff" /></linearGradient>
      </defs>
      <ellipse cx="100" cy="230" rx="62" ry="6" fill="#0e1240" opacity=".25" />
      <path d="M138 200 C196 204 202 140 170 126" stroke="url(#mfur)" strokeWidth="20" fill="none" strokeLinecap="round" />
      <path d="M62 168 C62 138 138 138 138 168 L144 214 C144 226 56 226 56 214 Z" fill="url(#mfur)" />
      <ellipse cx="58" cy="180" rx="13" ry="27" transform="rotate(12 58 180)" fill="url(#mfur)" />
      <g className={wave ? "bob" : undefined}>
        <ellipse cx={wave ? 152 : 142} cy={wave ? 152 : 180} rx="13" ry="27" transform={wave ? "rotate(-38 152 152)" : "rotate(-12 142 180)"} fill="url(#mfur)" />
      </g>
      <ellipse cx="82" cy="224" rx="18" ry="9" fill="#0a0a10" /><ellipse cx="118" cy="224" rx="18" ry="9" fill="#0a0a10" />
      <path d="M100 150 L74 138 L74 162 Z M100 150 L126 138 L126 162 Z" fill="#2f5bff" stroke="#0e1240" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="100" cy="150" r="7" fill="#1b2fd1" stroke="#0e1240" strokeWidth="2.5" />
      <path d="M48 76 L42 18 Q44 11 51 15 L94 44 Z" fill="url(#mfur)" /><path d="M152 76 L158 18 Q156 11 149 15 L106 44 Z" fill="url(#mfur)" />
      <path d="M55 62 L52 31 L80 49 Z" fill="#6b3f63" /><path d="M145 62 L148 31 L120 49 Z" fill="#6b3f63" />
      <ellipse cx="100" cy="94" rx="64" ry="54" fill="url(#mfur)" />
      <path d="M42 106 C52 84 74 98 100 92 C126 98 148 84 158 106 C158 136 130 150 100 150 C70 150 42 136 42 106 Z" fill="url(#mmuz)" />
      {eye(78, mood === "sleep")}{eye(122, mood === "sleep" || mood === "wink")}
      <path d="M94 108 Q100 103 106 108 Q100 116 94 108 Z" fill="#ff6fa5" />
      <path d="M100 114 Q100 124 90 124 M100 114 Q100 124 110 124" stroke="#0a0a10" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="66" cy="112" r="6" fill="#ffb3cf" opacity=".7" /><circle cx="134" cy="112" r="6" fill="#ffb3cf" opacity=".7" />
      <path d="M54 118 L30 114 M54 124 L30 128 M146 118 L170 114 M146 124 L170 128" stroke="#8d9ad0" strokeWidth="2" strokeLinecap="round" />
      {mood === "sleep" && <text x="156" y="40" fontSize="22" fontWeight="900" fill="#0e1240" opacity=".7">z</text>}
    </svg>
  );
}
