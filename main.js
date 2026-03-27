const http = require('http');
const fs = require('fs').promises;
const { Command } = require('commander'); // Імпортуємо клас Command [cite: 29]
const { XMLBuilder } = require('fast-xml-parser'); // [cite: 55]

const program = new Command(); // Створюємо новий екземпляр

// --- Частина 1: Налаштування аргументів ---
program
    .requiredOption('-i, --input <path>', 'шлях до файлу з даними')
    .requiredOption('-h, --host <address>', 'адреса сервера')
    .requiredOption('-p, --port <number>', 'порт сервера')
    .parse(process.argv);

const { input, host, port } = program.opts();

// --- Частина 2: Створення сервера ---
const server = http.createServer(async (req, res) => {
    try {
        // Перевірка наявності файлу (вимога Частини 1)
        await fs.access(input);

        // Асинхронне читання файлу (вимога Частини 2)
        const rawData = await fs.readFile(input, 'utf8');
        let weatherData = JSON.parse(rawData);

        // Параметри URL для Варіанту 7
        const url = new URL(req.url, `http://${host}:${port}`);
        const showHumidity = url.searchParams.get('humidity') === 'true';
        const minRainfall = parseFloat(url.searchParams.get('min_rainfall'));

        // Фільтрація за опадами
        if (!isNaN(minRainfall)) {
            weatherData = weatherData.filter(item => item.Rainfall > minRainfall);
        }

        // Формування масиву для XML
        const result = weatherData.map(item => {
            const record = {
                rainfall: item.Rainfall,
                pressure3pm: item.Pressure3pm
            };
            if (showHumidity) {
                record.humidity = item.Humidity3pm;
            }
            return record;
        });

        // Конвертація в XML
        const builder = new XMLBuilder({ format: true });
        const xmlContent = builder.build({
            weather_data: { // Кореневий тег Варіанту 7
                record: result
            }
        });

        res.writeHead(200, { 'Content-Type': 'application/xml' });
        res.end(xmlContent);

    } catch (err) {
        if (err.code === 'ENOENT') {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Cannot find input file'); // Текст помилки за завданням
        } else {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    }
});

// Запуск сервера
server.listen(port, host, () => {
    console.log(`Сервер запущено на http://${host}:${port}`);
});