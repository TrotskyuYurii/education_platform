import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useIdleTimeout, clearSharedActivity } from '../hooks/useIdleTimeout';
import { SessionTimeoutModal } from '../components/SessionTimeoutModal';
import { resetNavigationTracking } from '../utils/activityTracker';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export type PermissionScope = 'self' | 'team' | 'department' | 'all';

export interface User {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  role: 'user' | 'admin';
  roleKeys?: string[];
  permissions?: Record<string, PermissionScope>;
  isAdmin?: boolean;
  departments: string[];
  departmentId?: string;
  departmentName?: string;
  positionId?: string;
  managerId?: string;
  locationId?: string;
  avatarUrl?: string;
  phone?: string;
  hireDate?: string;
  isActive?: boolean;
  allowedCourseIds?: string[];
  allowedInstructionIds?: string[];
  requireEmailCode?: boolean;
}

/** Політика таймауту бездіяльності — приходить із сервера, щоб числа жили в одному місці. */
export interface SessionPolicy {
  idleTimeoutSeconds: number;
  warningSeconds: number;
}

export type LogoutReason = 'manual' | 'idle';

const DEFAULT_SESSION_POLICY: SessionPolicy = {
  idleTimeoutSeconds: 30 * 60,
  warningSeconds: 60
};

/**
 * Офлайн-сесія: профіль останнього входу, щоб без мережі відкривались збережені
 * матеріали. Це лише локальна копія — жодних даних із сервера без справжньої
 * сесії не отримати. Термін обмежений, вихід із системи її стирає.
 */
const OFFLINE_SESSION_KEY = 'viatec_offline_session';
const OFFLINE_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const rememberOfflineSession = (user: User) => {
  try {
    localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify({ user, savedAt: Date.now() }));
  } catch {}
};

const forgetOfflineSession = () => {
  try { localStorage.removeItem(OFFLINE_SESSION_KEY); } catch {}
};

const readOfflineSession = (): User | null => {
  try {
    const raw = localStorage.getItem(OFFLINE_SESSION_KEY);
    if (!raw) return null;
    const { user, savedAt } = JSON.parse(raw);
    if (!user?.id || !Number.isFinite(savedAt) || Date.now() - savedAt > OFFLINE_SESSION_MAX_AGE_MS) return null;
    return user;
  } catch {
    return null;
  }
};

/** Сервер недосяжний (немає мережі або шлюз не відповідає) — на відміну від «не авторизовано». */
const isServerUnreachable = (status?: number) =>
  !navigator.onLine || status === undefined || status === 502 || status === 503 || status === 504;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User, session?: SessionPolicy) => void;
  logout: (reason?: LogoutReason) => Promise<void>;
  hasPermission: (permission: string, minScope?: PermissionScope) => boolean;
  canManage: boolean;
  /** Саме роль «Адміністратор» (не делеговане право) — для розділів, які не можна видати іншим ролям. */
  isAdministrator: boolean;
  primaryRoleLabel: string;
  refreshUser: () => Promise<void>;
  /** Сесію щойно завершено через бездіяльність — екран входу пояснює це людині. */
  sessionExpired: boolean;
  dismissSessionExpired: () => void;
  sessionPolicy: SessionPolicy;
  /** Сесію відновлено з пристрою без зв'язку з сервером (офлайн-режим). */
  offlineSession: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SCOPE_RANKS: Record<PermissionScope, number> = {
  self: 1,
  team: 2,
  department: 3,
  all: 4
};

