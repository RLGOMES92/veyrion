"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false);
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setNotice(error.message);
      if (data.session) {
        router.replace("/brokerage");
      } else {
        setCheckingSession(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace("/brokerage");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function signIn() {
    if (!supabase) {
      setNotice("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel.");
      return;
    }

    const targetEmail = email.trim().toLowerCase();
    const at = targetEmail.indexOf("@");
    if (at < 1 || targetEmail.lastIndexOf(".") <= at + 1) {
      setNotice("Informe um e-mail corporativo válido.");
      return;
    }

    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    setNotice(error ? error.message : "Link de acesso enviado. Confira seu e-mail.");
    setSending(false);
  }

  return (
    <main className="login panel">
      <div className="eyebrow">Tecnologia · Inteligência · Crescimento</div>
      <h1>VEYRION OS</h1>
      <p className="muted">
        Gestão B2B de empresas, propostas, contratos, assinatura eletrônica,
        ativação e notificação ao fornecedor.
      </p>

      {!supabase && (
        <div className="notice">
          Backend ainda não configurado. Adicione as variáveis do Supabase na Vercel.
        </div>
      )}

      {checkingSession ? (
        <div className="notice" role="status">Verificando sessão segura…</div>
      ) : (
        <>
          <label className="muted" htmlFor="veyrion-email">E-mail corporativo</label>
          <input
            id="veyrion-email"
            className="field"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com.br"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            className="btn"
            disabled={sending || !email.trim() || !supabase}
            onClick={() => void signIn()}
          >
            {sending ? "Enviando…" : "Enviar link seguro de acesso"}
          </button>
        </>
      )}

      {notice && <div className="notice" role="status">{notice}</div>}
      <p className="footer-note">
        Pagamentos, cobranças, split e repasses são realizados fora da plataforma.
      </p>
    </main>
  );
}
