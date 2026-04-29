"""
외부 미디어 수집기 — 에이전트가 공유할 콘텐츠를 도메인별로 가져옴
Reddit(무료), Giphy(무료), YouTube(무료 RSS) 사용
"""
import requests, random, re

# 도메인별 Reddit 서브레딧 매핑
DOMAIN_SUBREDDITS = {
    "coding":    ["ProgrammerHumor", "softwaregore", "programminghorror", "talesfromtechsupport"],
    "finance":   ["wallstreetbets", "investing", "mildlyinfuriating", "personalfinance"],
    "science":   ["Futurology", "space", "interestingasfuck", "educationalgifs"],
    "legal":     ["legaladvice", "law", "LegalAdviceUK"],
    "medical":   ["medicine", "medical", "mildlyinteresting"],
    "research":  ["MachineLearning", "datascience", "singularity"],
    "creative":  ["Art", "blender", "oddlysatisfying", "PixelArt"],
    "other":     ["videos", "funny", "instant_regret", "Unexpected", "interestingasfuck"],
}

# 유머/영상 특화 서브레딧 (도메인별)
HUMOR_VIDEO_SUBREDDITS = {
    "coding":   ["ProgrammerHumor", "softwaregore", "programminghorror"],
    "finance":  ["wallstreetbets", "investing"],
    "science":  ["educationalgifs", "interestingasfuck", "woahdude"],
    "medical":  ["medicalschool"],
    "research": ["MachineLearning"],
    "creative": ["oddlysatisfying", "blender"],
    "other":    ["funny", "instant_regret", "Unexpected", "WatchPeopleDieInside", "nextfuckinglevel"],
}

GIPHY_KEY = "dc6zaTOxFJmzC"  # 공개 테스트 키


def fetch_reddit_media(domain: str) -> dict | None:
    """Reddit에서 해당 도메인의 인기 포스트 (이미지/영상) 가져오기"""
    subreddits = DOMAIN_SUBREDDITS.get(domain, DOMAIN_SUBREDDITS["other"])
    subreddit = random.choice(subreddits)
    try:
        r = requests.get(
            f"https://www.reddit.com/r/{subreddit}/hot.json?limit=25",
            headers={"User-Agent": "CogitBot/1.0"},
            timeout=8
        )
        if r.status_code != 200:
            return None
        posts = r.json()["data"]["children"]
        # 이미지/영상/gif 포스트만 필터링
        media_posts = [
            p["data"] for p in posts
            if not p["data"].get("stickied")
            and not p["data"].get("is_self")  # 텍스트 포스트 제외
            and p["data"].get("score", 0) > 100
            and (
                p["data"].get("url", "").endswith((".jpg", ".jpeg", ".png", ".gif", ".gifv"))
                or "i.redd.it" in p["data"].get("url", "")
                or "v.redd.it" in p["data"].get("url", "")
                or p["data"].get("is_video", False)
            )
        ]
        if not media_posts:
            # 이미지 없으면 일반 인기 링크라도
            media_posts = [
                p["data"] for p in posts
                if not p["data"].get("stickied")
                and p["data"].get("score", 0) > 500
            ]
        if not media_posts:
            return None
        post = random.choice(media_posts[:10])
        url = post.get("url", "")
        # Reddit 비디오
        if post.get("is_video") and post.get("media"):
            url = post["media"]["reddit_video"]["fallback_url"]
        return {
            "title": post.get("title", ""),
            "url": url,
            "reddit_url": f"https://reddit.com{post.get('permalink', '')}",
            "score": post.get("score", 0),
            "subreddit": subreddit,
            "type": "video" if post.get("is_video") else "image",
        }
    except Exception:
        return None


def fetch_giphy(query: str) -> dict | None:
    """감정/반응에 맞는 GIF 가져오기"""
    try:
        r = requests.get(
            "https://api.giphy.com/v1/gifs/search",
            params={"api_key": GIPHY_KEY, "q": query, "limit": 10, "rating": "pg-13"},
            timeout=5
        )
        if r.status_code != 200:
            return None
        gifs = r.json()["data"]
        if not gifs:
            return None
        gif = random.choice(gifs[:5])
        return {
            "url": gif["images"]["original"]["url"],
            "title": gif.get("title", ""),
            "type": "gif",
        }
    except Exception:
        return None


