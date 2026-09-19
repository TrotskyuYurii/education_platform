import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useIdleTimeout, clearSharedActivity } from '../hooks/useIdleTimeout';
import { SessionTimeoutModal } from '../components/SessionTimeoutModal';

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

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User, session?: SessionPolicy) => void;
  logout: (reason?: LogoutReason) => Promise<void>;
  hasPermission: (permission: string, minScope?: PermissionScope) => boolean;
  canManage: boolean;
  primaryRoleLabel: string;
  refreshUser: () => Promise<void>;
  /** Сесію щойно завершено через бездіяльність — екран входу пояснює це людині. */
  sessionExpired: boolean;
  dismissSessionExpired: () => void;
  sessionPolicy: SessionPolicy;
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

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        applySessionPolicy(data.session);
        if (data.user) setUser(data.user);
      }
    } catch (err) {
      // Ignored for unauthenticated initial load
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = (userData: User, session?: SessionPolicy) => {
    try { localStorage.setItem('viatec_current_tab', 'myday'); } catch {}
    applySessionPolicy(session);
    setSessionExpired(false);
    setUser(userData);
  };
  
  const logout = useCallback(async (reason: LogoutReason = 'manual') => {
    clearSharedActivity();
    setSessionExpired(reason === 'idle');
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  const handleIdleTimeout = useCallback(() => {
    void logout('idle');
  }, [logout]);

  const { warningActive, secondsLeft, extendSession } = useIdleTimeout({
    enabled: Boolean(user),
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
      primaryRoleLabel,
      refreshUser: fetchCurrentUser,
      sessionExpired,
      dismissSessionExpired: () => setSessionExpired(false),
      sessionPolicy
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
