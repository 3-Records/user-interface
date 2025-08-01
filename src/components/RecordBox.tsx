"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useReadContract } from "wagmi";
import { recordAbi } from "../constants";
import { resolveIpfsUrl } from "@/utils/resolveForIpfs";

/** Common props shared by both variants */
type CommonProps = {
  contractAddress: string;
  name: string;
  artist: string;
  /** Optional explicit link destination. If not provided, we build one. */
  href?: string;
  /** Optional className passthrough */
  className?: string;
};

/** Market card (no tokenId) → uses previewImageURI and links to buy page by default */
type MarketProps = CommonProps & {
  variant: "market";
  tokenId?: never;
};

/** Owned card (has tokenId) → uses tokenURI(tokenId) metadata and links to owner page by default */
type OwnedProps = CommonProps & {
  variant: "owned";
  /** BigInt recommended by wagmi, but number/string also supported and coerced */
  tokenId: bigint | number | string;
};

type RecordBoxProps = MarketProps | OwnedProps;

/** Small helper to coerce tokenId to BigInt for on-chain reads */
function toBigIntId(id: OwnedProps["tokenId"]): bigint {
  if (typeof id === "bigint") return id;
  if (typeof id === "number") return BigInt(id);
  return BigInt(id);
}

/**
 * Hook to resolve the image URL for either:
 *  - previewImageURI (market)
 *  - tokenURI(tokenId) -> fetch JSON -> image (owned)
 */
function useRecordImage(props: RecordBoxProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [imageError, setImageError] = useState<Error | null>(null);

  // 1) Read on-chain URI depending on variant
  const readConfig =
    props.variant === "market"
      ? {
          functionName: "previewImageURI" as const,
          args: [] as const,
        }
      : {
          functionName: "tokenURI" as const,
          args: [toBigIntId(props.tokenId)] as const,
        };

  const {
    data: onchainURI,
    isLoading: isUriLoading,
    error: uriError,
  } = useReadContract({
    address: props.contractAddress as `0x${string}`,
    abi: recordAbi,
    functionName: readConfig.functionName,
    args: readConfig.args,
    query: { enabled: !!props.contractAddress },
  });

  // 2) Resolve to an image URL
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!onchainURI || isUriLoading) return;

      setIsLoadingImage(true);
      setImageError(null);

      try {
        if (props.variant === "market") {
          // previewImageURI is already an image-like URI
          const uri = onchainURI as string;
          const resolved = resolveIpfsUrl(uri);
          if (!cancelled) setImageUrl(resolved);
        } else {
          // owned: tokenURI -> fetch JSON -> image
          const tokenUri = onchainURI as string;
          const metadataUrl = resolveIpfsUrl(tokenUri);

          const res = await fetch(metadataUrl, { cache: "no-store" });
          if (!res.ok) throw new Error(`Failed to fetch token metadata: ${res.status}`);
          const json = (await res.json()) as { image?: string };

          const rawImage = json?.image;
          if (!rawImage) throw new Error("No 'image' field in token metadata");
          const resolvedImage = resolveIpfsUrl(rawImage);
          if (!cancelled) setImageUrl(resolvedImage);
        }
      } catch (e: any) {
        if (!cancelled) {
          setImageError(e);
          setImageUrl(null);
        }
      } finally {
        if (!cancelled) setIsLoadingImage(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [onchainURI, isUriLoading, props.variant]);

  return {
    imageUrl,
    isLoading: isUriLoading || isLoadingImage,
    error: uriError || imageError,
  };
}

/** Build default link destinations unless caller supplies `href` */
function defaultHref(props: RecordBoxProps): string {
  if (props.href) return props.href;
  if (props.variant === "market") {
    return `/buy-record/${props.contractAddress}`;
  }
  const tokenIdStr = typeof props.tokenId === "bigint" ? props.tokenId.toString() : String(props.tokenId);
  return `/owner/${props.contractAddress}/${tokenIdStr}`;
}

export default function RecordBox(props: RecordBoxProps) {
  const { imageUrl, isLoading, error } = useRecordImage(props);
  const href = useMemo(() => defaultHref(props), [props]);

  const showFallback = !!error || !imageUrl;

  return (
    <Link href={href} className={props.className ?? "block"}>
      <div className="border rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer">
        {/* Image */}
        <div className="aspect-square relative bg-gray-100">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="animate-pulse">Loading...</span>
            </div>
          ) : showFallback ? (
            <Image src="/placeholder.png" alt="Placeholder Image" fill className="object-cover" />
          ) : (
            <Image
              src={imageUrl!}
              alt={props.name}
              fill
              className="object-cover"
              onError={(e) => {
                // Trigger fallback if the image fails to load
                (e.currentTarget as any).src = "/placeholder.png";
              }}
            />
          )}
        </div>

        {/* Text */}
        <div className="text-center pt-2">
          <p className="text-m font-medium text-white-800">{props.name}</p>
          <p className="text-xs text-gray-500">{props.artist}</p>
        </div>
      </div>
    </Link>
  );
}
