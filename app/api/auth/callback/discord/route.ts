import { NextRequest, NextResponse } from "next/server";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state"); // モーダルから渡されたFirebaseのUID

  if (!code || !userId) {
    return NextResponse.redirect(new URL("/?error=discord_failed", request.url));
  }

  try {
    // 1. 認証コードをアクセストークンに交換
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: "http://localhost:3000/api/auth/callback/discord",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error("Failed to get access token");
    }

    // 2. Discordユーザー情報を取得
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const discordUser = await userResponse.json();

    // 💡 3. 【重複チェック！】このDiscord IDが既に「他のユーザー」に使われていないか確認
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("discordId", "==", discordUser.id));
    const querySnapshot = await getDocs(q);

    // 既に誰かがこのDiscord IDを使っていて、かつ自分以外のUIDだった場合は弾く！
    const isAlreadyUsed = querySnapshot.docs.some((docSnap) => docSnap.id !== userId);

    if (isAlreadyUsed) {
      // エラーパラメータを付けてリダイレクト
      return NextResponse.redirect(
        new URL("/?error=discord_already_linked", request.url)
      );
    }

    // 4. 重複がなければ Firestore に保存！
    const userRef = doc(db, "users", userId);
    await setDoc(
      userRef,
      {
        discordId: discordUser.id,
        discordUsername: `${discordUser.username}`,
        hasConfiguredRecovery: true,
      },
      { merge: true }
    );

    // 5. 成功でリダイレクト
    return NextResponse.redirect(new URL("/?discord_linked=true", request.url));
  } catch (error) {
    console.error("Discord Auth Error:", error);
    return NextResponse.redirect(new URL("/?error=discord_error", request.url));
  }
}