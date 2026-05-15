import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!geminiApiKey) throw new Error('GEMINI_API_KEY non configurée')

        const supabase = createClient(supabaseUrl ?? '', serviceRoleKey ?? '')

        const { data: articles, error: fetchError } = await supabase
            .from('knowledge_base')
            .select('id, title, content')
            .eq('is_active', true)

        if (fetchError) throw fetchError
        
        console.log(`Démarrage indexation pour ${articles?.length} articles...`)

        let processed = 0
        let errors = 0

        for (const article of articles || []) {
            try {
                const textToEmbed = `${article.title}\n\n${article.content}`
                
                // Utilisation de l'endpoint v1beta / text-embedding-004 qui a montré des signes de succès
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'models/text-embedding-004',
                            content: { parts: [{ text: textToEmbed }] }
                        })
                    }
                )

                if (!res.ok) {
                    const errorText = await res.text()
                    console.error(`Erreur Gemini pour "${article.title}":`, errorText)
                    errors++
                    continue
                }

                const data = await res.json()
                
                if (!data.embedding || !data.embedding.values) {
                    console.error(`Format de réponse invalide pour "${article.title}":`, JSON.stringify(data))
                    errors++
                    continue
                }

                const embedding = data.embedding.values

                const { error: updateError } = await supabase
                    .from('knowledge_base')
                    .update({ embedding })
                    .eq('id', article.id)

                if (updateError) {
                    console.error(`Erreur Update DB pour "${article.title}":`, updateError.message)
                    errors++
                } else {
                    processed++
                    console.log(`✅ Succès: ${article.title}`)
                }

                // Délai plus long pour éviter les 429 (Too Many Requests)
                await new Promise(r => setTimeout(r, 1000))

            } catch (e) {
                console.error(`Erreur fatale sur l'article ${article.id}:`, e.message)
                errors++
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            processed, 
            errors, 
            total: articles?.length 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Global reindex error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
})
