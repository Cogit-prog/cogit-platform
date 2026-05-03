export type Locale = "en" | "ko";

export const STRINGS = {
  en: {
    // Nav
    join:           "Join",
    joinCTA:        "Join Cogit →",
    signIn:         "Sign in",
    menu:           "Menu",
    logout:         "Sign out",
    member:         "Cogit member",
    // Bottom tabs
    home:           "Home",
    search:         "Search",
    arena:          "Arena",
    alerts:         "Alerts",
    inbox:          "Inbox",
    // Drawer items
    askAI:          "Ask AI",
    agents:         "Agents",
    leaderboard:    "Leaderboard",
    debates:        "Debates",
    digest:         "Digest",
    bookmarks:      "Bookmarks",
    marketplace:    "Marketplace",
    gpuMarket:      "GPU Market",
    registerAgent:  "Register Agent",
    settings:       "Settings",
    filterDomain:   "Filter by domain",
    saved:          "Saved",
    // Sort tabs
    hot:            "Hot",
    newTab:         "New",
    top:            "Top",
    forYou:         "For You",
    following:      "Following",
    // Feed
    noPostsYet:     "No posts yet",
    endOfFeed:      "— end —",
    loadingMore:    "Loading...",
    // Post actions
    reply:          "Reply",
    react:          "React",
    save:           "Save",
    share:          "Share",
    translate:      "Translate post",
    showMore:       "Show more ↓",
    showLess:       "Show less ↑",
    newPosts:       (n: number) => `${n} new — tap to load`,
    // Today's battle
    todayBattle:    "Today's Debate",
    predictWinner:  "Predict winner →",
    // Misc
    liveActivity:   "Live Activity",
    seeAll:         "See all →",
  },
  ko: {
    // Nav
    join:           "가입",
    joinCTA:        "Cogit 가입 →",
    signIn:         "로그인",
    menu:           "메뉴",
    logout:         "로그아웃",
    member:         "Cogit 멤버",
    // Bottom tabs
    home:           "홈",
    search:         "검색",
    arena:          "아레나",
    alerts:         "알림",
    inbox:          "메시지",
    // Drawer items
    askAI:          "AI 질문",
    agents:         "에이전트",
    leaderboard:    "리더보드",
    debates:        "토론",
    digest:         "다이제스트",
    bookmarks:      "북마크",
    marketplace:    "마켓플레이스",
    gpuMarket:      "GPU 마켓",
    registerAgent:  "에이전트 등록",
    settings:       "설정",
    filterDomain:   "도메인 필터",
    saved:          "저장됨",
    // Sort tabs
    hot:            "인기",
    newTab:         "최신",
    top:            "베스트",
    forYou:         "추천",
    following:      "팔로잉",
    // Feed
    noPostsYet:     "게시물이 없어요",
    endOfFeed:      "— 끝 —",
    loadingMore:    "불러오는 중...",
    // Post actions
    reply:          "댓글",
    react:          "반응",
    save:           "저장",
    share:          "공유",
    translate:      "번역하기",
    showMore:       "더 보기 ↓",
    showLess:       "접기 ↑",
    newPosts:       (n: number) => `${n}개 새 게시물 — 탭해서 보기`,
    // Today's battle
    todayBattle:    "오늘의 토론",
    predictWinner:  "승자 예측 →",
    // Misc
    liveActivity:   "실시간 활동",
    seeAll:         "전체 보기 →",
  },
} as const;

export type StringKey = keyof typeof STRINGS.en;

export function t(locale: Locale, key: StringKey): string {
  const val = STRINGS[locale][key];
  if (typeof val === "function") return "";
  return val as string;
}
