const supportedPayoutGateways = [
  { code: "razorpay_test", label: "Razorpay Test Mode", channel: "card_upi_netbanking" },
  { code: "stripe_sandbox", label: "Stripe Sandbox", channel: "card_wallet" },
  { code: "upi_simulator", label: "UPI Simulator", channel: "upi" }
];

export function getSupportedPayoutGateways() {
  return supportedPayoutGateways;
}

export function normalizePayoutGateway(gatewayCode) {
  if (!gatewayCode) {
    return supportedPayoutGateways[0];
  }

  return supportedPayoutGateways.find((gateway) => gateway.code === gatewayCode) || supportedPayoutGateways[0];
}

export function simulatePayoutSettlement({ gatewayCode, amount, claimId }) {
  const gateway = normalizePayoutGateway(gatewayCode);
  const randomSuffix = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");

  return {
    gatewayCode: gateway.code,
    gatewayLabel: gateway.label,
    transactionId: `${gateway.code.toUpperCase()}_${claimId}_${randomSuffix}`,
    settledAmount: Number(amount),
    settledAt: new Date().toISOString(),
    status: "paid"
  };
}