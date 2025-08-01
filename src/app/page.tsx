"use client"

import { useAccount } from "wagmi"
import { useEffect, useState } from "react"
import MyRecords from "@/components/Home"

//import RecentlyListedNFTs from "@/components/RecentlyListed"

export default function Home() {
    const { isConnected, address } = useAccount()
    
    return (
        <main>
            {!isConnected ? (
                <div className="flex items-center justify-center p-4 md:p-6 xl:p-8">
                    Please connect a wallet
                </div>
            ) : (
                <div className="flex items-center justify-center p-4 md:p-6 xl:p-8">
                    <MyRecords />
                </div>
            )} 
        </main>
    )
}