/**
 * Rate Limiting Service
 * Protège contre les attaques brute-force et l'abus d'API
 */

import { supabase } from '@/integrations/supabase/client';

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    reset_at: string;
    blocked: boolean;
}

export type RateLimitAction = 'login' | 'deposit' | 'withdrawal' | 'api_call';

/**
 * Vérifie si une action est autorisée selon les règles de rate limiting
 * @param identifier - Email, user_id, ou IP
 * @param action - Type d'action à vérifier
 * @param maxAttempts - Nombre maximum de tentatives (défaut selon l'action)
 * @param windowMinutes - Fenêtre de temps en minutes (défaut selon l'action)
 */
export async function checkRateLimit(
    identifier: string,
    action: RateLimitAction,
    maxAttempts?: number,
    windowMinutes?: number
): Promise<RateLimitResult> {
    // Configuration par défaut selon l'action
    const config = getRateLimitConfig(action);
    const finalMaxAttempts = maxAttempts ?? config.maxAttempts;
    const finalWindowMinutes = windowMinutes ?? config.windowMinutes;

    try {
        const { data, error } = await supabase.rpc('check_rate_limit', {
            p_identifier: identifier,
            p_action: action,
            p_max_attempts: finalMaxAttempts,
            p_window_minutes: finalWindowMinutes,
        });

        if (error) {
            console.error('Rate limit check error:', error);
            // En cas d'erreur, on autorise par défaut (fail-open)
            return {
                allowed: true,
                remaining: finalMaxAttempts,
                reset_at: new Date().toISOString(),
                blocked: false,
            };
        }

        return data as RateLimitResult;
    } catch (err) {
        console.error('Rate limit exception:', err);
        // Fail-open en cas d'exception
        return {
            allowed: true,
            remaining: finalMaxAttempts,
            reset_at: new Date().toISOString(),
            blocked: false,
        };
    }
}

/**
 * Configuration des limites par action
 */
function getRateLimitConfig(action: RateLimitAction): {
    maxAttempts: number;
    windowMinutes: number;
} {
    const configs = {
        login: {
            maxAttempts: 5,
            windowMinutes: 15,
        },
        deposit: {
            maxAttempts: 10,
            windowMinutes: 60,
        },
        withdrawal: {
            maxAttempts: 5,
            windowMinutes: 60,
        },
        api_call: {
            maxAttempts: 100,
            windowMinutes: 1,
        },
    };

    return configs[action];
}

/**
 * Formate la durée jusqu'au reset
 */
export function formatRateLimitReset(resetAt: string): string {
    const now = new Date();
    const reset = new Date(resetAt);
    const diffMs = reset.getTime() - now.getTime();

    if (diffMs <= 0) return 'maintenant';

    const minutes = Math.floor(diffMs / 1000 / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}min` : ''}`;
    }

    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

/**
 * Débloquer un utilisateur (admin seulement)
 */
export async function adminUnblockRateLimit(
    identifier: string,
    action: RateLimitAction
): Promise<boolean> {
    try {
        const { data, error } = await supabase.rpc('admin_unblock_rate_limit', {
            p_identifier: identifier,
            p_action: action,
        });

        if (error) {
            console.error('Admin unblock error:', error);
            throw error;
        }

        return data as boolean;
    } catch (err) {
        console.error('Admin unblock exception:', err);
        throw err;
    }
}
