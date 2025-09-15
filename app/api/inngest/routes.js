// app/api/inngest/route.js
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { paymentReminders } from "@/lib/inngest/payment-reminder";

export const { GET, POST } = serve({
  client: inngest,
  functions: [paymentReminders],
});
