import {
  beijingDate,
  beijingDateTime,
  normalizeTitle,
  number,
  stableStringify,
} from "./utils.js";

export function normalizeGrades(items) {
  return items
    .map((item) => ({
      classId: item.jxb_id || "",
      title: normalizeTitle(item.kcmc),
      teacher: item.jsxm || "",
      credit: item.xf || "",
      grade: item.cj ?? "",
      percentage: item.bfzcj ?? "",
      gradePointCredit: item.xfjd ?? "",
      submittedAt: item.tjsj || "",
      submittedBy: item.tjrxm || "",
    }))
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
}

export function normalizeExams(items) {
  const today = beijingDate();
  return items
    .map((item) => ({
      courseId: item.kch || "",
      title: normalizeTitle(item.kcmc),
      time: item.kssj || "",
      location: item.cdmc || "",
      examName: item.ksmc || "",
      seat: item.zwh || "",
    }))
    .filter((item) => item.time && item.time.slice(0, 10) >= today)
    .sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
}

export function buildReport({
  profile,
  grades,
  exams,
  selectedItems,
  firstRun,
  gradeUpdated,
  examUpdated,
  force,
}) {
  const reasons = [];
  if (firstRun) reasons.push("首次运行成功");
  if (gradeUpdated) reasons.push("成绩已更新");
  if (examUpdated) reasons.push("考试安排已更新");
  if (force && !reasons.length) reasons.push("强制推送");
  const title = `正方教务管理系统${reasons.length ? `：${reasons.join("、")}` : "消息推送"}`;

  const recentGrades = recentGradeList(grades);
  const passed = grades.filter((item) => number(item.percentage) >= 60);
  const credits = passed.reduce((sum, item) => sum + number(item.credit), 0);
  const gpa = credits
    ? passed.reduce((sum, item) => sum + number(item.gradePointCredit), 0) / credits
    : 0;
  const percentageGpa = credits
    ? passed.reduce(
      (sum, item) => sum + number(item.percentage) * number(item.credit),
      0,
    ) / credits
    : 0;

  const gradeIds = new Set(grades.map((item) => item.classId));
  const ungraded = selectedItems.filter(
    (item) => item.jxb_id && !gradeIds.has(item.jxb_id),
  );
  const lines = [
    title,
    "------",
    "个人信息：",
    `学号：${profile.sid}`,
    `班级：${profile.className}`,
    `姓名：${profile.name}`,
    `当前GPA：${gpa.toFixed(2)}`,
    `当前百分制GPA：${percentageGpa.toFixed(2)}`,
    "------",
    "考试安排信息：",
  ];

  if (!exams.length) lines.push("暂无未结束的考试安排");
  for (const exam of exams) {
    lines.push(
      `课程名称：${exam.title}`,
      `考试时间：${exam.time}`,
      `考试地点：${exam.location}`,
      `考试批次：${exam.examName}`,
      `座位号：${exam.seat}`,
      "------",
    );
  }

  lines.push("成绩信息：");
  if (!recentGrades.length) lines.push("成绩为空");
  for (const grade of recentGrades) {
    const score = String(grade.grade) === String(grade.percentage) || !grade.percentage
      ? grade.grade
      : `${grade.grade} (${grade.percentage})`;
    lines.push(
      `课程名称：${grade.title}`,
      `任课教师：${grade.teacher}`,
      `成绩：${score}`,
      `提交时间：${grade.submittedAt}`,
      `提交人姓名：${grade.submittedBy}`,
      "------",
    );
  }

  lines.push("未公布成绩的课程：");
  if (!ungraded.length) lines.push("无");
  for (const course of ungraded.slice(0, 30)) {
    lines.push(
      `${course.xnmc || "未知学年"} 第${course.xqmmc || "?"}学期：`
      + `${normalizeTitle(course.kcmc)} - ${course.jsxm || ""}`,
    );
  }
  lines.push("------", `检查时间：${beijingDateTime()}`);
  return { title, text: lines.join("\n") };
}

function recentGradeList(grades) {
  const sorted = [...grades].sort(
    (a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""),
  );
  const cutoff = new Date(Date.now() - 75 * 86400_000).toISOString().slice(0, 10);
  const hasRecent = sorted.some((item) => item.submittedAt?.slice(0, 10) >= cutoff);
  return sorted
    .filter((item) => !hasRecent || item.submittedAt?.slice(0, 10) >= cutoff)
    .slice(0, 8);
}
