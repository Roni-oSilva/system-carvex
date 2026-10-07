/** Esqueleto instantâneo enquanto a página carrega: a navegação responde na hora. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] animate-pulse space-y-4 px-4 py-5 sm:px-6 lg:ml-[232px]" aria-busy="true" aria-label="Carregando">
      <div className="h-7 w-48 rounded-lg bg-[#e2e5f0]" />
      <div className="h-40 rounded-2xl bg-[#e2e5f0]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-[#e2e5f0]" />)}</div>
    </div>
  );
}
