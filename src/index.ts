import express, { type Request, type Response } from 'express';
import cors from 'cors';

const app = express();

// 中间件配置
app.use(cors()); // 允许跨域请求
app.use(express.json()); // 解析 JSON 请求体
app.use(express.urlencoded({ extended: true })); // 解析表单请求体

const port = 3000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

app.get('/', (req: Request, res: Response) => {
  res.send('Hello b23-bv');
});

/**
 * /resolve
 * 支持 GET (通过 query 参数 ?url=...) 和 POST (通过 body 参数 { "url": "..." })
 */
const resolveHandler = async (req: Request, res: Response): Promise<any> => {
  const url = (req.query.url as string) || req.body?.url;

  const b23Regex = /^https:\/\/b23\.tv\/[a-zA-Z0-9]+(\?.*)?$/;
  if (!url || !b23Regex.test(url)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid b23.tv URL format. Use GET ?url=... or POST { "url": "..." }'
    });
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': UA },
      redirect: 'manual'
    });

    const resolvedUrl = response.headers.get('location');

    if (resolvedUrl) {
      const bvMatch = resolvedUrl.match(/BV[a-zA-Z0-9]{10}/);

      res.json({
        success: true,
        data: {
          shortUrl: url,
          longUrl: resolvedUrl,
          bvid: bvMatch ? bvMatch[0] : null
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Could not follow redirection'
      });
    }
  } catch (error) {
    console.error('[Resolve Error]:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during resolution'
    });
  }
};

app.get('/resolve', resolveHandler);
app.post('/resolve', resolveHandler);

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
