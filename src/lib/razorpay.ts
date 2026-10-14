import "server-only";

type RazorpayOrderResponse = { id: string; amount: number; currency: string; status: string };
type RazorpayPaymentResponse = { id: string; order_id: string; amount: number; currency: string; status: string };

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay test credentials are not configured on the server.");
  return { keyId, keySecret };
}

async function razorpayFetch<T>(path: string, init: RequestInit): Promise<T> {
  const { keyId, keySecret } = credentials();
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`Razorpay request failed with status ${response.status}.`);
  return await response.json() as T;
}

export async function createRazorpayOrder(amount: number, receipt: string) {
  const result = await razorpayFetch<RazorpayOrderResponse>("/orders", {
    method: "POST",
    body: JSON.stringify({ amount, currency: "INR", receipt, payment_capture: 1 }),
  });
  return { ...result, keyId: credentials().keyId };
}

export async function getRazorpayPayment(paymentId: string) {
  return razorpayFetch<RazorpayPaymentResponse>(`/payments/${encodeURIComponent(paymentId)}`, { method: "GET" });
}

export function razorpayCredentialsPresent() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET);
}
