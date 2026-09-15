import React, { createContext, useContext, useState, useEffect } from 'react';

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
  allowedCourseIds?: string[];
  allowedInstructionIds?: string[];
  requireEmailCode?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
  hasPermission: (permission: string, minScope?: PermissionScope) => boolean;
  canManage: boolean;
  primaryRoleLabel: string;
  refreshUser: () => Promise<void>;
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

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
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

  const login = (userData: User) => setUser(userData);
  
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  };

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
      refreshUser: fetchCurrentUser 
    }}>
      {children}
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
