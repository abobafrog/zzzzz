import { ArrowRight, KeyRound, LogIn, Mail, ShieldCheck, Sparkles, UserPlus, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { AuthMode, UserProfile } from '../types';
import { BrandLogo } from './BrandLogo';
import { VibeBackground } from './VibeBackground';

type Props = {
  onComplete: (profile: UserProfile) => void;
};

type FieldProps = {
  icon: typeof UserRound;
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  autoComplete?: string;
  onChange: (value: string) => void;
};

function Field({ icon: Icon, label, placeholder, type = 'text', value, autoComplete, onChange }: FieldProps) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}</span>
      <div className="auth-input-wrap">
        <Icon size={18} />
        <input
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
      </div>
    </label>
  );
}

export function AuthScreen({ onComplete }: Props) {
  const [mode, setMode] = useState<AuthMode>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const title = mode === 'register' ? 'Регистрация' : 'Войти в аккаунт';
  const helperText = useMemo(() => {
    if (mode === 'register') {
      return 'Сохранение истории, расширенные функции и полноценная рабочая сессия доступны после входа.';
    }
    return 'Вход локальный для этого приложения. Можно быстро вернуться к своей полной сессии.';
  }, [mode]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onComplete({
      id: crypto.randomUUID(),
      name: name.trim() || 'Desktop User',
      email: email.trim() || 'local@tsgen.app',
      skipped: false
    });
  };

  return (
    <div className="auth-shell auth-shell-v2 auth-shell-redesign">
      <VibeBackground className="auth-scene auth-scene-full" baseScale={0.86} energy={0.22} />
      <div className="auth-noise" />
      <div className="auth-orb auth-orb-top" />
      <div className="auth-orb auth-orb-bottom" />

      <section className="auth-layout auth-layout-redesign">
        <aside className="auth-hero auth-hero-redesign">
          <div className="brand-row brand-row-v2 brand-row-redesign">
            <div className="brand-badge brand-badge-v2 brand-badge-mark">
              <BrandLogo className="brand-mark" />
            </div>
            <div>
              <div className="eyebrow">Electron workspace</div>
              <h1>TSGen</h1>
            </div>
          </div>

          <div className="auth-hero-copy">
            <p className="auth-kicker">Новый стартовый экран</p>
            <h2>Красивый запуск, две сессии и акцент на входе.</h2>
            <p className="subtle-text auth-hero-text">
              При открытии приложения появляется анимированный загрузчик по центру, дальше — экран выбора.
              Гость попадает в облегчённую сессию, а зарегистрированный пользователь получает полный набор функций.
            </p>
          </div>

          <div className="auth-feature-list glass-card auth-feature-list-redesign">
            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <ShieldCheck size={16} />
              </div>
              <div>
                <strong>Две отдельные сессии</strong>
                <span>Guest mode с ограничениями и полный режим после регистрации.</span>
              </div>
            </div>
            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <Sparkles size={16} />
              </div>
              <div>
                <strong>Фон на весь экран</strong>
                <span>Эффект VibeBackground растянут на всю сцену и работает как живая подложка.</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="entry-grid">
          <section className="auth-card auth-card-v2 glass-card auth-card-redesign">
            <div className="auth-card-top">
              <div>
                <div className="eyebrow">Account access</div>
                <h3>{title}</h3>
              </div>
            </div>

            <p className="subtle-text auth-copy auth-copy-v2">{helperText}</p>

            <div className="mode-switch mode-switch-v2">
              <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} type="button">
                Регистрация
              </button>
              <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
                Вход
              </button>
            </div>

            <form className="auth-form auth-form-v2" onSubmit={submit}>
              <div className={mode === 'register' ? 'auth-field-animated expanded' : 'auth-field-animated collapsed'}>
                <Field
                  autoComplete="name"
                  icon={UserRound}
                  label="Имя"
                  onChange={setName}
                  placeholder="Например, Алина Воронцова"
                  value={name}
                />
              </div>

              <Field
                autoComplete="email"
                icon={Mail}
                label="Email"
                onChange={setEmail}
                placeholder="name@company.com"
                type="email"
                value={email}
              />

              <Field
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                icon={KeyRound}
                label="Пароль"
                onChange={setPassword}
                placeholder="Минимум 8 символов"
                type="password"
                value={password}
              />

              <button className="primary-btn primary-btn-v2" type="submit">
                {mode === 'register' ? <UserPlus size={16} /> : <LogIn size={16} />}
                <span>{mode === 'register' ? 'Зарегистрироваться' : 'Войти'}</span>
              </button>
            </form>

            <button
              className="register-cta ghost-btn ghost-btn-v2"
              onClick={() => onComplete({ id: crypto.randomUUID(), name: 'Guest', email: 'guest@local', skipped: true })}
              type="button"
            >
              <ArrowRight size={16} />
              Войти без регистрации
            </button>
          </section>
        </div>
      </section>
    </div>
  );
}
