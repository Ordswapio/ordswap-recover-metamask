import { ethers } from "ethers";
import { HDKey } from "@scure/bip32";
import { hex } from "@scure/base";
import { useCallback, useState } from "react";
import { WIF } from "micro-btc-signer";
import { utils } from "@noble/secp256k1";

const defaultPath = "m/86'/0'/0'/0/0";

export function descriptorWithChecksum(desc: string): string {
  if (typeof desc !== "string") throw new Error("desc must be string");

  const descParts = desc.match(/^(.*?)(?:#([qpzry9x8gf2tvdw0s3jn54khce6mua7l]{8}))?$/);
  if (!descParts) throw new Error("descParts must match regex");
  if (descParts[1] === "") throw new Error("desc string must not be empty");

  const INPUT_CHARSET =
    "0123456789()[],'/*abcdefgh@:$%{}IJKLMNOPQRSTUVWXYZ&+-.;<=>?!^_|~ijklmnopqrstuvwxyzABCDEFGH`#\"\\ ";
  const CHECKSUM_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const MOD_CONSTS = [
    parseInt("f5dee51989", 16),
    parseInt("a9fdca3312", 16),
    parseInt("1bab10e32d", 16),
    parseInt("3706b1677a", 16),
    parseInt("644d626ffd", 16),
  ];
  const BIT35 = Math.pow(2, 35);
  const BIT31 = Math.pow(2, 31);
  const BIT5 = Math.pow(2, 5);

  function polyMod(c: number, val: number) {
    const c0 = Math.floor(c / BIT35);
    let ret = xor5Byte((c % BIT35) * BIT5, val);
    if (c0 & 1) ret = xor5Byte(ret, MOD_CONSTS[0]);
    if (c0 & 2) ret = xor5Byte(ret, MOD_CONSTS[1]);
    if (c0 & 4) ret = xor5Byte(ret, MOD_CONSTS[2]);
    if (c0 & 8) ret = xor5Byte(ret, MOD_CONSTS[3]);
    if (c0 & 16) ret = xor5Byte(ret, MOD_CONSTS[4]);
    return ret;
  }

  function xor5Byte(a: number, b: number) {
    const a1 = Math.floor(a / BIT31);
    const a2 = a % BIT31;
    const b1 = Math.floor(b / BIT31);
    const b2 = b % BIT31;
    return (a1 ^ b1) * BIT31 + (a2 ^ b2);
  }

  let c = 1;
  let cls = 0;
  let clscount = 0;
  for (const ch of descParts[1]) {
    const pos = INPUT_CHARSET.indexOf(ch);
    if (pos === -1) return "";
    c = polyMod(c, pos & 31);
    cls = cls * 3 + (pos >> 5);
    clscount++;
    if (clscount === 3) {
      c = polyMod(c, cls);
      cls = 0;
      clscount = 0;
    }
  }
  if (clscount > 0) {
    c = polyMod(c, cls);
  }
  for (let i = 0; i < 8; i++) {
    c = polyMod(c, 0);
  }
  c = xor5Byte(c, 1);

  const arr = [];
  for (let i = 0; i < 8; i++) {
    arr.push(CHECKSUM_CHARSET.charAt(Math.floor(c / Math.pow(2, 5 * (7 - i))) % BIT5));
  }
  const checksum = arr.join("");
  if (descParts[2] !== undefined && descParts[2] !== checksum) throw new Error("Checksum Mismatch");

  return `${descParts[1]}#${checksum}`;
}

function Key(props: { k: string }) {
  const { k } = props;
  return <>
    <div>key (Hex): {k}</div>
    <div>key (WIF): {WIF().encode(utils.hexToBytes(k))}</div>
    <div>key (descriptor(WIF)#checksum): {descriptorWithChecksum(`tr(${WIF().encode(utils.hexToBytes(k))})`)}</div>
  </>
}

function App() {
  const [key, setKey] = useState("");
  const [altKey, setAltKey] = useState("");

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
    const signature = ethers.utils.arrayify(await provider.send("personal_sign", [toSign, address.toString()]));

    let seed = ethers.utils.arrayify(ethers.utils.keccak256(signature));
    let hd = HDKey.fromMasterSeed(seed);
    const key = hd.derive(defaultPath);
    setKey(hex.encode(key.privateKey!))
console.log(signature)
    // altkey
    let lastByte = signature[signature.length - 1]
    console.log(signature, lastByte)

    if (lastByte > 1) {
      lastByte -= 27;
      signature[signature.length - 1] = lastByte
    }


    seed = ethers.utils.arrayify(ethers.utils.keccak256(signature));
    hd = HDKey.fromMasterSeed(seed);
    const altKey = hd.derive(defaultPath);
    setAltKey(hex.encode(altKey.privateKey!))
  }, [setKey]);
  return (
    <div>
      <div>This tool recovers your Ordswap private key from Metamask.</div>
      <br />
      {!key && <button onClick={connectMetamask}>Connect Metamask</button>}
      {key && <Key k={key} />}
      <br />
      {altKey && <Key k={altKey} />}
      <br />
      {key &&
        <div>
          Hex or WIF key can be imported into <a href="https://unisat.io/download" rel="noreferrer" target="_blank">Unisat</a> via "Create a new wallet" &gt; "Restore from single private key"
        </div>
      }
      <br />
      {key && <button onClick={() => (setKey(""), setAltKey(""))}>Reset</button>}
    </div>
  );
}

export default App;
