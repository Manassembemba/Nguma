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
  console.log("--- New Request Received ---");

  // 1. Check for security key
  const authHeader = req.headers.get("Authorization")!;
  console.log("Auth Header:", authHeader ? "Present" : "Missing");
  if (authHeader !== `Bearer ${Deno.env.get("FUNCTION_SECRET")}`) {
    console.error("Unauthorized: Invalid or missing security key.");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    console.log("Request authorized. Processing...");
    // 2. Get the notification record from the request body
    const { record } = await req.json();
    const notification = record as NotificationRecord;
    console.log("Parsed Notification Record:", notification);

    // 3. Create a Supabase client to fetch user data
    const supabaseAdmin = createClient(
      Deno.env.get("PROJECT_SUPABASE_URL") ?? '',
      Deno.env.get("SERVICE_ROLE_KEY") ?? ''
    );
    console.log("Supabase admin client created.");

    // 4. Fetch the user's email from the profiles table
    console.log(`Fetching profile for user_id: ${notification.user_id}`);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", notification.user_id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      throw new Error(`Failed to fetch profile for user ${notification.user_id}: ${profileError.message}`);
    }
    console.log("Profile data fetched:", profile);

    const userEmail = profile.email;
    if (!userEmail) {
      console.error(`Email not found for user ${notification.user_id}`);
      throw new Error(`Email not found for user ${notification.user_id}`);
    }
    console.log(`Found user email: ${userEmail}`);

    // 5. Get the Resend API key from environment variables
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not set.");
      throw new Error("RESEND_API_KEY is not set in environment variables.");
    }
    console.log("Resend API Key: Present");

    // 6. Construct and send the email using the Resend API
    console.log("Constructing email HTML...");
    const emailHtml = createEmailHtml(notification.message, notification.link_to);
    
    const emailPayload = {
      from: "Nguma <noreply@nguma.org>",
      to: userEmail,
      subject: "Nouvelle notification de Nguma",
      html: emailHtml,
    };
    console.log("Sending email with payload:", emailPayload);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(emailPayload),
    });

    console.log(`Resend API response status: ${resendResponse.status}`);
    const resendData = await resendResponse.json();
    console.log("Resend API response data:", resendData);

    if (!resendResponse.ok) {
      console.error("Failed to send email. Resend API Error:", resendData);
      throw new Error(`Failed to send email: ${JSON.stringify(resendData)}`);
    }

    // 7. Return a success response
    console.log("Email sent successfully. Resend ID:", resendData.id);
    return new Response(JSON.stringify({ message: "Email sent successfully", resendId: resendData.id }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("--- Unhandled Error in Edge Function ---");
    console.error(error.message);
    console.error("--------------------------------------");
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});