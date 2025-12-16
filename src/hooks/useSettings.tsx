import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    UserSettings,
    NotificationSettings,
    PreferenceSettings,
    PrivacySettings,
    AppearanceSettings,
    SecuritySettings,
    defaultUserSettings
} from '../types/UserSettings';
import { supabase } from '../integrations/supabase/client';
import { supabaseService } from '../services/supabaseService';

interface SettingsContextType {
    settings: UserSettings;
    updateNotifications: (settings: Partial<NotificationSettings>) => Promise<void>;
    updateSecurity: (settings: Partial<SecuritySettings>) => Promise<void>;
    updatePreferences: (settings: Partial<PreferenceSettings>) => Promise<void>;
    updatePrivacy: (settings: Partial<PrivacySettings>) => Promise<void>;
    updateAppearance: (settings: Partial<AppearanceSettings>) => Promise<void>;
    isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

interface SettingsProviderProps {
    children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
    const [settings, setSettings] = useState<UserSettings>(defaultUserSettings);
    const [isLoading, setIsLoading] = useState(true);

    // Load settings from Supabase on mount
    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setIsLoading(true);

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                // Not logged in, use defaults (in-memory only)
                setSettings(defaultUserSettings);
                setIsLoading(false);
                return;
            }

            // Load from Supabase
            try {
                const data = await supabaseService.getUserSettings(user.id);

                if (data) {
                    const loadedSettings: UserSettings = {
                        notifications: data.notifications || defaultUserSettings.notifications,
                        security: data.security || defaultUserSettings.security,
                        preferences: data.preferences || defaultUserSettings.preferences,
                        privacy: data.privacy || defaultUserSettings.privacy,
                        appearance: data.appearance || defaultUserSettings.appearance
                    };
                    setSettings(loadedSettings);
                } else {
                    // Not found (null returned), create defaults
                    await createDefaultSettings(user.id);
                }
            } catch (innerError) {
                console.warn('Exception loading settings:', innerError);
                setSettings(defaultUserSettings);
            }
        } catch (error) {
            console.error('Error in loadSettings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const createDefaultSettings = async (userId: string) => {
        try {
            const initialSettings = {
                user_id: userId,
                notifications: defaultUserSettings.notifications,
                security: defaultUserSettings.security,
                preferences: defaultUserSettings.preferences,
                privacy: defaultUserSettings.privacy,
                appearance: defaultUserSettings.appearance
            };

            await supabaseService.upsertUserSettings(userId, initialSettings as UserSettings);
            // setSettings is called after logic
            setSettings(defaultUserSettings);
        } catch (error) {
            console.error('Error in createDefaultSettings:', error);
        }
    };

    const saveSettings = async (newSettings: UserSettings) => {
        try {
            // Save to state (memory)
            setSettings(newSettings);

            // Save to Supabase (if logged in)
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                await supabaseService.upsertUserSettings(user.id, newSettings);
            }
        } catch (error) {
            console.error('Error in saveSettings:', error);
        }
    };

    const updateNotifications = async (updates: Partial<NotificationSettings>) => {
        const newSettings = {
            ...settings,
            notifications: { ...settings.notifications, ...updates }
        };
        await saveSettings(newSettings);
    };

    const updateSecurity = async (updates: Partial<SecuritySettings>) => {
        const newSettings = {
            ...settings,
            security: { ...settings.security, ...updates }
        };
        await saveSettings(newSettings);
    };

    const updatePreferences = async (updates: Partial<PreferenceSettings>) => {
        const newSettings = {
            ...settings,
            preferences: { ...settings.preferences, ...updates }
        };
        await saveSettings(newSettings);
    };

    const updatePrivacy = async (updates: Partial<PrivacySettings>) => {
        const newSettings = {
            ...settings,
            privacy: { ...settings.privacy, ...updates }
        };
        await saveSettings(newSettings);
    };

    const updateAppearance = async (updates: Partial<AppearanceSettings>) => {
        const newSettings = {
            ...settings,
            appearance: { ...settings.appearance, ...updates }
        };
        await saveSettings(newSettings);
    };

    return (
        <SettingsContext.Provider
            value={{
                settings,
                updateNotifications,
                updateSecurity,
                updatePreferences,
                updatePrivacy,
                updateAppearance,
                isLoading
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
};
