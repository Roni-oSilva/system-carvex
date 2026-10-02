"use client";

export function ConfirmButton({ children, message, className = "btn-ghost btn-danger" }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}

export function PrintButton() {
  return <button type="button" className="btn no-print" onClick={() => window.print()}>Imprimir / salvar PDF</button>;
}
