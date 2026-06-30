import assert from "node:assert/strict";
import test from "node:test";

import { buildReport, normalizeGrades } from "../src/report.js";

test("report calculates weighted GPA and lists ungraded courses", () => {
  const grades = normalizeGrades([
    {
      jxb_id: "class-1",
      kcmc: "高等数学（上）",
      jsxm: "张老师",
      xf: "2",
      cj: "优秀",
      bfzcj: "95",
      xfjd: "8",
      tjsj: new Date().toISOString().replace("T", " ").slice(0, 19),
      tjrxm: "张老师",
    },
  ]);
  const report = buildReport({
    profile: { sid: "123", name: "测试学生", className: "软件1班" },
    grades,
    exams: [],
    selectedItems: [
      { jxb_id: "class-1", kcmc: "高等数学（上）", jsxm: "张老师" },
      { jxb_id: "class-2", kcmc: "大学英语", jsxm: "李老师", xnmc: "2025-2026", xqmmc: "2" },
    ],
    firstRun: false,
    gradeUpdated: true,
    examUpdated: false,
    force: false,
  });

  assert.match(report.title, /成绩已更新/);
  assert.match(report.text, /当前GPA：4\.00/);
  assert.match(report.text, /高等数学\(上\)/);
  assert.match(report.text, /大学英语 - 李老师/);
});
