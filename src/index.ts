import express, { type Request, type Response, Router } from 'express';
import cors from 'cors';
import { eapi, eapiResDecrypt, weapi } from './neteaseCrypto.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = 3000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const resolveRouter = Router();

/**
 * GET/POST /resolve/bilibili
 */
const bilibiliHandler = async (req: Request, res: Response): Promise<any> => {
  const url = (req.query.url as string) || req.body?.url;
  const b23Regex = /^https:\/\/b23\.tv\/[a-zA-Z0-9]+(\?.*)?$/;

  if (!url || !b23Regex.test(url)) {
    return res.status(400).json({ success: false, message: 'Invalid b23.tv URL' });
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
        data: { original: url, resolved: resolvedUrl, bvid: bvMatch ? bvMatch[0] : null }
      });
    } else {
      res.status(404).json({ success: false, message: 'Could not resolve Bilibili redirect' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: String(error) });
  }
};

/**
 * GET/POST /resolve/netease
 */
const neteaseHandler = async (req: Request, res: Response): Promise<any> => {
  let url = (req.query.url as string) || req.body?.url;
  if (!url) return res.status(400).json({ success: false, message: 'URL is required' });

  const originalUrl = url;

  if (url.includes('163cn.tv')) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': UA },
        redirect: 'manual'
      });
      const location = response.headers.get('location');
      if (location) url = location;
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Failed to resolve Netease short link' });
    }
  }

  const idMatch = url.match(/id=(\d+)/) || url.match(/song\/(\d+)/);
  const songId = idMatch ? idMatch[1] : null;

  if (songId) {
    res.json({
      success: true,
      data: { original: originalUrl, resolved: url, songId }
    });
  } else {
    res.status(404).json({ success: false, message: 'Could not extract Netease song ID', resolved: url });
  }
};

/**
 * GET/POST /resolve/netease/detail
 * 伪造请求调用网易云 WEAPI 获取歌曲详情 (基于 song_detail.js)
 */
const neteaseDetailHandler = async (req: Request, res: Response): Promise<any> => {
  const songId = (req.query.id as string) || req.body?.id;
  if (!songId) return res.status(400).json({ success: false, message: 'Song ID is required' });

  // 构造 WEAPI 数据 (根据 song_detail.js 逻辑)
  const data = {
    c: `[{"id":${songId}}]`,
  };
  
  const encrypted = weapi(data);
  const postData = new URLSearchParams(encrypted as any).toString();

  try {
    const response = await fetch(`https://music.163.com/weapi/v3/song/detail?csrf_token=`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://music.163.com',
      },
      body: postData
    });

    const body = await response.json();
    res.json({
      success: true,
      data: body
    });
  } catch (error) {
    res.status(500).json({ success: false, message: String(error) });
  }
};

resolveRouter.get('/bilibili', bilibiliHandler);
resolveRouter.post('/bilibili', bilibiliHandler);
resolveRouter.get('/netease', neteaseHandler);
resolveRouter.post('/netease', neteaseHandler);
resolveRouter.get('/netease/detail', neteaseDetailHandler);
resolveRouter.post('/netease/detail', neteaseDetailHandler);

app.use('/resolve', resolveRouter);

app.get('/', (req, res) => res.send('b23-bv resolve service is running'));

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
