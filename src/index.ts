import express, { Request, Response } from 'express';
import path from 'path';
import puppeteer from 'puppeteer';
import cors from 'cors';

interface Cinema {
  name: string;
  link: string;
}

interface CinemaDurationData {
  title: string;
  duration: string;
  times: MovieTime[];
  img: string;
}

interface MovieTime {
  start: Date;
  end: Date;
}

interface Schedule {
  title: string;
  start: Date;
  end: Date;
  img: string;
}

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static('public'));

app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/api/cinemas', async (req: Request, res: Response) => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const city = 'brasilia';
    const baseUrl = `https://www.ingresso.com/cinemas`;

    await page.goto(`${baseUrl}?city=${city}`);

    const cinemas: Cinema[] = await page.evaluate(() => {
      const mainDivSelector = 'div.mx-0.mb-\\[30px\\].mt-\\[10px\\].flex.flex-col.lg\\:mx-\\[5px\\].lg\\:flex-row.lg\\:flex-wrap';
      const cinemaElements = document.querySelectorAll(mainDivSelector + ' .bg-ing-neutral-600');
      return Array.from(cinemaElements).map(element => {
        const link = (element.querySelector('a') as HTMLAnchorElement)?.href || '';
        const name = element.querySelector('h3')?.innerText || '';
        return { name, link };
      });
    });

    await browser.close();
    res.json(cinemas);
  } catch (error) {
    console.error('Error fetching cinemas:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/cinema/avaliable_days', async (req: Request, res: Response) => {
  try {
    const { cinema } = req.query;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(cinema as string);

    const days = await page.evaluate(() => {
      const slideList = document.querySelector('.splide__list');
      return slideList ? Array.from(slideList.children).map((slide, index) => {
        const date = slide.querySelector('span')?.innerText || '';
        return { date, index };
      }) : [];
    });

    await browser.close();
    res.json(days);
  } catch (error) {
    console.error('Error fetching available days:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/schedule', async (req: Request, res: Response) => {
  try {
    const { cinema, day, repeat } = req.query;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(cinema as string);

    await page.evaluate((day) => {
      document.querySelector(`.splide__list > div:nth-child(${Number(day) + 1}) > div`)?.click();
    }, day);

    await page.waitForSelector('div.mx-3.my-5.sm\\:mb-8.lg\\:mx-0');

    const movieTimes: CinemaDurationData[] = await page.evaluate(() => {
      const movies = Array.from(document.querySelectorAll('div.mx-3.my-5.sm\\:mb-8.lg\\:mx-0 > div'));
      return movies.map(movie => {
        const title = movie.querySelector('h3 a')?.innerText || 'Título não encontrado';
        const duration = movie.querySelector('p')?.innerText || 'Duração não encontrada';
        const times = Array.from(movie.querySelectorAll('a > div > span')).map(span => span.innerText);
        const img = movie.querySelector('img')?.src || '';
        return { title, duration, times, img };
      });
    });

    const calculateEndTime = (duration: string, times: string[]): MovieTime[] => {
      const [hours, minutes] = duration.split('h');
      const durationInMinutes = parseInt(hours) * 60 + parseInt(minutes);

      return times.map(time => {
        const [hour, minute] = time.split(':');
        const startTime = new Date();
        startTime.setHours(parseInt(hour));
        startTime.setMinutes(parseInt(minute));
        const endTime = new Date(startTime.getTime() + durationInMinutes * 60000);
        return { start: startTime, end: endTime };
      });
    };

    const movieTimesWithEndTime: CinemaDurationData[] = movieTimes.map(({ title, duration, times, img }) => {
      return { title, duration, times: calculateEndTime(duration, times), img };
    });

    const intervalScheduler = (cinemaDurationData: CinemaDurationData[], repeat: boolean) => {
      const agenda: Schedule[] = [];
      const allMovies: Schedule[] = [];
      const watchedStatus: Record<string, boolean> = {};

      cinemaDurationData.forEach((data) => {
        data.times.forEach((time) => {
          allMovies.push({ title: data.title, start: time.start, end: time.end, img: data.img });
        });
      });

      allMovies.sort((a, b) => a.end.getTime() - b.end.getTime());

      for (let i = 0; i < allMovies.length; i++) {
        const currentMovie = allMovies[i];
        if (agenda.length === 0 || currentMovie.start.getTime() >= agenda[agenda.length - 1].end.getTime()) {

          if (repeat || !watchedStatus[currentMovie.title]) {
            agenda.push(currentMovie);
            watchedStatus[currentMovie.title] = true;
          }
        }
      }

      return agenda;
    };

    const scheduledMovies = intervalScheduler(movieTimesWithEndTime, repeat === 'true');

    await browser.close();
    res.json(scheduledMovies);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
