import React, { useState, useEffect } from "react"
import Image from "next/image"
import Link from 'next/link'
import { useReadContract } from "wagmi"
import { recordAbi } from "../constants"
import { resolveIpfsUrl } from "@/utils/resolveForIpfs"


// Type for the NFT data
interface RecordBoxProps {
    contractAddress: string,
    name: string,
    artist: string
 
}


export default function RecordBox({ contractAddress, name, artist}: RecordBoxProps) {
    const [nftImageUrl, setNftImageUrl] = useState<string | null>(null)
    const [isLoadingImage, setIsLoadingImage] = useState(false)
    const [imageError, setImageError] = useState(false)

    // Fetch the previewImageURI from the contract
    const {
        data: previewImageURI,
        isLoading: isPreviewImageLoading,
        error: previewImageError,
    } = useReadContract({
        address: contractAddress as `0x${string}`,
        abi: recordAbi,
        functionName: "previewImageURI",
        query: {
            enabled: !!contractAddress,
        },
    })


    // Fetch the metadata and extract image URL when previewImageURI is available
    useEffect(() => {
        if (previewImageURI && !isPreviewImageLoading) {
            const fetchPreviewImage = async () => {
            setIsLoadingImage(true);
            try {
                // Convert IPFS URI to a browser-compatible URL
                const uri = previewImageURI as string;
                const imageUrl = resolveIpfsUrl(uri);

                setNftImageUrl(imageUrl);
            } catch (error) {
                console.error("Error setting preview image:", error);
                setImageError(true);
            } finally {
                setIsLoadingImage(false);
            }
            };

            fetchPreviewImage();
        }
    }, [previewImageURI, isPreviewImageLoading, contractAddress]);

    return (
    <Link href={`/buy-record/${contractAddress}`} className="block">
        <div className="border rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer">
        {/* Image */}
        <div className="aspect-square relative bg-gray-100">
            {isLoadingImage || isPreviewImageLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="animate-pulse">Loading...</span>
            </div>
            ) : imageError || previewImageError || !nftImageUrl ? (
            <Image
                src="/placeholder.png"
                alt="Placeholder Image"
                fill
                className="object-cover"
            />
            ) : (
            <Image
                src={nftImageUrl}
                alt={name}
                fill
                className="object-cover"
                onError={() => setImageError(true)}
            />
            )}
        </div>

        {/* Text */}
        <div className="text-center pt-2">
            <p className="text-m font-medium text-white-800">{name}</p>
            <p className="text-xs text-gray-500">{artist}</p>
        </div>
        </div>
    </Link>
    )

}