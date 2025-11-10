// Import required libraries
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Define the structure of the notification record we expect from the trigger
interface NotificationRecord {
  id: string;
  user_id: string;
  message: string;
  link_to?: string;
}

// Simple HTML email template
const createEmailHtml = (message: string, link?: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { width: 90%; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
      .header { font-size: 24px; font-weight: bold; color: #000; }
      .content { margin-top: 20px; }
      .button { display: inline-block; padding: 10px 20px; margin-top: 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px; }
      .footer { margin-top: 20px; font-size: 12px; color: #888; }
    </style>
  </head>
  <body>
    <div class="container">
      <p class="header">Notification de Nguma</p>
      <div class="content">
        <p>${message}</p>
        ${link ? `<a href="${new URL(link, Deno.env.get("SITE_URL")!)}" class="button">Voir les détails</a>` : ''}
      </div>
      <p class="footer">Vous recevez cet e-mail car vous avez activé les notifications pour votre compte Nguma.</p>
    </div>
  </body>
  </html>
`;

serve(async (req) => {
  // 1. Check for security key to ensure the request is from our database trigger
  const authHeader = req.headers.get("Authorization")!;
  if (authHeader !== `Bearer ${Deno.env.get("FUNCTION_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 2. Get the notification record from the request body
    const { record } = await req.json();
    const notification = record as NotificationRecord;

    // 3. Create a Supabase client to fetch user data
    const supabaseAdmin = createClient(
      Deno.env.get("PROJECT_SUPABASE_URL") ?? '',
      Deno.env.get("SERVICE_ROLE_KEY") ?? ''
    );

    // 4. Fetch the user's email from the profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", notification.user_id)
      .single();

    if (profileError) {
      throw new Error(`Failed to fetch profile for user ${notification.user_id}: ${profileError.message}`);
    }

    const userEmail = profile.email;
    if (!userEmail) {
      throw new Error(`Email not found for user ${notification.user_id}`);
    }

    // 5. Get the Resend API key from environment variables
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not set in environment variables.");
    }

    // 6. Construct and send the email using the Resend API
    const emailHtml = createEmailHtml(notification.message, notification.link_to);
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Nguma <noreply@yourdomain.com>", // IMPORTANT: Change to a domain you have verified with Resend
        to: userEmail,
        subject: "Nouvelle notification de Nguma",
        html: emailHtml,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(`Failed to send email: ${JSON.stringify(resendData)}`);
    }

    // 7. Return a success response
    return new Response(JSON.stringify({ message: "Email sent successfully", resendId: resendData.id }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error processing request:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});