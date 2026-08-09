"use client";

import { useEffect, useState } from "react";

export function UserAvatar({
  avatarUrl,
  fallback,
}: {
  avatarUrl?: string | null;
  fallback: string;
}) {
  const [loadedUrl, setLoadedUrl] = useState("");

  useEffect(() => {
    let active = true;

    if (!avatarUrl) {
      return () => { active = false; };
    }

    const image = new Image();
    image.onload = () => { if (active) setLoadedUrl(avatarUrl); };
    image.onerror = () => { if (active) setLoadedUrl(""); };
    image.src = avatarUrl;

    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [avatarUrl]);

  if (!avatarUrl || loadedUrl !== avatarUrl) return <>{fallback}</>;

  return (
    // The source may be Supabase Storage or the verified Google profile image.
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" onError={() => setLoadedUrl("")} src={loadedUrl} />
  );
}
