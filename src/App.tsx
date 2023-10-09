import { ethers } from "ethers";
import { HDKey } from "@scure/bip32";
import { hex } from "@scure/base";
import { useCallback, useState } from "react";

const defaultPath = "m/86'/0'/0'/0/0";

function App() {
  const [value, setValue] = useState("");

  const connectMetamask = useCallback(async () => {
    const TAPR0OT_MESSAGE =
      "Sign this message to generate your Bitcoin Taproot key. This key will be used for your ordswap.io transactions.";

    const getBitcoinKeySignContent = (message: string): string => {
      return hex.encode(Uint8Array.from(message.split("").map((letter) => letter.charCodeAt(0))));
    };

    const provider = new ethers.providers.Web3Provider((window as any).ethereum as ethers.providers.ExternalProvider);

    const addresses = await provider.send("eth_requestAccounts", [
      {
        eth_accounts: {},
      },
    ]);
    let address;
    if (addresses && Array.isArray(addresses)) {
      address = addresses[0];
    }

    if (!address) return;

    const toSign = "0x" + getBitcoinKeySignContent(TAPR0OT_MESSAGE);
    const signature = await provider.send("personal_sign", [toSign, address.toString()]);

    const seed = ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.arrayify(signature)));

    const hd = HDKey.fromMasterSeed(seed);
    const key = hd.derive(defaultPath);

    setValue(hex.encode(key.privateKey!))
  }, [setValue]);
  return (
    <div>
      <div>This tool recovers your Ordswap private key from Metamask.</div>
      {!value && <button onClick={connectMetamask}>Connect Metamask</button>}
      {value && (
        <>
          <div>key: {value}</div>
          <button onClick={() => setValue("")}>Reset</button>
        </>
      )}
    </div>
  );
}

export default App;
