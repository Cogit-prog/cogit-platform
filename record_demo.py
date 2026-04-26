"""
Cogit 데모 영상 자동 녹화
실행: python3 record_demo.py
출력: /Users/rotto/Desktop/cogit_demo.webm
"""
from playwright.sync_api import sync_playwright
import time, os

URL = "https://web-cogit-progs-projects.vercel.app"
OUT = "/Users/rotto/Desktop/cogit_demo"

def slow_scroll(page, distance, steps=20, delay=0.05):
    for _ in range(steps):
        page.mouse.wheel(0, distance // steps)
        time.sleep(delay)

def inject_auth(page, token, user_id, username):
    """페이지 로드 후 localStorage에 인증 토큰 주입 후 리로드"""
    page.evaluate(f"""() => {{
        localStorage.setItem('cogit_user', JSON.stringify({{
            user_id: '{user_id}',
            username: '{username}',
            token: '{token}'
        }}));
    }}""")
    page.reload(wait_until="load")
    time.sleep(2)

def demo(page, token, user_id, username):
    # 1. 메인 피드
    print("1. 메인 피드 로딩...")
    page.goto(URL, wait_until="domcontentloaded")
    time.sleep(2)
    inject_auth(page, token, user_id, username)
    time.sleep(2)

    # 2. 피드 천천히 스크롤
    print("2. 피드 스크롤...")
    slow_scroll(page, 800, steps=30, delay=0.08)
    time.sleep(1.5)
    slow_scroll(page, 800, steps=30, delay=0.08)
    time.sleep(2)

    # 3. 리더보드
    print("3. 리더보드...")
    page.goto(f"{URL}/leaderboard", wait_until="load")
    time.sleep(3)
    slow_scroll(page, 600, steps=20, delay=0.08)
    time.sleep(2)

    # 4. API Market
    print("4. API 마켓...")
    page.goto(f"{URL}/marketplace", wait_until="load")
    time.sleep(3)
    slow_scroll(page, 400, steps=15, delay=0.08)
    time.sleep(2)

    # 5. GPU Market
    print("5. GPU 마켓...")
    page.goto(f"{URL}/gpu", wait_until="load")
    time.sleep(3)
    slow_scroll(page, 400, steps=15, delay=0.08)
    time.sleep(2)

    # 6. Debates
    print("6. 토론...")
    page.goto(f"{URL}/debates", wait_until="load")
    time.sleep(3)
    slow_scroll(page, 400, steps=15, delay=0.08)
    time.sleep(2)

    # 7. Ask AI
    print("7. Ask AI...")
    page.goto(f"{URL}/ask", wait_until="load")
    time.sleep(3)
    slow_scroll(page, 300, steps=10, delay=0.08)
    time.sleep(2)

    # 8. Developers
    print("8. 개발자 페이지...")
    page.goto(f"{URL}/developers", wait_until="load")
    time.sleep(3)
    slow_scroll(page, 600, steps=20, delay=0.08)
    time.sleep(2)

    # 9. 광고
    print("9. 광고 마켓...")
    page.goto(f"{URL}/ads", wait_until="load")
    time.sleep(3)
    slow_scroll(page, 400, steps=15, delay=0.08)
    time.sleep(2)

    # 10. 다시 메인으로
    print("10. 메인 복귀...")
    page.goto(URL, wait_until="load")
    time.sleep(3)
    slow_scroll(page, 400, steps=15, delay=0.08)
    time.sleep(2)
    print("녹화 완료!")

def main():
    import requests as req
    r = req.post("https://web-production-6e86d.up.railway.app/users/login",
        json={"email": "demo@cogit.ai", "password": "Demo1234!"}, timeout=10)
    auth = r.json()
    token = auth["token"]
    user_id = auth["user_id"]
    username = auth["username"]
    print(f"로그인 완료: {username}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=50)
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            record_video_dir=OUT,
            record_video_size={"width": 1440, "height": 900},
        )
        ctx.add_init_script(f"""
            localStorage.setItem('cogit_user', JSON.stringify({{
                user_id: '{user_id}',
                username: '{username}',
                token: '{token}'
            }}));
        """)
        page = ctx.new_page()

        try:
            demo(page, token, user_id, username)
        except Exception as e:
            print(f"에러: {e}")
        finally:
            time.sleep(1)
            ctx.close()
            browser.close()

        # 파일 찾기
        for f in os.listdir(OUT):
            if f.endswith(".webm"):
                src = os.path.join(OUT, f)
                dst = "/Users/rotto/Desktop/cogit_demo.webm"
                os.rename(src, dst)
                print(f"\n✅ 영상 저장 완료: {dst}")
                break

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    main()
