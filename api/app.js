const express = require('express');
const {MongoClient, ObjectId} = require('mongodb');

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

const url = 'mongodb://mongodb:27017';
const dbName = 'tickets';
let db;

MongoClient.connect(url, {useNewUrlParser: true, useUnifiedTopology: true})
    .then(async (client) => {
        db = client.db(dbName);
        console.log('Подключение к БД успешно');
        await InitializationDB();
    })
    .catch((err) => console.error('Ошибка подключения к БД', err));

async function InitializationDB() {
    const TicketsTable = db.collection('tickets');
    const N_Tickets = await TicketsTable.countDocuments();

    if (N_Tickets === 0) {
        await TicketsTable.insertMany([
            {
                subject: 'Проблема с заходом в систему.',
                description: 'Много раз тыкал кнопку войти и меня заблокировали.',
                status: 'Новое',
                createdAt: new Date(),
            },
            {
                subject: 'GUI при запуске в систему пропал.',
                description: 'Случайно поменял стандартную версию питона в системе, после перезапуска перед лицом только консоль, что делать?',
                status: 'В работе',
                createdAt: new Date(),
            },
            {
                subject: 'Проблема с формой оплаты.',
                description: 'На моем сайте не работает форма оплаты, не могу завершить покупку.',
                status: 'Завершено',
                resolution: 'Исправлена интеграция платежного шлюза.',
                createdAt: new Date(),
            },
        ]);
        console.log('БД запущена с тестовыми данными');
    } else {
        console.log('БД уже имеет данные');
    }
}

// создать обращение
app.post('/tickets', async (req, res) => {
    const {subject, description} = req.body;
    if (!subject || !description) {
        return res.status(400).send('Тема и описание обязательны.');
    }
    const ticket = {subject, description, status: 'Новое', createdAt: new Date()};
    const result = await db.collection('tickets').insertOne(ticket);
    res.status(201).send({ticket, _id: result.insertedId });
});

// взять обращение в работу
app.patch('/tickets/:id/start', async (req, res) => {
    const {id} = req.params;
    try {
        const result = await db.collection('tickets').findOneAndUpdate(
            {_id: new ObjectId(id), status: 'Новое'},
            {$set: {status: 'В работе'}},
            {returnDocument: 'after'}
        );
        if (!result.value) return res.status(404).send('Обращение с таким id не найдено или оно уже имеет другой статус.');
        res.send(result.value);
    } catch (err) {
        console.error(err);
        res.status(500).send('Внутренняя ошибка сервера');
    }
});


// завершить обработку обращения
app.patch('/tickets/:id/complete', async (req, res) => {
    const {id} = req.params;
    const {resolution} = req.body;
    const result = await db.collection('tickets').findOneAndUpdate(
        {_id: new ObjectId(id), status: 'В работе'},
        {$set: { status: 'Завершено', resolution }},
        {returnDocument: 'after'}
    );
    if (!result.value) return res.status(404).send("Обращение не найдено или его статус уже не 'В работе'.");
    res.send(result.value);
});

// отменить обращение
app.patch('/tickets/:id/cancel', async (req, res) => {
    const {id} = req.params;
    const {cancellationReason} = req.body;
    const result = await db.collection('tickets').findOneAndUpdate(
        {_id: new ObjectId(id), status: {$ne: 'Завершено'}},
        {$set: {status: 'Отменено', cancellationReason} },
        {returnDocument: 'after'}
    );
    if (!result.value) return res.status(404).send('Обращение не найдено или статус уже обновлен.');
    res.send(result.value);
});

// получить список обращений с фильтрацией по дате
app.get('/tickets', async (req, res) => {
    const {startDate, endDate} = req.query;
    const filter = {};
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    const tickets = await db.collection('tickets')
        .find(filter)
        .sort({createdAt: -1})
        .toArray();
    res.send(tickets);
});

// отменить все обращения со статусом "В работе"
app.patch('/tickets/cancel-all', async (req, res) => {
    const {cancellationReason} = req.body;
    const result = await db.collection('tickets').updateMany(
        {status: 'В работе'},
        {$set: {status: 'Отменено', cancellationReason}}
    );
    res.send({modifiedCount: result.modifiedCount});
});

app.listen(port, () => console.log(`Server running on port ${port}, http://localhost:${port}`));