const ROLE_TITLES: Record<string, string> = {
  admin: 'Адміністратор',
  manager: 'Керівник',
  hr: 'HR-менеджер',
  contentManager: 'Контент-менеджер',
  employee: 'Співробітник'
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionPolicy, setSessionPolicy] = useState<SessionPolicy>(DEFAULT_SESSION_POLICY);
  const [offlineSession, setOfflineSession] = useState(false);
  const isOnline = useOnlineStatus();

  const applySessionPolicy = (session: any) => {
    if (session && Number.isFinite(session.idleTimeoutSeconds)) {
      setSessionPolicy({
        idleTimeoutSeconds: session.idleTimeoutSeconds,
        warningSeconds: Number.isFinite(session.warningSeconds)
          ? session.warningSeconds
          : DEFAULT_SESSION_POLICY.warningSeconds
      });
    }
  };

  const restoreOfflineSession = () => {
    const cached = readOfflineSession();
    if (cached) {
      setUser(cached);
      setOfflineSession(true);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        applySessionPolicy(data.session);
        if (data.user) {
          setUser(data.user);
          setOfflineSession(false);
          rememberOfflineSession(data.user);
        }
      } else if (isServerUnreachable(res.status)) {
        restoreOfflineSession();
      } else if (res.status === 401) {
        // Сесія на сервері завершилась — офлайн-копія більше не дійсна.
        forgetOfflineSession();
        setUser(null);
        setOfflineSession(false);
      }
    } catch (err) {
      // Мережі немає — відкриваємо збережені матеріали останнього користувача.
      if (isServerUnreachable()) restoreOfflineSession();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Зв'язок повернувся — перевіряємо, чи офлайн-сесія ще дійсна на сервері.
  useEffect(() => {
    if (isOnline && offlineSession) void fetchCurrentUser();
  }, [isOnline, offlineSession]);

  const login = (userData: User, session?: SessionPolicy) => {
    try { localStorage.setItem('viatec_current_tab', 'myday'); } catch {}
    applySessionPolicy(session);
    setSessionExpired(false);
    setOfflineSession(false);
    rememberOfflineSession(userData);
    setUser(userData);
  };
  
  const logout = useCallback(async (reason: LogoutReason = 'manual') => {
    clearSharedActivity();
    setSessionExpired(reason === 'idle');
    forgetOfflineSession();
    try {
      // Причину виходу сервер записує в журнал дій (вихід / бездіяльність).
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
    } catch {
      // Офлайн: серверна сесія завершиться сама, локально виходимо одразу.
    } finally {
      resetNavigationTracking();
      setOfflineSession(false);
      setUser(null);
    }
  }, []);

  const handleIdleTimeout = useCallback(() => {
    void logout('idle');
  }, [logout]);

  const { warningActive, secondsLeft, extendSession } = useIdleTimeout({
    // Без мережі серверної сесії, яку треба захищати, немає, а повторно увійти
    // офлайн неможливо — тож таймер бездіяльності працює лише з підключенням.
    enabled: Boolean(user) && isOnline,
    idleTimeoutSeconds: sessionPolicy.idleTimeoutSeconds,
    warningSeconds: sessionPolicy.warningSeconds,
    onTimeout: handleIdleTimeout
  });

  const hasPermission = (permission: string, minScope?: PermissionScope): boolean => {
    if (!user) return false;
    if (user.role === 'admin' || user.isAdmin || user.roleKeys?.includes('admin')) {
      return true;
    }

    if (!user.permissions) return false;
    const grantedScope = user.permissions[permission];
    if (!grantedScope) return false;

    if (!minScope) return true;

    const grantedRank = SCOPE_RANKS[grantedScope] || 0;
    const requiredRank = SCOPE_RANKS[minScope] || 0;
    return grantedRank >= requiredRank;
  };

  const canManage = Boolean(
    user && (
      user.role === 'admin' ||
      user.isAdmin ||
      user.roleKeys?.includes('admin') ||
      hasPermission('admin.access') ||
      hasPermission('knowledge.article.publish') ||
      hasPermission('users.profile.edit') ||
      hasPermission('roles.manage') ||
      hasPermission('org.manage') ||
      hasPermission('analytics.report.view')
    )
  );

  const isAdministrator = Boolean(
    user && (user.role === 'admin' || user.isAdmin || user.roleKeys?.includes('admin'))
  );

  const primaryRoleLabel = (() => {
    if (!user) return '';
    if (user.role === 'admin' || user.isAdmin || user.roleKeys?.includes('admin')) {
      return 'Адміністратор';
    }
    const keys = user.roleKeys || [];
    for (const k of ['manager', 'hr', 'contentManager', 'employee']) {
      if (keys.includes(k)) return ROLE_TITLES[k] || k;
    }
    return keys[0] ? (ROLE_TITLES[keys[0]] || keys[0]) : 'Співробітник';
  })();

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      hasPermission, 
      canManage, 
      isAdministrator,
      primaryRoleLabel,
      refreshUser: fetchCurrentUser,
      sessionExpired,
      dismissSessionExpired: () => setSessionExpired(false),
      sessionPolicy,
      offlineSession
    }}>
      {children}
      {user && warningActive && (
        <SessionTimeoutModal
          secondsLeft={secondsLeft}
          idleMinutes={Math.round(sessionPolicy.idleTimeoutSeconds / 60)}
          onStay={extendSession}
          onLogout={() => { void logout('manual'); }}
        />
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
