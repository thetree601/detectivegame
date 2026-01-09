"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // URL에서 인증 코드 처리
        // Supabase는 자동으로 URL의 hash fragment에서 토큰을 읽어서 세션을 설정합니다
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("인증 콜백 처리 중 오류:", error);
          setStatus("error");
          setErrorMessage(error.message);
          // 3초 후 홈으로 리다이렉트
          setTimeout(() => {
            router.push("/");
          }, 3000);
          return;
        }

        if (session) {
          // 로그인 성공
          setStatus("success");
          // 1초 후 홈으로 리다이렉트
          setTimeout(() => {
            router.push("/");
          }, 1000);
        } else {
          // 세션이 없음 - 잠시 대기 후 다시 확인
          // OAuth 리다이렉트 후 세션이 설정되는데 시간이 걸릴 수 있음
          setTimeout(async () => {
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession) {
              setStatus("success");
              setTimeout(() => {
                router.push("/");
              }, 1000);
            } else {
              setStatus("error");
              setErrorMessage("로그인에 실패했습니다. 다시 시도해주세요.");
              setTimeout(() => {
                router.push("/");
              }, 3000);
            }
          }, 1000);
        }
      } catch (err) {
        console.error("인증 콜백 처리 중 예상치 못한 오류:", err);
        setStatus("error");
        setErrorMessage("예상치 못한 오류가 발생했습니다.");
        setTimeout(() => {
          router.push("/");
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column",
      alignItems: "center", 
      justifyContent: "center", 
      height: "100vh",
      gap: "1rem"
    }}>
      {status === "loading" && (
        <>
          <div style={{ fontSize: "1.25rem", color: "#6b7280" }}>로그인 처리 중...</div>
          <div style={{ fontSize: "0.875rem", color: "#9ca3af" }}>잠시만 기다려주세요</div>
        </>
      )}
      {status === "success" && (
        <>
          <div style={{ fontSize: "1.25rem", color: "#16a34a" }}>로그인 성공!</div>
          <div style={{ fontSize: "0.875rem", color: "#9ca3af" }}>홈으로 이동합니다...</div>
        </>
      )}
      {status === "error" && (
        <>
          <div style={{ fontSize: "1.25rem", color: "#dc2626" }}>로그인 실패</div>
          <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>{errorMessage || "오류가 발생했습니다."}</div>
          <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.5rem" }}>홈으로 돌아갑니다...</div>
        </>
      )}
    </div>
  );
}
