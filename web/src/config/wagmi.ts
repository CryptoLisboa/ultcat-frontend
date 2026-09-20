import { cookieStorage, createStorage, http } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { cronos } from "@reown/appkit/networks";
import { CRONOS_RPC_URL } from "../lib/constants";

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

export const networks = [cronos] as const;

export const wagmiAdapter =
  projectId != null && projectId.length > 0
    ? new WagmiAdapter({
        storage: createStorage({ storage: cookieStorage }),
        ssr: true,
        projectId,
        networks: [...networks],
        transports: {
          [cronos.id]: http(CRONOS_RPC_URL),
        },
      })
    : null;
