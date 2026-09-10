import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

function getInitialTheme() {
  // 1. Preferência salva
  const saved = localStorage.getItem('ei_theme');
  if (saved === 'dark' || saved === 'light') return saved;
  // 2. Preferência do sistema operacional
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    // Aplica o tema no HTML
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ei_theme', theme);
  }, [theme]);

  // Sincroniza com mudanças do sistema (ex: modo noturno automático do iPhone)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function handle(e) {
      // Só segue o sistema se o usuário não tiver escolhido manualmente
      if (!localStorage.getItem('ei_theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    }
    mq.addEventListener('change', handle);
    return () => mq.removeEventListener('change', handle);
  }, []);

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }

  function setSystemTheme() {
    localStorage.removeItem('ei_theme');
    setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setSystemTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
