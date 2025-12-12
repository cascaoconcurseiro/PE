export interface NotificationSettings {
    enableBillReminders: boolean;
    enableBudgetAlerts: boolean;
    enableGoalReminders: boolean;
    reminderDaysBefore: number; // 1, 3, 7
    preferredNotificationTime: string; // HH:mm
}

export interface SecuritySettings {
    twoFactorEnabled: boolean;
    activeSessions: ActiveSession[];
    loginHistory: LoginRecord[];
}

export interface ActiveSession {
    id: string;
    device: string;
    browser: string;
    location: string;
    lastActive: string;
    isCurrent: boolean;
}

export interface LoginRecord {
    id: string;
    timestamp: string;
    device: string;
    location: string;
    success: boolean;
}

export interface PreferenceSettings {
    language: 'pt-BR' | 'en-US' | 'es-ES';
    dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
    timeFormat: '12h' | '24h';
    weekStartsOn: 'sunday' | 'monday';
    defaultCurrency: string;
}

export interface PrivacySettings {
    shareAnalytics: boolean;
    hideBalanceInSharedScreens: boolean;
    familyMemberPermissions: Record<string, string[]>;
}

export interface AppearanceSettings {
    fontSize: 'small' | 'medium' | 'large';
    density: 'compact' | 'comfortable' | 'spacious';
    customCategoryColors: Record<string, string>;
}

export interface UserSettings {
    notifications: NotificationSettings;
    security: SecuritySettings;
    preferences: PreferenceSettings;
    privacy: PrivacySettings;
    appearance: AppearanceSettings;
}

// Default settings
export const defaultNotificationSettings: NotificationSettings = {
    enableBillReminders: true,
    enableBudgetAlerts: true,
    enableGoalReminders: true,
    reminderDaysBefore: 3,
    preferredNotificationTime: '09:00'
};

export const defaultSecuritySettings: SecuritySettings = {
    twoFactorEnabled: false,
    activeSessions: [],
    loginHistory: []
};

export const defaultPreferenceSettings: PreferenceSettings = {
    language: 'pt-BR',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    weekStartsOn: 'monday',
    defaultCurrency: 'BRL'
};

export const defaultPrivacySettings: PrivacySettings = {
    shareAnalytics: false,
    hideBalanceInSharedScreens: false,
    familyMemberPermissions: {}
};

export const defaultAppearanceSettings: AppearanceSettings = {
    fontSize: 'medium',
    density: 'comfortable',
    customCategoryColors: {}
};

export const defaultUserSettings: UserSettings = {
    notifications: defaultNotificationSettings,
    security: defaultSecuritySettings,
    preferences: defaultPreferenceSettings,
    privacy: defaultPrivacySettings,
    appearance: defaultAppearanceSettings
};
