export const SITE = {
  website: "https://yohan.gouzerh.com", // replace this with your deployed domain
  author: "Yohan Gouzerh",
  profile: "https://yohan.gouzerh.com/",
  desc: "A technical blog regarding devops engineering, cicd, cloud and software development.",
  title: "Yohan Gouzerh's Blog",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: true,
    text: "Edit page",
    url: "https://github.com/ygouzerh/blog",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "Asia/Hong_Kong", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
} as const;
