import { sql } from "drizzle-orm";
import type { connectDb } from "./index";

type Db = ReturnType<typeof connectDb>;
type Locale = "zh" | "en";
type Counts = Record<"posts" | "topics" | "categories" | "tags", number>;
type ActivityRow = { id: string; title: string; timestamp: number };

const toActivity = <T extends ActivityRow>({ timestamp, ...entry }: T) => ({
  ...entry,
  timestamp: new Date(timestamp).toISOString(),
});

export async function readDashboard(db: Db) {
  const [counts, posts, topics] = await Promise.all([
    db.get<Counts>(sql`SELECT
      (SELECT count(DISTINCT content_id) FROM reachable_articles) AS posts,
      (SELECT count(*) FROM topics) AS topics,
      (SELECT count(*) FROM categories) AS categories,
      (SELECT count(*) FROM tags) AS tags`),
    db.all<ActivityRow & { locale: Locale }>(sql`
      SELECT id, title, timestamp, locale FROM (
        SELECT translation_id AS id, title, modified_at_ms AS timestamp, locale,
          row_number() OVER (
            PARTITION BY content_id ORDER BY modified_at_ms DESC, translation_id
          ) AS version_rank
        FROM reachable_articles
      ) WHERE version_rank = 1 ORDER BY timestamp DESC, id LIMIT 5`),
    db.all<ActivityRow>(sql`
      SELECT t.id, label.title, t.created_at_ms AS timestamp FROM topics t
      JOIN admin_topic_labels label ON label.id = t.id
      ORDER BY t.created_at_ms DESC, t.id LIMIT 5`),
  ]);
  if (!counts) throw new Error("Dashboard aggregate did not return a row.");
  return {
    counts,
    recentPosts: posts.map(toActivity),
    recentTopics: topics.map(toActivity),
  };
}
