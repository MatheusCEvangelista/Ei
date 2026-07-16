import { useState, useEffect } from 'react';

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Verifica se já está instalado ou foi dispensado
    const wasDismissed = localStorage.getItem('pwa-dismissed');
    if (wasDismissed) return;

    // iOS: não tem beforeinstallprompt, mas tem o botão "Adicionar à tela"
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    const standalone = window.navigator.standalone;
    if (ios && !standalone) {
      setIsIOS(true);
      setTimeout(() => setShow(true), 3000);
      return;
    }

    // Android/Chrome: usa o evento nativo
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      setTimeout(() => setShow(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    setShow(false);
    setDismissed(true);
    localStorage.setItem('pwa-dismissed', '1');
  }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setPrompt(null);
  }

  if (!show || dismissed) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 100,
      background: 'var(--bg2)', border: '1px solid var(--border-md)',
      borderRadius: 16, padding: '16px 18px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: 14,
      animation: 'fadeUp 0.3s ease forwards',
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,var(--indigo),#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
        💰
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
          Instalar FinanceApp
        </p>
        <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>
          {isIOS
            ? 'Toque em compartilhar → "Adicionar à Tela de Início"'
            : 'Adicione à tela inicial para acesso rápido'}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {!isIOS && (
          <button onClick={install} style={{
            padding: '7px 14px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg,var(--indigo),#a78bfa)',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font)',
          }}>
            Instalar
          </button>
        )}
        <button onClick={dismiss} style={{
          padding: '5px 14px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--text3)', fontSize: 12, cursor: 'pointer',
          fontFamily: 'var(--font)',
        }}>
          Agora não
        </button>
      </div>
    </div>
  );
}
