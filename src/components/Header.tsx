"use client"

import { ConnectButton } from "@rainbow-me/rainbowkit"
import Image from "next/image"

export default function Header() {
    return (
        <nav
            className="px-8 py-4.5 border-b-[1px] border-zinc-100 flex flex-row justify-between items-center xl:min-h-[77px]"
            style={{ backgroundColor: "#f7eed8" }}
        >
            <h2 className="flex items-center gap-2.5 md:gap-6 text-black">
                Music Store
            </h2>
            <div className="flex items-center gap-4">
                <ConnectButton />
            </div>
        </nav>
    )
}