"use client"

import { useEffect, useMemo, useState } from "react"
import { useAccount, useReadContracts } from "wagmi"
import { getAddress, isAddress } from "viem"
import RecordBox from "@/components/RecordBox"
import { recordAbi } from "@/constants"

interface DeployedRecord {
  record: string            // ✅ deployed Record contract address
  artist: string
  name: string
  contractAddress: string   // (your RecordFactory address)
}

interface RecordQueryResponse {
  data: {
    allRecordDeployeds: {
      nodes: DeployedRecord[]
    }
  }
}

const GET_ALL_RECORDS = `
  query RecentlyDeployedRecords {
    allRecordDeployeds(orderBy: [BLOCK_NUMBER_DESC, TX_INDEX_DESC]) {
      nodes {
        record
        artist
        contractAddress
        name
      }
    }
  }
`

// Trim + checksum; undefined if invalid.
function normalizeAddress(raw?: string | null): `0x${string}` | undefined {
  if (!raw) return undefined
  const t = raw.trim()
  if (!t) return undefined
  try {
    return getAddress(t) as `0x${string}`
  } catch {
    return undefined
  }
}

type OwnedItem = {
  contractAddress: `0x${string}`
  name: string
  artist: string
  tokenId: bigint
}

export default function MyRecords() {
  const { address: userAddress } = useAccount()

  const [deployedRecords, setDeployedRecords] = useState<DeployedRecord[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // recordContract(lowercase) -> owned tokenIds
  const [ownedTokensByContract, setOwnedTokensByContract] = useState<Record<string, bigint[]>>({})

  // 1) Fetch all deployments
  useEffect(() => {
    if (!userAddress) return
    let canceled = false
    ;(async () => {
      try {
        setIsFetching(true)
        setFetchError(null)
        const res = await fetch("http://localhost:3001/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: GET_ALL_RECORDS }),
        })
        const json: RecordQueryResponse = await res.json()
        if (!canceled) setDeployedRecords(json?.data?.allRecordDeployeds?.nodes ?? [])
      } catch (e: any) {
        if (!canceled) setFetchError(e?.message ?? "Failed to fetch records")
      } finally {
        if (!canceled) setIsFetching(false)
      }
    })()
    return () => {
      canceled = true
    }
  }, [userAddress])

  // 2) Sanitize: USE `record` (the deployed Record contract), not `contractAddress` (factory)
  const sanitizedRecords = useMemo(() => {
    const list: { contractAddress: `0x${string}`; name: string; artist: string }[] = []
    for (const r of deployedRecords) {
      const addr = normalizeAddress(r.record) // ✅ key line
      if (!addr) {
        if (r.record && !isAddress(r.record.trim())) {
          console.warn("Invalid record address from indexer:", JSON.stringify(r.record))
        }
        continue
      }
      list.push({ contractAddress: addr, name: r.name, artist: r.artist })
    }
    return list
  }, [deployedRecords])

  // 3) Batch read tokensOfOwner on each Record contract
  const {
    data: readResults,
    isLoading: isReading,
    isSuccess: readSuccess,
    isError: readError,
    error: readErrObj,
  } = useReadContracts({
    contracts: sanitizedRecords.map((r) => ({
      address: r.contractAddress,
      abi: recordAbi,
      functionName: "tokensOfOwner" as const,
      args: [userAddress],
    })),
    query: { enabled: !!userAddress && sanitizedRecords.length > 0 },
  })

  // 4) Build mapping: recordContract -> owned tokenIds
  useEffect(() => {
    if (!readSuccess || !readResults) return
    const map: Record<string, bigint[]> = {}
    for (let i = 0; i < sanitizedRecords.length; i++) {
      const rec = sanitizedRecords[i]
      const result = readResults[i]
      if (result?.status === "success") {
        const tokenIds = (result.result as bigint[]) ?? []
        if (tokenIds.length > 0) {
          map[rec.contractAddress.toLowerCase()] = tokenIds
        }
      } else if (result?.status === "failure") {
        console.warn("Read failure for contract", rec.contractAddress, result.error)
      }
    }
    setOwnedTokensByContract(map)
  }, [readSuccess, readResults, sanitizedRecords])

  // 5) Expand to one render item per token
  const ownedItems: OwnedItem[] = useMemo(() => {
    const items: OwnedItem[] = []
    for (const rec of sanitizedRecords) {
      const tokenIds = ownedTokensByContract[rec.contractAddress.toLowerCase()]
      if (!tokenIds?.length) continue
      for (const tokenId of tokenIds) {
        items.push({
          contractAddress: rec.contractAddress,
          name: rec.name,
          artist: rec.artist,
          tokenId,
        })
      }
    }
    return items
  }, [sanitizedRecords, ownedTokensByContract])

  const loading = isFetching || isReading
  const anyError = !!fetchError || readError
  const errorMsg = fetchError ?? (readErrObj as any)?.message

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-center text-2xl font-bold mb-6">Your Record Collection</h2>

      {loading && <p className="text-center">Loading...</p>}
      {anyError && <p className="text-center text-red-600">Failed to load: {errorMsg}</p>}

      {!loading && !anyError && ownedItems.length === 0 && (
        <p className="text-center text-gray-600">You don’t own any records yet.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {ownedItems.map((item) => (
          <RecordBox
            variant="owned"
            key={`${item.contractAddress}-${item.tokenId.toString()}`}
            contractAddress={item.contractAddress}
            name={item.name}
            artist={item.artist}
            tokenId={item.tokenId}
            href={`/owned-record/${item.contractAddress}/${item.tokenId.toString()}`}
          />
        ))}
      </div>
    </div>
  )
}
