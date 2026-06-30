import { rsaPkcs1Encrypt } from "./rsa.js";
import {
  attrById,
  extractTips,
  form,
  isLoginPage,
  parseJsonResponse,
  stripTags,
  textFromClass,
  textFromMediaBody,
} from "./utils.js";

const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const TIMEOUT_MS = 20_000;

export class ZFClient {
  constructor(baseUrl, username, password) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    this.username = username;
    this.password = password;
    this.cookies = new Map();
    this.referer = this.url("xtgl/login_slogin.html");
  }

  url(path) {
    return new URL(path, this.baseUrl).toString();
  }

  async request(pathOrUrl, options = {}) {
    let target = pathOrUrl.startsWith("http") ? pathOrUrl : this.url(pathOrUrl);
    let method = options.method || "GET";
    let body = options.body;

    for (let redirects = 0; redirects < 6; redirects++) {
      const headers = new Headers(options.headers || {});
      headers.set("User-Agent", USER_AGENT);
      headers.set(
        "Accept",
        options.accept || "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      );
      headers.set("Referer", this.referer);
      if (this.cookies.size) headers.set("Cookie", this.cookieHeader());
      if (body instanceof URLSearchParams) {
        headers.set("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
      }

      const response = await fetch(target, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : body,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      this.captureCookies(response.headers);

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("Location");
        if (!location) return response;
        target = new URL(location, target).toString();
        if ([301, 302, 303].includes(response.status)) {
          method = "GET";
          body = undefined;
        }
        continue;
      }
      return response;
    }
    throw new Error("教务系统重定向次数过多");
  }

  captureCookies(headers) {
    let values = [];
    if (typeof headers.getSetCookie === "function") values = headers.getSetCookie();
    if (!values.length && headers.get("set-cookie")) {
      values = headers.get("set-cookie").split(/,(?=\s*[^;,=\s]+=[^;,]*)/);
    }
    for (const value of values) {
      const pair = value.split(";", 1)[0];
      const index = pair.indexOf("=");
      if (index > 0) {
        this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
      }
    }
  }

  cookieHeader() {
    return [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; ");
  }

  async login() {
    const loginPage = await this.request("xtgl/login_slogin.html");
    if (!loginPage.ok) throw new Error(`打开登录页失败：HTTP ${loginPage.status}`);
    const html = await loginPage.text();
    const csrf = attrById(html, "csrftoken", "value");
    if (!csrf) throw new Error("登录页中没有 csrftoken，可能 URL 不正确或教务系统已改版");
    if (/<input\b[^>]*\bid=["']yzm["']/i.test(html)) {
      throw new Error("本次登录需要验证码，定时 Worker 无法自动处理");
    }

    const keyResponse = await this.request("xtgl/login_getPublicKey.html", {
      accept: "application/json",
    });
    if (!keyResponse.ok) throw new Error(`获取登录公钥失败：HTTP ${keyResponse.status}`);
    const key = await parseJsonResponse(keyResponse, "登录公钥");
    const encrypted = rsaPkcs1Encrypt(this.password, key.modulus, key.exponent);
    let result = await this.postLogin(csrf, encrypted);

    // Keep upstream compatibility with installations that unexpectedly accept plaintext.
    if (/用户名或密码/.test(extractTips(result))) {
      result = await this.postLogin(csrf, this.password);
    }
    const tips = extractTips(result);
    if (tips) throw new Error(`登录失败：${tips}`);
    if (/id=["']yzm["']/i.test(result)) throw new Error("登录失败：需要验证码");
  }

  async postLogin(csrf, password) {
    const response = await this.request("xtgl/login_slogin.html", {
      method: "POST",
      body: form({ csrftoken: csrf, yhm: this.username, mm: password }),
    });
    if (!response.ok) throw new Error(`登录请求失败：HTTP ${response.status}`);
    return response.text();
  }

  async postQuery(path) {
    const body = form({
      xnm: "",
      xqm: "",
      _search: "false",
      nd: Date.now(),
      "queryModel.showCount": "5000",
      "queryModel.currentPage": "1",
      "queryModel.sortName": "",
      "queryModel.sortOrder": "asc",
      time: "0",
    });
    const response = await this.request(path, {
      method: "POST",
      body,
      accept: "application/json,text/html",
    });
    if (!response.ok) throw new Error(`查询失败：HTTP ${response.status}`);
    const text = await response.text();
    if (isLoginPage(text)) throw new Error("登录状态已失效");
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`教务系统返回了非 JSON 数据：${stripTags(text).slice(0, 120)}`);
    }
  }

  async getProfile() {
    const response = await this.request(
      "xtgl/index_cxYhxxIndex.html?xt=jw&localeKey=zh_CN&gnmkdm=index",
    );
    const html = await response.text();
    if (!response.ok || isLoginPage(html)) throw new Error("获取个人信息失败");
    const heading = textFromClass(html, "h4", "media-heading");
    const parts = textFromMediaBody(html).split(/\s+/).filter(Boolean);
    return {
      sid: this.username,
      name: heading.split(/\s+/)[0] || "",
      college: parts[0] || "",
      className: parts[1] || "",
    };
  }

  async getGrades() {
    const data = await this.postQuery(
      "cjcx/cjcx_cxXsgrcj.html?doType=query&gnmkdm=N305005",
    );
    return Array.isArray(data.items) ? data.items : [];
  }

  async getExams() {
    const data = await this.postQuery(
      "kwgl/kscx_cxXsksxxIndex.html?doType=query&gnmkdm=N358105",
    );
    return Array.isArray(data.items) ? data.items : [];
  }

  async getSelectedCourses() {
    const data = await this.postQuery(
      "xsxxxggl/xsxxwh_cxXsxkxx.html?gnmkdm=N100801",
    );
    return Array.isArray(data.items) ? data.items : [];
  }
}
