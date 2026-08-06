import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser, verifyToken } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const BUCKET = "avatars";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function extractStoragePath(url: string) {
  try {
    const parsed = new URL(url);

    const marker = `/storage/v1/object/public/${BUCKET}/`;

    const index = parsed.pathname.indexOf(marker);

    if (index === -1) return null;

    return decodeURIComponent(
      parsed.pathname.substring(index + marker.length),
    );
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    let userId = (await getCurrentUser())?.id ?? null;

    if (!userId) {
      const authHeader = request.headers.get("authorization");
      const firebaseToken = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;

      if (!firebaseToken) {
        return NextResponse.json(
          {
            success: false,
            message: "No autorizado",
          },
          {
            status: 401,
          },
        );
      }

      try {
        const decoded = await verifyToken(firebaseToken);

        const { data, error } = await supabase
          .from("usuarios")
          .select("id,estado")
          .eq("id", decoded.uid)
          .single();

        if (error || !data || data.estado !== "activo") {
          return NextResponse.json(
            {
              success: false,
              message: "No autorizado",
            },
            {
              status: 401,
            },
          );
        }

        userId = data.id;
      } catch {
        return NextResponse.json(
          {
            success: false,
            message: "No autorizado",
          },
          {
            status: 401,
          },
        );
      }
    }

    const authenticatedUserId = userId;

    if (!authenticatedUserId) {
      return NextResponse.json(
        {
          success: false,
          message: "No autorizado",
        },
        {
          status: 401,
        },
      );
    }

    const formData = await request.formData();

    const avatar = formData.get("avatar");

    if (!(avatar instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "No se recibió ninguna imagen.",
        },
        {
          status: 400,
        },
      );
    }

    if (avatar.size == 0) {
      return NextResponse.json(
        {
          success: false,
          message: "La imagen está vacía.",
        },
        {
          status: 400,
        },
      );
    }

    if (avatar.size > MAX_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "La imagen supera el límite de 5 MB.",
        },
        {
          status: 400,
        },
      );
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
    ];

    if (!allowedTypes.includes(avatar.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Formato de imagen no permitido.",
        },
        {
          status: 400,
        },
      );
    }

    // Obtener avatar actual

    const { data: currentUser, error: currentError } = await supabase
      .from("usuarios")
      .select("avatar_url")
      .eq("id", authenticatedUserId)
      .single();

    if (currentError) {
      return NextResponse.json(
        {
          success: false,
          message: "No fue posible obtener el usuario.",
        },
        {
          status: 500,
        },
      );
    }

    // Borrar foto anterior

    if (currentUser.avatar_url) {
      const oldPath = extractStoragePath(currentUser.avatar_url);

      if (oldPath) {
        await supabase.storage.from(BUCKET).remove([oldPath]);
      }
    }

    // Crear nombre único

    const extension =
      avatar.name.split(".").pop()?.toLowerCase() ?? "jpg";

    const fileName =
      `${authenticatedUserId}/${randomUUID()}.${extension}`;

    const bytes = await avatar.arrayBuffer();

    const buffer = Buffer.from(bytes);

    // Subir imagen

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        upsert: true,
        contentType: avatar.type,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          success: false,
          message: uploadError.message,
        },
        {
          status: 500,
        },
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(fileName);

    const avatarUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from("usuarios")
      .update({
        avatar_url: avatarUrl,
      })
      .eq("id", authenticatedUserId);

    if (updateError) {
      await supabase.storage.from(BUCKET).remove([fileName]);

      return NextResponse.json(
        {
          success: false,
          message: "No fue posible actualizar el perfil.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Foto de perfil actualizada correctamente.",
      avatarUrl,
    });
  } catch (error) {
    console.error(
      "Error al subir avatar:",
      error instanceof Error ? error.message : error,
    );

    return NextResponse.json(
      {
        success: false,
        message: "Ocurrió un error al subir la imagen.",
      },
      {
        status: 500,
      },
    );
  }
}
