export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: { to: string; subject: string; text: string; html: string }): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.EMAIL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, ...message }),
    });
    if (!res.ok) console.error(`email: send failed with status ${res.status}`);
    return res.ok;
  } catch {
    console.error("email: send failed");
    return false;
  }
}
