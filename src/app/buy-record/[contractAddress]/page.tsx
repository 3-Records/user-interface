// app/buy-nft/[contractAddress]/[tokenId]/page.tsx
"use client"
import { useQuery } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    useAccount,
    useChainId,
    useWriteContract,
    useReadContracts,
    useWaitForTransactionReceipt,
} from "wagmi"
import { chainsToContracts, recordAbi } from "@/constants"
import { resolveIpfsUrl } from "@/utils/resolveForIpfs"
import Image from "next/image"
import formatETHPrice from "@/utils/formatPrice"


interface RecordEmitData {
    artist: string
    name: string
    symbol: string
}

interface RecordEmitDataQueryResponse {
    data : {
        allRecordDeployeds: {
            nodes: RecordEmitData[] 
        }
    }
}

const GET_RECORD_EMIT_DATA = `
    query getRecordEmitData($record: String!) {
        allRecordDeployeds(
            first: 1
            filter: { record: { equalTo: $record } }
        ) {
            nodes {
                artist
                name
                symbol
            }
        }
    }
`

async function fetchRecordEmitData(record: string): Promise<RecordEmitData | null> {
  const response = await fetch("http://localhost:3001/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: GET_RECORD_EMIT_DATA,
      variables: { record },
    }),
  })

  const json: RecordEmitDataQueryResponse = await response.json()
  return json.data?.allRecordDeployeds?.nodes?.[0] ?? null
}

function useRecordEmitData(record: string) {
  return useQuery<RecordEmitData | null>({
    queryKey: ["recordEmitData", record],
    queryFn: () => fetchRecordEmitData(record),
    enabled: !!record, // avoid running if undefined
  })
}


type RecordReadResult = [
    mintPrice: bigint | undefined,
    supply: bigint | undefined,
    tokenCount: bigint | undefined,
    previewImageUrl: string | undefined
]

function useContractData(contractAddress: `0x${string}`) {
  const result = useReadContracts({
    contracts: [
      {
        address: contractAddress as `0x${string}`,
        abi: recordAbi,
        functionName: 'mintPrice',
      },
      {
        address: contractAddress as `0x${string}`,
        abi: recordAbi,
        functionName: 'supply',
      },
      {
        address: contractAddress as `0x${string}`,
        abi: recordAbi,
        functionName: 'tokenCount',
      },
      {
        address: contractAddress as `0x${string}`,
        abi: recordAbi,
        functionName: 'previewImageURI',
      },
    ],
    query: {
      enabled: !!contractAddress, // ensures it doesn’t run with null
    },
    allowFailure: false, // optional, disables partial results
  })

  let mintPrice: bigint | undefined = undefined
  let supply: bigint | undefined = undefined
  let tokenCount: bigint | undefined = undefined
  let previewImageUrl: string | undefined = undefined

  if (result.data) {
    const [p, s, n, previewImageURI] = result.data as [bigint, bigint, bigint, string]

    mintPrice = p
    supply = s
    tokenCount = n
    previewImageUrl = previewImageURI ? resolveIpfsUrl(previewImageURI) : undefined
  }


  return {
    mintPrice,
    supply,
    tokenCount,
    previewImageUrl,
    isLoading: result.isLoading,
    error: result.error,
    isError: result.isError,
  }
}

export default function BuyRecordPage() {
  const [imageError, setImageError] = useState(false)
  const { address, isConnected } = useAccount()
  // const chainId = useChainId()  
  const router = useRouter()
  const { contractAddress } = useParams() as {
      contractAddress: string
  }

  const {
      data: mintHash,
      isPending: isMintPending,
      writeContract: mint,
      error: mintError,
  } = useWriteContract()

  const { isSuccess: isMintSuccess } = useWaitForTransactionReceipt({
      hash: mintHash,
  })

  const handleMint = async () => {
    console.log("Minting NFT for contract address:", contractAddress)
    try {
      await mint({
          abi: recordAbi,
          address: contractAddress as `0x${string}`,
          functionName: "mint",
          args: [BigInt(1)],   // Only allow mint of 1 for now
          value: mintPrice
      })
    } catch (error) {
      console.error("Error minting NFT:", error)
    }
  }

  const { data: recordEmitData, isLoading: isRecordEmitDataLoading } = useRecordEmitData(contractAddress)
  const contractData = useContractData(contractAddress as `0x${string}`)
  if (isRecordEmitDataLoading || contractData.isLoading) {
    return <p>Loading...</p>
  }

  recordEmitData as RecordEmitData | null
  if(!recordEmitData || recordEmitData.name === undefined || recordEmitData.artist === undefined || recordEmitData.symbol === undefined) {
    return <p>No listing data found for this contract address on this chain.</p>
  }
  if (contractData.isError || contractData.mintPrice === undefined || contractData.supply === undefined || contractData.tokenCount === undefined || contractData.previewImageUrl === undefined) {
    return <p>Error loading contract data on this chain: {contractData.error?.message}</p>
  }
    
    const { name, symbol, artist } = recordEmitData;
    const { mintPrice, supply, tokenCount, previewImageUrl } = contractData;

    //const [step, setStep] = useState(1) // 1: Preview, 2: Approval, 3: Purchase
    // gotta do the mint, and also change ui with preview approval and purchase


  return (
    <div className="pt-10">
        <div className="w-full aspect-square bg-gray-100 relative mx-auto
                max-w-[160px] sm:max-w-[200px] md:max-w-[240px] lg:max-w-[280px] xl:max-w-[320px] overflow-hidden rounded">
            <Image
              src={previewImageUrl}
              alt={name}
              fill
              className="object-cover object-center rounded"
              sizes="(max-width: 640px) 160px,
                      (max-width: 768px) 200px,
                      (max-width: 1024px) 240px,
                      (max-width: 1280px) 280px,
                      320px"
              onError={() => setImageError(true)}
            />
            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                <span className="text-gray-500">Image not available</span>
              </div>
            )}
        </div>


        {/* Text info */}
        <div className="text-center pt-2">
          <h2 className="text-xl font-semibold">{name}</h2>
          <p className="text-gray-100 text-m">by {artist}</p>
        </div>

        {/* Stats */}
        {tokenCount >= supply ? (
          <div className="text-white text-xl  rounded justify-center pt-3">
            All Records Minted
          </div>
        ) : !isConnected ? (
          <div className="text-white text-xl rounded justify-center pt-3">
            Please Connect A Wallet
          </div>
        ) : (
         <>
            <div className="flex justify-center pt-3">
              <button
                className={`py-2 px-4 rounded transition-colors disabled:cursor-not-allowed ${
                  isMintPending
                    ? "bg-gray-400 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
                onClick={handleMint}
                disabled={isMintPending || tokenCount >= supply}
              >
                {isMintPending ? "Waiting for Signature..." : `Mint ${symbol}`}
              </button>

            </div>

            <div className="flex justify-center gap-4 text-sm text-white pt-2">
                <p className="font-medium">{formatETHPrice(String(mintPrice))}</p>
              </div>
            <div className="flex justify-center gap-4 text-sm text-white pt-2">
                <p className="font-medium">{tokenCount} / {supply} minted</p>
            </div>
          </>
        )}


    </div>

    )
}
