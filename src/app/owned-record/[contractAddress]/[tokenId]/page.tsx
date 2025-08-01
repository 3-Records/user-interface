"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useReadContract } from "wagmi";
import { recordAbi } from "@/constants"; // adjust if your path differs
import { resolveIpfsUrl } from "@/utils/resolveForIpfs"; // your existing util

type Song = {
  track: number;
  title: string;
  artist: string;
  duration?: string;
  audio: string;
};

type RecordMetadata = {
  name: string;
  artist?: string;
  image?: string;
  description?: string;
  animation_url?: string;
  songs?: Song[];
  tokenId?: number | string;
};

function toBigIntId(id: string | number): bigint {
  if (typeof id === "number") return BigInt(id);
  return BigInt(id);
}

export default function OwnerRecordPage() {
  const params = useParams<{ contractAddress: string; tokenId: string }>();
  const contractAddress = params.contractAddress as `0x${string}`;
  const tokenIdParam = params.tokenId;

  const [metadata, setMetadata] = useState<RecordMetadata | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const {
    data: tokenUri,
    isLoading: isTokenUriLoading,
    error: tokenUriError,
  } = useReadContract({
    address: contractAddress,
    abi: recordAbi,
    functionName: "tokenURI",
    args: [toBigIntId(tokenIdParam)],
    query: { enabled: !!contractAddress && !!tokenIdParam },
  });

  // Fetch the metadata JSON when tokenURI is available
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!tokenUri || isTokenUriLoading) return;
      setIsLoadingMeta(true);
      setMetaError(null);
      try {
        const url = resolveIpfsUrl(tokenUri as string);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to fetch metadata: ${res.status}`);
        const json = (await res.json()) as RecordMetadata;
        if (!cancelled) setMetadata(json);
      } catch (e: any) {
        if (!cancelled) setMetaError(e?.message || "Failed to load metadata");
      } finally {
        if (!cancelled) setIsLoadingMeta(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [tokenUri, isTokenUriLoading]);

  const coverImage = useMemo(() => {
    if (!metadata?.image) return null;
    return resolveIpfsUrl(metadata.image);
  }, [metadata?.image]);

  const animationUrl = useMemo(() => {
    if (!metadata?.animation_url) return null;
    return resolveIpfsUrl(metadata.animation_url);
  }, [metadata?.animation_url]);

  const pageTitle = metadata?.name ?? "Loading…";
  const pageArtist = metadata?.artist ?? "Unknown Artist";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Breadcrumb / back */}
      <div className="mb-4">
        <Link href={`/record/${contractAddress}/${tokenIdParam}`} className="text-sm text-blue-600 hover:underline">
          View public token page
        </Link>
      </div>

      {/* Header */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Cover */}
        <div className="w-full max-w-[320px] md:max-w-none mx-auto md:mx-0">
          <div className="relative aspect-square bg-gray-100 overflow-hidden rounded-lg shadow">
            {isTokenUriLoading || isLoadingMeta ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="animate-pulse">Loading cover…</span>
              </div>
            ) : coverImage ? (
              <Image
                src={coverImage}
                alt={pageTitle}
                fill
                className="object-cover"
                onError={(e) => {
                  (e.currentTarget as any).src = "/placeholder.png";
                }}
              />
            ) : (
              <Image src="/placeholder.png" alt="Placeholder" fill className="object-cover" />
            )}
          </div>
        </div>

        {/* Title / Meta */}
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl md:text-3xl font-semibold">{pageTitle}</h1>
          <p className="text-gray-600">{pageArtist}</p>

          <div className="text-sm text-gray-500">
            <div>Contract: <span className="font-mono">{contractAddress}</span></div>
            <div>Token ID: <span className="font-mono">{tokenIdParam}</span></div>
          </div>

          {metadata?.description && (
            <p className="mt-2 text-gray-700 whitespace-pre-wrap">{metadata.description}</p>
          )}

          {animationUrl && (
            <div className="mt-3">
              <a
                href={animationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-gray-50"
              >
                Open Player
              </a>
            </div>
          )}

          {(tokenUriError || metaError) && (
            <div className="mt-2 text-sm text-red-600">
              {tokenUriError ? String(tokenUriError.message ?? tokenUriError) : metaError}
            </div>
          )}
        </div>
      </div>

      {/* Songs */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Tracks</h2>

        {!metadata?.songs?.length ? (
          <p className="text-gray-600">No tracks found for this token.</p>
        ) : (
          <ul className="space-y-4">
            {metadata.songs
              .sort((a, b) => (a.track ?? 0) - (b.track ?? 0))
              .map((song) => {
                const audioSrc = resolveIpfsUrl(song.audio);
                return (
                  <li
                    key={`${song.track}-${song.title}`}
                    className="rounded-lg border p-3 md:p-4 shadow-sm bg-white"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm text-gray-500">Track {song.track}</div>
                        <div className="text-base md:text-lg font-medium">{song.title}</div>
                        <div className="text-sm text-gray-600">{song.artist}</div>
                        {song.duration && (
                          <div className="text-xs text-gray-500 mt-1">Duration: {song.duration}</div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <audio controls preload="none" src={audioSrc} className="w-full">
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </div>
  );
}
