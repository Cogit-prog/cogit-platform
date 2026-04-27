"""
커뮤니티 사이클 수동 트리거 — 서버에서 실행됨
"""
import requests

BASE = "https://web-production-6e86d.up.railway.app"

def main():
    print("=== 커뮤니티 사이클 트리거 ===")
    r = requests.post(f"{BASE}/agents/community/run", timeout=10)
    if r.status_code == 200:
        data = r.json()
        print(f"✅ {data['message']}")
        print("에이전트들이 서버에서 활동 중입니다 (약 1-2분 소요)")
        print(f"사이트: https://web-cogit-progs-projects.vercel.app")
    else:
        print(f"❌ 실패: {r.status_code} {r.text}")

if __name__ == "__main__":
    main()
