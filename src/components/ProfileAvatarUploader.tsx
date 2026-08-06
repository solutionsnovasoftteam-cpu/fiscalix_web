"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ProfileAvatarUploader({
  avatarUrl,
  fallback,
  language = "es",
}: {
  avatarUrl?: string | null;
  fallback: string;
  language?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const isEnglish = language === "en";

  useEffect(() => {
    let active = true;

    if (!avatarUrl) {
      return () => { active = false; };
    }

    const image = new Image();
    image.onload = () => { if (active) setPreviewUrl(avatarUrl); };
    image.onerror = () => { if (active) setPreviewUrl(""); };
    image.src = avatarUrl;

    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [avatarUrl]);

  async function uploadAvatar(file: File) {
    setMessage("");

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setMessage(isEnglish ? "Use a JPG, PNG, or WebP image." : "Usa una imagen JPG, PNG o WebP.");
      return;
    }

    if (file.size > MAX_SIZE) {
      setMessage(isEnglish ? "The image must not exceed 5 MB." : "La imagen no debe superar 5 MB.");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch("/api/users/avatar", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message ?? (isEnglish ? "The photo could not be updated." : "No fue posible actualizar la foto."));
      }

      setPreviewUrl(payload.avatarUrl);
      setMessage(isEnglish ? "Profile photo updated." : "Foto de perfil actualizada.");
      router.refresh();
    } catch (error) {
      setPreviewUrl(avatarUrl ?? "");
      setMessage(error instanceof Error ? error.message : (isEnglish ? "The photo could not be updated." : "No fue posible actualizar la foto."));
    } finally {
      URL.revokeObjectURL(localPreview);
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="profile-avatar-control">
      <div className="profile-avatar-xl">
        {previewUrl ? (
          // The URL is supplied by the authenticated avatar API and rendered at its natural crop.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            onError={() => {
              setPreviewUrl("");
              setMessage(isEnglish ? "The profile image could not be loaded." : "No fue posible cargar la foto de perfil.");
            }}
            src={previewUrl}
          />
        ) : (
          <span>{fallback}</span>
        )}
        <button
          aria-label={isEnglish ? "Change profile photo" : "Cambiar foto de perfil"}
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
          title={isEnglish ? "Change profile photo" : "Cambiar foto de perfil"}
          type="button"
        >
          <Icon name={isUploading ? "hourglass_top" : "edit"} />
        </button>
        <input
          accept="image/jpeg,image/png,image/webp"
          className="profile-avatar-input"
          disabled={isUploading}
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadAvatar(file);
          }}
          ref={inputRef}
          type="file"
        />
      </div>
      {message ? <p aria-live="polite" className="profile-avatar-message">{message}</p> : null}
    </div>
  );
}
