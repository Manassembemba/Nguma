// supabase/functions/process-notification-queue/index.ts

// Force redeploy v2
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// The maximum number of notifications to process in a single run
const BATCH_SIZE = 50;

Deno.serve(async (req) => {
  try {
    // 1. Check for secret key to prevent unauthorized access
    const authorization = req.headers.get('Authorization');
    const CRON_SECRET = Deno.env.get('CRON_SECRET');
    if (authorization !== `Bearer ${CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    // 2. Fetch a batch of pending notifications and mark them as 'processing'
    const { data: jobs, error: fetchError } = await supabaseAdmin
      .from('notifications_queue')
      .select('*')
      .eq('status', 'pending')
      .limit(BATCH_SIZE)
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No pending notifications to process.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[process-notification-queue] Found ${jobs.length} jobs to process.`);

    // Mark jobs as 'processing' to prevent another worker from picking them up
    const jobIds = jobs.map(job => job.id);
    await supabaseAdmin
      .from('notifications_queue')
      .update({ status: 'processing', processed_at: new Date().toISOString() })
      .in('id', jobIds);

    // 3. Process each job sequentially with a delay to respect Resend's rate limit (2/sec)
    let processedCount = 0;
    for (const job of jobs) {
      try {
        const payload = {
          template_id: job.template_id,
          to: job.recipient_email,
          ...job.notification_params,
        };

        // Invoke the email sending function
        const { error: invokeError } = await supabaseAdmin.functions.invoke('send-resend-email', {
          body: payload,
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          }
        });

        if (invokeError) {
          throw new Error(`Failed to invoke send-resend-email: ${invokeError.message}`);
        }

        // 4. If successful, mark job as 'sent'
        await supabaseAdmin
          .from('notifications_queue')
          .update({ status: 'sent' })
          .eq('id', job.id);

        processedCount++;

        // Wait 600ms between calls to stay under 2 requests/sec limit
        await new Promise(resolve => setTimeout(resolve, 600));

      } catch (error) {
        console.error(`[process-notification-queue] Error processing job ${job.id}:`, error.message);
        // If failed, mark job as 'failed' and log the error
        await supabaseAdmin
          .from('notifications_queue')
          .update({
            status: 'failed',
            last_error: error.message,
            retry_attempts: (job.retry_attempts || 0) + 1
          })
          .eq('id', job.id);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: processedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[process-notification-queue] Unhandled error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
