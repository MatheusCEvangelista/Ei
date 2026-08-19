import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import OnboardingWizard from './OnboardingWizard';
import api from '../lib/api';

// Envolve o app e mostra o wizard se o usuário for novo
export default function OnboardingGuard({ children }) {
  const { user }      = useAuth();
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) { setChecked(true); return; }

    // Já fez onboarding antes?
    if (localStorage.getItem('ei_onboarding_done')) {
      setChecked(true); return;
    }

    // Verifica se usuário tem contas (sinal de que já configurou antes)
    api.get('/api/accounts').then(({ data }) => {
      if (!data || data.length === 0) setShow(true);
      else localStorage.setItem('ei_onboarding_done', '1');
      setChecked(true);
    }).catch(() => setChecked(true));
  }, [user]);

  if (!checked) return null; // evita flash

  return (
    <>
      {children}
      {show && (
        <OnboardingWizard onComplete={() => {
          setShow(false);
          window.location.reload(); // recarrega para refletir conta criada
        }}/>
      )}
    </>
  );
}
