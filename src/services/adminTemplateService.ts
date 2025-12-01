import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AdminReplyTemplate = Database['public']['Tables']['admin_reply_templates']['Row'];

export interface CreateTemplateData {
    title: string;
    content: string;
    category: string;
}

/**
 * Récupère tous les templates, optionnellement filtrés par catégorie
 * @param category Catégorie optionnelle pour filtrer
 * @returns Liste des templates
 */
export const getTemplates = async (category?: string): Promise<AdminReplyTemplate[]> => {
    let query = supabase
        .from('admin_reply_templates')
        .select('*')
        .order('usage_count', { ascending: false });

    if (category) {
        query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data || [];
};

/**
 * Récupère toutes les catégories de templates
 * @returns Liste des catégories uniques
 */
export const getTemplateCategories = async (): Promise<string[]> => {
    const { data, error } = await supabase
        .from('admin_reply_templates')
        .select('category');

    if (error) throw new Error(error.message);

    // Extraire les catégories uniques
    const categories = [...new Set(data?.map(t => t.category) || [])];
    return categories.sort();
};

/**
 * Crée un nouveau template
 * @param template Données du template
 * @returns Template créé
 */
export const createTemplate = async (template: CreateTemplateData): Promise<AdminReplyTemplate> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
        .from('admin_reply_templates')
        .insert({
            title: template.title,
            content: template.content,
            category: template.category,
            created_by: user.id
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
};

/**
 * Met à jour un template existant
 * @param templateId ID du template
 * @param updates Données à mettre à jour
 */
export const updateTemplate = async (
    templateId: string,
    updates: Partial<CreateTemplateData>
): Promise<void> => {
    const { error } = await supabase
        .from('admin_reply_templates')
        .update(updates)
        .eq('id', templateId);

    if (error) throw new Error(error.message);
};

/**
 * Supprime un template
 * @param templateId ID du template
 */
export const deleteTemplate = async (templateId: string): Promise<void> => {
    const { error } = await supabase
        .from('admin_reply_templates')
        .delete()
        .eq('id', templateId);

    if (error) throw new Error(error.message);
};

/**
 * Incrémente le compteur d'utilisation d'un template
 * @param templateId ID du template
 */
export const incrementTemplateUsage = async (templateId: string): Promise<void> => {
    const { error } = await supabase.rpc('increment_template_usage', {
        p_template_id: templateId
    });

    if (error) throw new Error(error.message);
};

/**
 * Récupère les templates les plus utilisés
 * @param limit Nombre de templates à retourner
 * @returns Liste des templates les plus utilisés
 */
export const getMostUsedTemplates = async (limit: number = 10): Promise<AdminReplyTemplate[]> => {
    const { data, error } = await supabase
        .from('admin_reply_templates')
        .select('*')
        .order('usage_count', { ascending: false })
        .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];
};

/**
 * Recherche des templates par texte
 * @param searchText Texte à rechercher
 * @returns Templates correspondants
 */
export const searchTemplates = async (searchText: string): Promise<AdminReplyTemplate[]> => {
    const { data, error } = await supabase
        .from('admin_reply_templates')
        .select('*')
        .or(`title.ilike.%${searchText}%,content.ilike.%${searchText}%`)
        .order('usage_count', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
};