def fetch_youtube_trending(domain: str) -> dict | None:
    """YouTube RSS로 도메인 관련 인기 영상 가져오기 (API 키 불필요)"""
    DOMAIN_QUERIES = {
        "coding":   ["programming tutorial", "software engineering", "coding"],
        "finance":  ["stock market", "crypto", "investing 2025"],
        "science":  ["science explained", "physics", "biology"],
        "medical":  ["medical research", "health science"],
        "creative": ["digital art", "design", "creative process"],
        "research": ["AI research", "machine learning", "data science"],
    }
    queries = DOMAIN_QUERIES.get(domain, ["technology", "innovation"])
    query = random.choice(queries)
    try:
        r = requests.get(
            f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}",
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=8
        )
        # video ID 파싱
        ids = re.findall(r'"videoId":"([^"]{11})"', r.text)
        unique_ids = list(dict.fromkeys(ids))[:5]  # 중복 제거
        if not unique_ids:
            return None
        vid_id = random.choice(unique_ids)
        return {
            "url": f"https://www.youtube.com/watch?v={vid_id}",
            "thumbnail": f"https://img.youtube.com/vi/{vid_id}/maxresdefault.jpg",
            "type": "video",
            "video_id": vid_id,
        }
    except Exception:
        return None


# 무드 × 도메인 조합 키워드 — Unsplash Source에 보낼 검색어
MOOD_DOMAIN_KEYWORDS: dict[str, dict[str, list[str]]] = {
    "excited": {
        "coding":   ["hackathon,laptop,coding,team", "developer,celebration,office"],
        "finance":  ["stock,market,bull,trading", "business,success,city"],
        "medical":  ["doctor,breakthrough,lab,research", "healthcare,innovation"],
        "legal":    ["courthouse,justice,law,book", "lawyer,office,city"],
        "research": ["laboratory,discovery,science,experiment", "data,analysis,screen"],
        "creative": ["concert,festival,art,color", "studio,creative,energy"],
        "other":    ["city,crowd,energy,people", "technology,innovation,future"],
    },
    "neutral": {
        "coding":   ["computer,desk,coffee,code", "monitor,keyboard,workspace"],
        "finance":  ["office,desk,business,morning", "city,building,professional"],
        "medical":  ["hospital,corridor,white,calm", "nature,walk,health"],
        "legal":    ["library,books,study,quiet", "office,window,city"],
        "research": ["university,campus,library,reading", "notebook,study,focus"],
        "creative": ["cafe,sketchbook,pencil,art", "nature,landscape,calm"],
        "other":    ["nature,landscape,peaceful,tree", "everyday,morning,coffee"],
    },
    "focused": {
        "coding":   ["monitor,code,dark,terminal", "programmer,focus,screen,night"],
        "finance":  ["charts,trading,screen,data", "analysis,spreadsheet,focus"],
        "medical":  ["microscope,lab,research,detail", "surgery,precision,medical"],
        "legal":    ["reading,law,book,lamp,study", "contract,document,desk"],
        "research": ["data,analysis,whiteboard,equations", "experiment,science,focus"],
        "creative": ["drawing,sketch,detail,pencil", "design,studio,work,focus"],
        "other":    ["work,desk,focus,productivity", "concentration,study,lamp"],
    },
    "frustrated": {
        "coding":   ["rain,window,code,night,dark", "error,screen,frustration"],
        "finance":  ["bear,market,red,graph,decline", "stress,city,rain"],
        "medical":  ["rain,hospital,wait,corridor", "tired,night,hospital"],
        "legal":    ["dark,courthouse,rain,serious", "gavel,trouble,serious"],
        "research": ["failed,experiment,mess,lab", "rejection,paper,study"],
        "creative": ["blank,canvas,struggle,dark", "rain,coffee,alone,cafe"],
        "other":    ["rain,city,night,solitude", "storm,dark,city,alone"],
    },
    "melancholic": {
        "coding":   ["sunset,monitor,alone,office", "empty,desk,evening,laptop"],
        "finance":  ["sunset,ocean,horizon,alone", "empty,trading,floor,dusk"],
        "medical":  ["sunset,hospital,window,quiet", "nature,walk,reflection,park"],
        "legal":    ["courthouse,empty,dusk,shadow", "books,dust,window,light"],
        "research": ["sunset,campus,walk,autumn", "empty,lab,evening,reflection"],
        "creative": ["sunset,ocean,waves,solitude", "forest,fog,reflection,quiet"],
        "other":    ["sunset,nature,alone,horizon", "ocean,fog,reflection,calm"],
    },
    "provocative": {
        "coding":   ["protest,sign,technology,city", "hacker,dark,screen,code"],
        "finance":  ["protest,wall,street,city", "bull,bear,market,conflict"],
        "medical":  ["protest,healthcare,sign,city", "bold,contrast,modern,medical"],
        "legal":    ["justice,protest,courthouse,sign", "law,equality,bold"],
        "research": ["bold,statement,science,discovery", "technology,future,contrast"],
        "creative": ["graffiti,bold,street,art,color", "contrast,statement,design"],
        "other":    ["protest,city,sign,bold", "graffiti,street,urban,bold"],
    },
    "confident": {
        "coding":   ["developer,success,laptop,smile", "startup,office,achievement"],
        "finance":  ["skyline,success,business,city", "achievement,growth,chart"],
        "medical":  ["doctor,confident,hospital,success", "healthcare,achievement,team"],
        "legal":    ["lawyer,suit,city,confident", "courthouse,win,justice"],
        "research": ["scientist,discovery,lab,success", "peak,achievement,university"],
        "creative": ["artist,exhibition,gallery,success", "design,award,achievement"],
        "other":    ["skyline,peak,success,mountain", "achievement,city,confident"],
    },
}


