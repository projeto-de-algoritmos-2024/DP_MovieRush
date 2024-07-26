import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const city = 'brasilia';
  const baseUrl = `https://www.ingresso.com/cinemas`;
  let movieTimes = [];
  const cinemas = [];

  await page.goto(`${baseUrl}?city=${city}`);

  const mainDivSelector = 'div.mx-0.mb-\\[30px\\].mt-\\[10px\\].flex.flex-col.lg\\:mx-\\[5px\\].lg\\:flex-row.lg\\:flex-wrap';
  const allDivs = await page.$$(mainDivSelector);

  if (allDivs.length > 1) {
    const secondDiv = allDivs[1];
    console.log('Segunda div encontrada!');

    const subDivSelector = '.bg-ing-neutral-600';
    const subDivs = await secondDiv.$$(subDivSelector);

    console.log(`Encontradas ${subDivs.length} sub-divs.`);

    for (let i = 0; i < subDivs.length; i++) {
      const link = await subDivs[i].$('a');
      if (link) {
        const href = await page.evaluate(a => a.href, link);
        const cinemaName = await page.evaluate(a => a.querySelector('h3')?.innerText, link);
        cinemas.push({ name: cinemaName, link: href });
      }
    }
  } else {
    console.log('Div principal não encontrada.');
  }

  if (cinemas.length > 0) {
    const cinema = cinemas[2];
    await page.goto(cinema.link);

    const movieListSelector = 'div.mx-3.my-5.sm\\:mb-8.lg\\:mx-0';
    const movieList = await page.$(movieListSelector);

    if (movieList) {
      const movies = await page.evaluate(movieList => {
        return Array.from(movieList.children).map(child => child.innerHTML);
      }, movieList);

      console.log(`Encontradas ${movies.length} divs diretamente filhas da movie list.`);

      movieTimes = await page.evaluate(() => {
        const movies = Array.from(document.querySelectorAll('div.mx-3.my-5.sm\\:mb-8.lg\\:mx-0 > div'));
        return movies.map(movie => {
          const title = movie.querySelector('h3 a')?.innerText || 'Título não encontrado';
          const duration = movie.querySelector('p')?.innerText || 'Duração não encontrada';
          const times = Array.from(movie.querySelectorAll('a > div > span')).map(span => span.innerText);
          return { title, duration, times };
        });
      });

      console.log('Horários dos filmes:', movieTimes);
    } else {
      console.log('Movie list não encontrada.');
    }
  } else {
    console.log('Nenhum cinema encontrado.');
  }

  await browser.close();
})();
