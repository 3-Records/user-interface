import { useQuery } from "@tanstack/react-query"
//import { useMemo } from "react"
import RecordBox from "./RecordBox"
import Link from "next/link"


interface DeployedRecord {
    record: string
    artist: string
    name: string
    symbol: string
    contractAddress: string
    txHash: string
    blockNumber: number
    txIndex: number
}




interface RecordQueryResponse {
    data : {
        allRecordDeployeds: {
            nodes: DeployedRecord[] 
        }
    }
}

const GET_RECENTLY_DEPLOYED_RECORDS = `
    query RecentlyDeployedRecords {
        allRecordDeployeds(first: 8, orderBy: [BLOCK_NUMBER_DESC, TX_INDEX_DESC]) {
            nodes {
                record
                artist
                contractAddress
                txHash
                name
                symbol
                blockNumber
                txIndex
            }
        }
    }
`



async function fetchRecentlyDeployedRecords(): Promise<RecordQueryResponse> {
    const response = await fetch("http://localhost:3001/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: GET_RECENTLY_DEPLOYED_RECORDS,
        }),
    })
    return response.json()
}


function useRecentlyDeployedRecord() {
    return useQuery<RecordQueryResponse>({
        queryKey: ["recentlyListedNFTs"],
        queryFn: fetchRecentlyDeployedRecords
    })
}

export default function Store() {
    const { data, isLoading, error } = useRecentlyDeployedRecord()
    
    const records = data?.data?.allRecordDeployeds.nodes ?? []
    

    return (
        <div className="container mx-auto px-4 py-8">
            <h2 className="text-center text-2xl font-bold mb-6">Recent Releases</h2>

            {isLoading && <p>Loading...</p>}
            {error && <p>Error loading records</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {records.map((record) => (
                    
                    <RecordBox
                        key={record.record}
                        contractAddress={record.record}
                        name={record.name}
                        artist={record.artist}
                    />
                ))}
            </div>
        </div>
    )
}