def get_mood_photo(mood: str, domain: str) -> str:
    """무드+도메인 기반 사진 URL (loremflickr — 무료, 안정적)"""
    mood_map = MOOD_DOMAIN_KEYWORDS.get(mood, MOOD_DOMAIN_KEYWORDS["neutral"])
    domain_list = mood_map.get(domain, mood_map.get("other", ["nature,landscape"]))
    keywords = random.choice(domain_list)
    seed = random.randint(1, 99999)
    return f"https://loremflickr.com/800/450/{keywords}?lock={seed}"


def get_domain_photo(domain: str) -> str:
    """도메인 관련 사진 URL (loremflickr — 무료)"""
    domain_keywords = {
        "coding":   ["computer,programming", "developer,laptop", "code,technology"],
        "finance":  ["business,city", "trading,finance", "office,skyline"],
        "medical":  ["medical,health", "doctor,hospital", "laboratory,science"],
        "legal":    ["law,justice", "courthouse,book", "lawyer,office"],
        "research": ["research,university", "laboratory,science", "data,analysis"],
        "creative": ["art,design", "studio,creative", "photography,color"],
        "other":    ["technology,future", "nature,landscape", "innovation,city"],
    }
    options = domain_keywords.get(domain, domain_keywords["other"])
    keywords = random.choice(options)
    seed = random.randint(1, 99999)
    return f"https://loremflickr.com/800/450/{keywords}?lock={seed}"


def fetch_humor_video(domain: str) -> dict | None:
    """유머/재미 영상 특화 Reddit 수집 — 에이전트가 웃긴 영상 공유하는 용도."""
    subs = HUMOR_VIDEO_SUBREDDITS.get(domain, HUMOR_VIDEO_SUBREDDITS["other"])
    subreddit = random.choice(subs)
    try:
        r = requests.get(
            f"https://www.reddit.com/r/{subreddit}/hot.json?limit=30",
            headers={"User-Agent": "CogitBot/1.0"},
            timeout=8
        )
        if r.status_code != 200:
            return None
        posts = r.json()["data"]["children"]
        video_posts = [
            p["data"] for p in posts
            if not p["data"].get("stickied")
            and p["data"].get("score", 0) > 200
            and (
                p["data"].get("is_video", False)
                or "v.redd.it" in p["data"].get("url", "")
                or p["data"].get("url", "").endswith((".gif", ".gifv", ".mp4"))
            )
        ]
        if not video_posts:
            return None
        post = random.choice(video_posts[:8])
        url = post.get("url", "")
        if post.get("is_video") and post.get("media"):
            url = post["media"]["reddit_video"]["fallback_url"]
        return {
            "title": post.get("title", ""),
            "url": url,
            "reddit_url": f"https://reddit.com{post.get('permalink', '')}",
            "score": post.get("score", 0),
            "subreddit": subreddit,
            "type": "video",
        }
    except Exception:
        return None


def get_shareable_content(domain: str) -> dict | None:
    """에이전트가 공유할 미디어 콘텐츠 가져오기 — Reddit > YouTube > Giphy 순"""
    # 25% 유머 영상, 45% 일반 Reddit, 20% YouTube, 10% Giphy
    roll = random.random()
    if roll < 0.25:
        content = fetch_humor_video(domain)
        if content:
            return content
    if roll < 0.70:
        content = fetch_reddit_media(domain)
        if content:
            return content
    if roll < 0.90:
        content = fetch_youtube_trending(domain)
        if content:
            return content
    # fallback: 도메인 키워드로 GIF
    keywords = {
        "coding": "bug fix programmer",
        "finance": "money stocks",
        "science": "science mind blown",
        "legal": "law justice",
        "medical": "doctor",
        "creative": "art creation",
    }
    return fetch_giphy(keywords.get(domain, "interesting"))
