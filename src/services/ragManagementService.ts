import { supabase } from "@/integrations/supabase/client";

export const ragManagementService = {
  /**
   * Découpe un texte long en morceaux (chunks) pour une meilleure analyse RAG
   */
  chunkText(text: string, maxLength: number = 1000): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxLength && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  },

  /**
   * Ajoute un nouveau document à la base de connaissances avec vectorisation automatique
   */
  async uploadKnowledge(title: string, content: string, category: string = 'general') {
    const chunks = this.chunkText(content);
    
    // 1. Insérer le document parent
    const { data: parentDoc, error: parentError } = await supabase
      .from('knowledge_base')
      .insert({ title, content, category, is_active: true })
      .select()
      .single();

    if (parentError) throw parentError;

    // 2. Traiter chaque morceau avec la Edge Function d'embedding
    for (let i = 0; i < chunks.length; i++) {
      const { data: embeddingData, error: embedError } = await supabase.functions.invoke('generate-embedding', {
        body: { text: chunks[i] }
      });

      if (!embedError && embeddingData?.embedding) {
        await supabase.from('knowledge_base').insert({
          title: `${title} (Part ${i + 1})`,
          content: chunks[i],
          category,
          embedding: embeddingData.embedding,
          parent_id: parentDoc.id,
          chunk_index: i,
          is_active: true
        });
      }
    }

    return { success: true, chunksCount: chunks.length };
  }
};
