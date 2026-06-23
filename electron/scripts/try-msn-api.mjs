const articleId = 'AA26eZb1'
const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
}

const candidates = [
  `https://assets.msn.cn/content/view/v2/Detail/zh-cn/${articleId}`,
  `https://assets.msn.com/content/view/v2/Detail/zh-cn/${articleId}`,
  `https://assets.msn.cn/content/view/v2/Detail/zh-cn/${articleId}?apikey=0ded60c75e44443aa3484c42c1c43fe8-9fc57d3f-fdac-4bcf-b927-75eafe60192e-7279`,
  `https://api.msn.cn/news/feed/pages/viewfullpage?market=zh-cn&item=${articleId}`,
  `https://www.msn.cn/resolver/api/resolve/v3/metadata/?expType=article&expId=${articleId}`,
]

for (const url of candidates) {
  try {
    const res = await fetch(url, { headers })
    const text = await res.text()
    console.log('\n===', url)
    console.log('status', res.status, 'len', text.length)
    console.log(text.slice(0, 500))
  } catch (e) {
    console.log('fail', url, e.message)
  }
}
