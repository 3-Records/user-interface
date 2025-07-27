export const resolveIpfsUrl = (ipfsUri: string) => {
  const cid = ipfsUri.replace("ipfs://", "");
  return window.location.hostname === "localhost"
    ? `http://127.0.0.1:8080/ipfs/${cid}`
    : `https://ipfs.io/ipfs/${cid}`;
};