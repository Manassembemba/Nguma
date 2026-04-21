import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // 1. Gérer les requêtes OPTIONS
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    console.log("[chat-ai] Nouvelle requête reçue");

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 2. Récupérer le corps de la requête
        const { conversationId, message } = await req.json()
        console.log(`[chat-ai] Traitement pour conv: ${conversationId}, msg: ${message}`);

        if (!conversationId || !message) throw new Error("Données manquantes (convId ou message)");

        // 3. Vérifier si l'IA doit répondre
        const { data: conv } = await supabase
            .from('chat_conversations')
            .select('is_ai_enabled')
            .eq('id', conversationId)
            .single();

        if (conv && conv.is_ai_enabled === false) {
            console.log("[chat-ai] IA désactivée pour cette conversation");
            return new Response(JSON.stringify({ status: "ai_disabled" }), { headers: corsHeaders });
        }

        // 4. Rechercher dans la base de connaissances (RAG)
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        
        // On récupère le vecteur pour la question
        const embRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'models/text-embedding-004', content: { parts: [{ text: message }] } })
        });
        const embData = await embRes.json();
        const vector = embData.embedding.values;

        // On cherche les documents
        const { data: docs } = await supabase.rpc('match_knowledge_hybrid', {
            query_embedding: vector,
            query_text: message,
            match_threshold: 0.2,
            match_count: 3
        });

        const context = (docs || []).map((d: any) => d.content).join("\n\n");
        console.log(`[chat-ai] RAG a trouvé ${docs?.length || 0} documents`);

        // 5. Générer la réponse avec Gemini
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Tu es l'assistant Nguma. Réponds à l'utilisateur.\n\nContexte: ${context}\n\nQuestion: ${message}` }] }],
                tools: [{ google_search: {} }]
            })
        });

        const genData = await geminiRes.json();
        const reply = genData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!reply) throw new Error("L'IA n'a pas généré de réponse");

        // 6. Sauvegarder le message de l'IA
        await supabase.from('chat_messages').insert({
            conversation_id: conversationId,
            sender_id: '00000000-0000-0000-0000-000000000000',
            message: reply,
            is_admin: false
        });

        console.log("[chat-ai] Message sauvegardé avec succès");
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

    } catch (err) {
        console.error("[chat-ai] ERREUR:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
})
