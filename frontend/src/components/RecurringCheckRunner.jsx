import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

// Componente silencioso — chama /api/recurring/check uma vez por dia ao abrir o app
export default function RecurringCheckRunner() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const today    = new Date().toDateString();
    const lastCheck = localStorage.getItem('ei_recurring_check');

    // Só verifica uma vez por dia
    if (lastCheck === today) return;

    api.post('/api/recurring/check')
      .then(({ data }) => {
        if (data.created?.length > 0) {
          localStorage.setItem('ei_recurring_check', today);
          // Dispara evento para o NotificationBell atualizar o badge
          window.dispatchEvent(new CustomEvent('ei:notifications-updated'));
        } else {
          localStorage.setItem('ei_recurring_check', today);
        }
      })
      .catch(() => {});
  }, [user]);

  return null;
}
