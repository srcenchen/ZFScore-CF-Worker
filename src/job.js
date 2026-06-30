import { notify } from "./notify.js";
import { buildReport, normalizeExams, normalizeGrades } from "./report.js";
import { isTrue, sha256, stableStringify } from "./utils.js";
import { ZFClient } from "./zf-client.js";

export async function run(env, options = {}) {
  const notifyEnabled = options.notify !== false;
  const commitEnabled = options.commit !== false;
  validateEnv(env, notifyEnabled);

  const startedAt = new Date().toISOString();
  const client = new ZFClient(env.URL, env.USERNAME, env.PASSWORD);
  await client.login();
  const [profile, gradeItems, examItems, selectedItems] = await Promise.all([
    client.getProfile(),
    client.getGrades(),
    client.getExams(),
    client.getSelectedCourses(),
  ]);

  const grades = normalizeGrades(gradeItems);
  const exams = normalizeExams(examItems);
  const gradeHash = await sha256(stableStringify(grades));
  const examHash = await sha256(stableStringify(exams));
  const [oldGradeHash, oldExamHash, initialized] = await Promise.all([
    env.score_hash.get("last_grade_hash"),
    env.score_hash.get("last_exam_hash"),
    env.score_hash.get("initialized"),
  ]);

  const firstRun = initialized !== "1";
  const gradeUpdated = !firstRun && oldGradeHash !== gradeHash;
  const examUpdated = !firstRun && oldExamHash !== examHash;
  const force = notifyEnabled && isTrue(env.FORCE_PUSH_MESSAGE);
  const shouldNotify = firstRun || gradeUpdated || examUpdated || force;
  const report = buildReport({
    profile,
    grades,
    exams,
    selectedItems,
    firstRun,
    gradeUpdated,
    examUpdated,
    force,
  });

  let notifiedBy = [];
  if (notifyEnabled && shouldNotify) {
    notifiedBy = await notify(env, report.title, report.text);
  }

  // Commit only after a required notification succeeds, so failures are retried later.
  if (commitEnabled) {
    await Promise.all([
      env.score_hash.put("last_grade_hash", gradeHash),
      env.score_hash.put("last_exam_hash", examHash),
      env.score_hash.put("initialized", "1"),
      env.score_hash.put("last_success_at", new Date().toISOString()),
    ]);
  }

  return {
    ok: true,
    startedAt,
    firstRun,
    gradeUpdated,
    examUpdated,
    forced: force,
    notified: notifyEnabled && shouldNotify,
    notifiedBy,
    committed: commitEnabled,
    gradeCount: grades.length,
    upcomingExamCount: exams.length,
    report: report.text,
  };
}

function validateEnv(env, requireNotifier) {
  const missing = ["URL", "USERNAME", "PASSWORD"].filter((key) => !env[key]);
  if (!env.score_hash || typeof env.score_hash.get !== "function") {
    missing.push("score_hash (KV binding)");
  }
  if (requireNotifier && !env.TOKEN && !(env.TG_BOT_TOKEN && env.TG_CHAT_ID)) {
    missing.push("TOKEN or TG_BOT_TOKEN + TG_CHAT_ID");
  }
  if (missing.length) throw new Error(`缺少配置：${missing.join(", ")}`);
}
