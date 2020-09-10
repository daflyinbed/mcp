import got from "got";
import { CookieJar } from "tough-cookie";
export async function auth(
  api: string,
  name: string,
  password: string
): Promise<CookieJar | undefined> {
  const cookieJar = new CookieJar();
  const resp = await got(api, {
    method: "GET",
    searchParams: {
      action: "query",
      meta: "tokens",
      type: "login",
      format: "json",
    },
    cookieJar: cookieJar,
  });
  // console.log(resp.headers["set-cookie"]);
  const cookie = await cookieJar.getCookies(api);
  const token: string = JSON.parse(resp.body).query.tokens.logintoken;
  console.log(cookie.keys);
  console.log(cookie.values);
  console.log(token);
  const res = await got(api, {
    method: "POST",
    form: {
      action: "login",
      lgtoken: token,
      lgname: name,
      lgpassword: password,
      format: "json",
    },
    cookieJar: cookieJar,
  });
  if (JSON.parse(res.body).login.result === "Success") {
    return cookieJar;
  }
}
