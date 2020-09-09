// import axios from "axios";
// import { stringify } from "querystring";
// axios({
//   method: "POST",
//   url: "https://fgo.wiki/api.php",
//   params: {
//     action: "query",
//     meta: "tokens",
//     type: "login",
//     format: "json",
//   },
// }).then((res) => {
//   console.log(res.headers["set-cookie"][0].split(";")[0]);
//   const loginToken = res.data.query.tokens.logintoken;
//   console.log(loginToken);
//   axios({
//     method: "POST",
//     url: "http://114.55.210.235:8080/api.php",
//     data: stringify({
//       action: "login",
//       lgtoken: loginToken,
//       lgname: "夕舞八弦",
//       lgpassword: "19990804s",
//       format: "json",
//     }),
//     headers: {
//       Host: "fgo.wiki",
//       "Content-Type": "application/x-www-form-urlencoded",
//       Cookie: res.headers["set-cookie"][0].split(";")[0],
//     },
//   }).then((resp) => {
//     console.log(resp.headers);
//     console.log(resp.data);
//     // console.log(resp);
//   });
// });
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
