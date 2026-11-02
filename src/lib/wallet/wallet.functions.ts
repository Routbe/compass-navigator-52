import { createServerFn } from "@tanstack/react-start";

/** Public: which wallets can issue passes right now (booleans only, never config values). */
export const getWalletStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { walletStatus } = await import("./wallet-pass");
  return walletStatus(process.env as Record<string, string | undefined>);
});
