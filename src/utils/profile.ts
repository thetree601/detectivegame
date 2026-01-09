import { supabase } from "./supabase";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 현재 로그인한 사용자의 프로필을 가져옵니다.
 */
export async function getCurrentUserProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("프로필 조회 실패:", error);
    return null;
  }

  return data;
}

/**
 * 특정 사용자의 프로필을 가져옵니다.
 * @param userId 사용자 ID
 */
export async function getUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("프로필 조회 실패:", error);
    return null;
  }

  return data;
}

/**
 * 현재 사용자의 프로필을 업데이트합니다.
 */
export async function updateProfile(updates: {
  display_name?: string;
  avatar_url?: string;
}): Promise<{ error: Error | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: new Error("로그인이 필요합니다.") };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("프로필 업데이트 실패:", error);
    return { error };
  }

  return { error: null };
}
